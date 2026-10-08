/**
 * Multi-Agent Group Chat Orchestrator (P1.1, P1.4, P1.5, P1.6)
 * Single-writer headless engine that controls state transitions, model calls,
 * failure recovery, context compression, and typed subscriptions.
 */

import {
  Agent,
  Conversation,
  ConversationEvent,
  ConversationState,
  Group,
  NormalizedProviderError,
  RunOptions,
  Turn,
  Usage,
  NextStepsSummary,
  DetailedSummary,
} from './types.ts';
import { reduceConversation } from './reducer.ts';
import { isValidTransition } from './stateMachine.ts';
import { SingleWriterQueue } from './queue.ts';
import { ContextBuilder } from './contextBuilder.ts';
import {
  buildModeratorPrompt,
  buildModeratorRepairPrompt,
  getDeterministicFallbackDecision,
  parseModeratorDecision,
} from './moderator.ts';
import { checkTermination, selectRoundRobinSpeaker } from './policies.ts';
import {
  generateDetailedSummary,
  generateNextStepsSummary,
  generateRollingSummary,
} from './summarizer.ts';
import { ProviderRegistry, defaultProviderRegistry } from '../providers/registry.ts';
import { normalizeError } from '../providers/errors.ts';
import { StorageAdapter } from '../storage/types.ts';
import { MemoryStorageAdapter } from '../storage/memoryStorage.ts';

export type SessionEventListener = (event: any) => void;

export interface GroupChatSessionConfig {
  group: Group;
  agents: Record<string, Agent>;
  initialEvents?: ConversationEvent[];
  providerRegistry?: ProviderRegistry;
  storage?: StorageAdapter;
  summarizerModel?: string;
}

export class GroupChatSession {
  private queue = new SingleWriterQueue();
  private state: Conversation;
  private listeners = new Map<string, Set<SessionEventListener>>();
  private abortController: AbortController | null = null;
  private pauseRequested = false;
  private stopRequested = false;
  private consecutiveFailures = 0;

  readonly providers: ProviderRegistry;
  readonly storage: StorageAdapter;
  readonly contextBuilder = new ContextBuilder();
  readonly summarizerModel: string;

  constructor(config: GroupChatSessionConfig) {
    this.providers = config.providerRegistry || defaultProviderRegistry;
    this.storage = config.storage || new MemoryStorageAdapter();
    this.summarizerModel = config.summarizerModel || 'mock-fast';

    if (config.initialEvents && config.initialEvents.length > 0) {
      // Replay existing events
      let s: Conversation | null = null;
      for (const ev of config.initialEvents) {
        s = reduceConversation(s, ev);
      }
      this.state = s!;
    } else {
      // Initialize with conversation.created event
      const now = Date.now();
      const createdEvent: ConversationEvent = {
        eventId: 'evt-' + Math.random().toString(36).substring(2, 9),
        conversationId: 'conv-' + Math.random().toString(36).substring(2, 9),
        sequence: 1,
        timestamp: now,
        schemaVersion: 1,
        type: 'conversation.created',
        payload: {
          group: config.group,
          agents: config.agents,
        },
      };
      this.state = reduceConversation(null, createdEvent);
      this.storage.appendEvent(createdEvent).catch(console.error);
    }
  }

  // --- Public State & Inspection ---

  get conversation(): Conversation {
    return this.state;
  }

  get currentState(): ConversationState {
    return this.state.state;
  }

  // --- Typed Subscriptions ---

  on(eventType: string, handler: SessionEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  private emit(eventType: string, payload: any): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`Error in event listener for ${eventType}:`, err);
        }
      }
    }
  }

  // --- Append Event & Re-derive State ---

  private async appendEvent(
    eventData: Omit<ConversationEvent, 'eventId' | 'conversationId' | 'sequence' | 'timestamp' | 'schemaVersion'>
  ): Promise<ConversationEvent> {
    const event: ConversationEvent = {
      ...eventData,
      eventId: 'evt-' + Math.random().toString(36).substring(2, 9),
      conversationId: this.state.id,
      sequence: this.state.events.length + 1,
      timestamp: Date.now(),
      schemaVersion: 1,
    } as ConversationEvent;

    this.state = reduceConversation(this.state, event);
    await this.storage.appendEvent(event);
    await this.storage.saveConversation(this.state);

    this.emit('event', event);
    this.emit(event.type, event);
    this.emit('stateChange', this.state);

    return event;
  }

  // --- State Transitions ---

  private transitionTo(newState: ConversationState, reason?: string): void {
    if (this.state.state === newState) return;
    if (!isValidTransition(this.state.state, newState)) {
      console.warn(`Ignoring invalid transition: ${this.state.state} -> ${newState}`);
      return;
    }
    this.state = {
      ...this.state,
      state: newState,
      terminationReason: reason || this.state.terminationReason,
      updatedAt: Date.now(),
    };
    this.emit('stateChange', this.state);
  }

  // --- Command Controls ---

  async start(): Promise<void> {
    return this.queue.execute(async () => {
      if (this.state.state === 'idle') {
        this.transitionTo('running');
      }
    });
  }

  pause(): void {
    this.pauseRequested = true;
    if (this.state.state === 'running') {
      this.transitionTo('paused');
    }
  }

  resume(): void {
    this.pauseRequested = false;
    this.stopRequested = false;
    if (this.state.state === 'paused' || this.state.state === 'waiting_for_user') {
      this.transitionTo('running');
    }
  }

  stop(reason = 'User stopped the conversation'): void {
    this.stopRequested = true;
    this.pauseRequested = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.state.state !== 'ended') {
      this.appendEvent({
        type: 'conversation.ended',
        payload: { reason, finalTurnCount: this.state.totalTurns },
      }).catch(console.error);
    }
  }

  async interject(text: string, senderName = 'User'): Promise<void> {
    return this.queue.execute(async () => {
      const turnId = 'turn-' + Math.random().toString(36).substring(2, 9);
      await this.appendEvent({
        type: 'user.message',
        payload: { turnId, text, senderName },
      });
      // Reset failure streak if user intervened
      this.consecutiveFailures = 0;
    });
  }

  // --- Core Turn Execution ---

  async step(manualSpeakerId?: string, options: RunOptions = {}): Promise<Turn | null> {
    return this.queue.execute(async () => {
      return this.executeTurnInternal(manualSpeakerId, options);
    });
  }

  async run(options: RunOptions = {}): Promise<void> {
    return this.queue.execute(async () => {
      this.pauseRequested = false;
      this.stopRequested = false;

      if (this.state.state === 'idle' || this.state.state === 'paused') {
        this.transitionTo('running');
      }

      while (this.state.state === 'running' && !this.pauseRequested && !this.stopRequested) {
        // 1. Check termination policies
        const termCheck = checkTermination(this.state, options);
        if (termCheck.terminate) {
          await this.appendEvent({
            type: 'conversation.ended',
            payload: {
              reason: termCheck.reason || 'Terminated by policy',
              finalTurnCount: this.state.totalTurns,
            },
          });
          break;
        }

        // 2. Execute a single turn
        const turn = await this.executeTurnInternal(undefined, options);
        if (!turn || this.state.state !== 'running') {
          break;
        }

        // Check if pause was requested during the turn
        if (this.pauseRequested) {
          this.transitionTo('paused');
          break;
        }
      }
    });
  }

  private async executeTurnInternal(
    manualSpeakerId?: string,
    options: RunOptions = {}
  ): Promise<Turn | null> {
    if (this.state.state === 'ended') {
      return null;
    }

    const termCheck = checkTermination(this.state, options);
    if (termCheck.terminate) {
      await this.appendEvent({
        type: 'conversation.ended',
        payload: {
          reason: termCheck.reason || 'Terminated by policy',
          finalTurnCount: this.state.totalTurns,
        },
      });
      return null;
    }

    // 1. Determine Speaker
    const group = this.state.groupSnapshot;
    const speakerPolicy = options.speakerPolicy || group.speakerPolicy;
    const participants = Object.values(this.state.agentSnapshots).filter(
      (a) => a.role === 'participant'
    );
    const participantIds = participants.map((p) => p.id);

    if (participantIds.length === 0) {
      throw new Error('Group has no participant agents configured');
    }

    let speakerId: string | undefined = manualSpeakerId;
    let moderatorNote = '';

    if (!speakerId) {
      if (speakerPolicy === 'manual') {
        // In manual mode without speaker, wait for user
        this.transitionTo('waiting_for_user');
        return null;
      } else if (speakerPolicy === 'round-robin') {
        speakerId = selectRoundRobinSpeaker(participantIds, this.state.turns);
      } else if (speakerPolicy === 'moderator-directed') {
        const modResult = await this.decideModeratorNextSpeaker(participants);
        if (modResult.concluded) {
          await this.appendEvent({
            type: 'conversation.ended',
            payload: {
              reason: modResult.reason || 'Moderator declared conclusion',
              finalTurnCount: this.state.totalTurns,
            },
          });
          return null;
        }
        speakerId = modResult.nextSpeaker;
        moderatorNote = modResult.reason;
      } else {
        speakerId = participantIds[0];
      }
    }

    if (!speakerId) {
      speakerId = participantIds[0];
    }

    const agent = this.state.agentSnapshots[speakerId];
    if (!agent) {
      throw new Error(`Speaker ID '${speakerId}' not found in conversation agent snapshots`);
    }

    // 2. Baseline Context Management (P1.7)
    // Check if context needs compression
    let agentContext = this.contextBuilder.build(agent, this.state);
    if (agentContext.requiresCompression && agentContext.turnsNeedingSummary.length > 0) {
      await this.compressOlderTurns(agentContext.turnsNeedingSummary);
      // Rebuild context after rolling summary created
      agentContext = this.contextBuilder.build(agent, this.state);
    }

    // 3. Start Turn
    const turnId = 'turn-' + Math.random().toString(36).substring(2, 9);
    await this.appendEvent({
      type: 'turn.started',
      payload: {
        turnId,
        speakerId: agent.id,
        speakerName: agent.name,
        role: agent.role === 'moderator' ? 'moderator' : 'agent',
        model: agent.model,
        provider: agent.provider,
        effectiveConfig: {
          temperature: agent.temperature,
          maxOutputTokens: agent.maxOutputTokens,
          contextBudget: agent.contextBudget,
        },
      },
    });

    if (moderatorNote) {
      this.emit('moderatorNote', { speakerId: agent.id, note: moderatorNote });
    }

    // 4. Generate with Provider & Timeout/Failure Handling (P1.6)
    const turn = await this.executeTurnWithRecovery(agent, agentContext, turnId);
    return turn;
  }

  private async executeTurnWithRecovery(
    agent: Agent,
    context: ReturnType<ContextBuilder['build']>,
    turnId: string,
    retryCount = 0
  ): Promise<Turn | null> {
    const maxRetries = 2;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Timeouts
    const firstTokenTimeoutMs = agent.timeoutSettings?.firstTokenMs || 15000;
    const totalTimeoutMs = agent.timeoutSettings?.totalMs || 60000;

    let firstTokenReceived = false;
    let firstTokenTimer: NodeJS.Timeout | null = null;
    let totalTimer: NodeJS.Timeout | null = null;

    let accumulatedText = '';
    let finalUsage: Usage | undefined;

    try {
      firstTokenTimer = setTimeout(() => {
        if (!firstTokenReceived && !signal.aborted) {
          this.abortController?.abort(new Error('First token timeout exceeded'));
        }
      }, firstTokenTimeoutMs);

      totalTimer = setTimeout(() => {
        if (!signal.aborted) {
          this.abortController?.abort(new Error('Total generation timeout exceeded'));
        }
      }, totalTimeoutMs);

      const adapter = this.providers.require(agent.provider);
      const generator = adapter.generate(
        {
          model: agent.model,
          systemPrompt: context.systemPrompt,
          messages: context.messages,
          temperature: agent.temperature,
          maxOutputTokens: agent.maxOutputTokens,
          timeoutSettings: agent.timeoutSettings,
        },
        signal
      );

      for await (const chunk of generator) {
        if (!firstTokenReceived && chunk.text.length > 0) {
          firstTokenReceived = true;
          if (firstTokenTimer) clearTimeout(firstTokenTimer);
        }

        if (chunk.text) {
          accumulatedText += chunk.text;
          this.emit('token', { turnId, chunk: chunk.text, fullText: accumulatedText });
        }

        if (chunk.isFinal && chunk.usage) {
          finalUsage = chunk.usage;
        }
      }

      if (totalTimer) clearTimeout(totalTimer);

      if (!finalUsage) {
        finalUsage = {
          inputTokens: context.estimatedTokens,
          outputTokens: Math.ceil(accumulatedText.length / 4),
          latencyMs: 100,
          provider: agent.provider,
          model: agent.model,
        };
      }

      // Success! Turn completed
      await this.appendEvent({
        type: 'turn.completed',
        payload: {
          turnId,
          speakerId: agent.id,
          content: accumulatedText.trim(),
          usage: finalUsage,
        },
      });

      this.consecutiveFailures = 0;
      return this.state.turns.find((t) => t.id === turnId) || null;
    } catch (err: any) {
      if (firstTokenTimer) clearTimeout(firstTokenTimer);
      if (totalTimer) clearTimeout(totalTimer);

      // If user deliberately stopped
      if (this.stopRequested || err?.name === 'AbortError' && this.stopRequested) {
        // User stopped mid-turn
        await this.appendEvent({
          type: 'turn.skipped',
          payload: { turnId, speakerId: agent.id, reason: 'Interrupted by user stop' },
        });
        return null;
      }

      const normalized = normalizeError(err);
      this.consecutiveFailures++;

      // Check context overflow recovery
      if (normalized.code === 'context_overflow') {
        const completedTurns = this.state.turns.filter((t) => t.status === 'completed');
        if (completedTurns.length > 2) {
          await this.compressOlderTurns(completedTurns.slice(0, 3));
          const newContext = this.contextBuilder.build(agent, this.state);
          return this.executeTurnWithRecovery(agent, newContext, turnId, retryCount + 1);
        }
      }

      // Retry if retryable and under limit
      if (normalized.retryable && retryCount < maxRetries) {
        const backoffMs = Math.pow(2, retryCount) * 100;
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.executeTurnWithRecovery(agent, context, turnId, retryCount + 1);
      }

      // If consecutive failures reach participant count, pause cleanly
      const participantCount = Object.values(this.state.agentSnapshots).filter((a) => a.role === 'participant').length;
      const shouldPause = this.consecutiveFailures >= participantCount;

      await this.appendEvent({
        type: 'turn.failed',
        payload: {
          turnId,
          speakerId: agent.id,
          error: normalized,
          recoveryAction: shouldPause ? 'pause' : 'skip',
        },
      });

      if (shouldPause) {
        this.transitionTo('paused', `All agent attempts failed (${normalized.message}). Paused for user intervention.`);
      }

      return null;
    } finally {
      this.abortController = null;
    }
  }

  // --- Context Compression Helper ---

  private async compressOlderTurns(turnsToCompress: Turn[]): Promise<void> {
    const adapter = this.providers.get('mock') || this.providers.require('mock');
    const rollingText = await generateRollingSummary(
      turnsToCompress,
      this.state.summaries.rollingSummary,
      adapter,
      this.summarizerModel
    );

    await this.appendEvent({
      type: 'summary.created',
      payload: {
        summaryType: 'rolling',
        content: rollingText,
      },
    });
  }

  // --- Moderator Decision with Repair and Fallback ---

  private async decideModeratorNextSpeaker(
    participants: Agent[]
  ): Promise<{ nextSpeaker?: string; concluded: boolean; reason: string }> {
    const moderatorId = this.state.groupSnapshot.moderatorId;
    const moderatorAgent = this.state.agentSnapshots[moderatorId] || participants[0];
    const validIds = participants.map((p) => p.id);
    const adapter = this.providers.require(moderatorAgent.provider);

    const prompt = buildModeratorPrompt(this.state, participants);
    let rawOutput = '';

    // Attempt 1: Normal prompt
    try {
      for await (const chunk of adapter.generate({
        model: moderatorAgent.model,
        systemPrompt: moderatorAgent.rolePrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxOutputTokens: 250,
      })) {
        rawOutput += chunk.text;
      }
    } catch {
      rawOutput = '';
    }

    let parsed = parseModeratorDecision(rawOutput, validIds);

    // Attempt 2: If invalid, retry once with repair prompt (P1.4)
    if (!parsed.success) {
      const repairPrompt = buildModeratorRepairPrompt(rawOutput, parsed.error, validIds);
      let repairOutput = '';
      try {
        for await (const chunk of adapter.generate({
          model: moderatorAgent.model,
          systemPrompt: moderatorAgent.rolePrompt,
          messages: [{ role: 'user', content: repairPrompt }],
          temperature: 0.1,
          maxOutputTokens: 250,
        })) {
          repairOutput += chunk.text;
        }
      } catch {
        repairOutput = '';
      }
      parsed = parseModeratorDecision(repairOutput, validIds);
    }

    // Attempt 3: If still invalid, safe deterministic fallback (never deadlock!)
    if (parsed.success) {
      return parsed.decision;
    } else {
      const lastSpeakerTurn = [...this.state.turns].reverse().find((t) => t.role === 'agent');
      return getDeterministicFallbackDecision(
        validIds,
        lastSpeakerTurn?.speakerId,
        `Moderator response malformed; safe round-robin fallback activated.`
      );
    }
  }

  // --- Summaries Generation ---

  async summarize(): Promise<{ nextSteps: NextStepsSummary; detailed: DetailedSummary }> {
    return this.queue.execute(async () => {
      const moderatorId = this.state.groupSnapshot.moderatorId;
      const agent = this.state.agentSnapshots[moderatorId] || Object.values(this.state.agentSnapshots)[0];
      const adapter = this.providers.require(agent.provider);

      const nextStepsRes = await generateNextStepsSummary(this.state, adapter, agent.model);
      await this.appendEvent({
        type: 'summary.created',
        payload: {
          summaryType: 'next-steps',
          content: nextStepsRes.markdown,
          structured: nextStepsRes.structured,
        },
      });

      const detailedRes = await generateDetailedSummary(this.state, adapter, agent.model);
      await this.appendEvent({
        type: 'summary.created',
        payload: {
          summaryType: 'detailed',
          content: detailedRes.markdown,
          structured: detailedRes.structured,
        },
      });

      return {
        nextSteps: nextStepsRes.structured,
        detailed: detailedRes.structured,
      };
    });
  }
}

/**
 * Factory function conforming to P1.1 interface contract:
 * createGroupChat(config) -> session
 */
export function createGroupChat(config: GroupChatSessionConfig): GroupChatSession {
  return new GroupChatSession(config);
}
