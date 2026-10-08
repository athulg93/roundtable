/**
 * Context Builder and Prompt Assembler (P1.3, P1.7)
 * Assembles model-safe prompts with unambiguous speaker identities,
 * token budgeting (20-25% reserved for output), and rolling summary support.
 */

import { Agent, Conversation, Group, Turn } from './types.ts';
import { TokenEstimator, defaultTokenEstimator } from './tokenEstimator.ts';

export interface FormattedMessage {
  role: 'system' | 'user' | 'assistant';
  name?: string;
  content: string;
}

export interface AgentContext {
  systemPrompt: string;
  messages: FormattedMessage[];
  estimatedTokens: number;
  reservedOutputTokens: number;
  turnsIncluded: number;
  turnsNeedingSummary: Turn[];
  requiresCompression: boolean;
}

export class ContextBudgetError extends Error {
  constructor(public agentId: string, public maxOutput: number, public budget: number) {
    super(
      `Agent '${agentId}' configuration error: requested maxOutputTokens (${maxOutput}) exceeds or consumes entire context budget (${budget}).`
    );
    this.name = 'ContextBudgetError';
  }
}

export function validateAgentBudget(agent: Agent): void {
  const minInputReserve = Math.floor(agent.contextBudget * 0.25);
  if (agent.maxOutputTokens >= agent.contextBudget - minInputReserve) {
    throw new ContextBudgetError(agent.id, agent.maxOutputTokens, agent.contextBudget);
  }
}

export class ContextBuilder {
  constructor(private tokenEstimator: TokenEstimator = defaultTokenEstimator) {}

  build(
    agent: Agent,
    conversation: Conversation,
    options?: { blindMode?: boolean }
  ): AgentContext {
    validateAgentBudget(agent);

    const group = conversation.groupSnapshot;
    const participants = Object.values(conversation.agentSnapshots);

    // 1. Reserve 20-25% of context budget for output
    const reservedOutputTokens = Math.max(
      agent.maxOutputTokens,
      Math.floor(agent.contextBudget * 0.25)
    );
    const availableInputBudget = agent.contextBudget - reservedOutputTokens;

    // 2. Assemble System Prompt with explicit persona and participant roster
    const participantsList = participants
      .map((p) => {
        const desc = (p.rolePrompt || 'Analytical deliberation participant').slice(0, 120);
        return `- ${p.name} (${p.role === 'moderator' ? 'Moderator' : 'Participant'}): ${desc}...`;
      })
      .join('\n');

    const effectiveRolePrompt = agent.rolePrompt?.trim() ||
      'You are a thoughtful, analytical contributor. Provide clear reasoning, evaluate trade-offs, and advance the discussion constructively.';

    let systemPrompt = [
      `You are ${agent.name}.`,
      `Your Persona / Instructions:\n${effectiveRolePrompt}`,
      `Discussion Topic / Goal:\n${group.goal}`,
      `Group Participants:\n${participantsList}`,
      `Execution Rules:`,
      `- Contribute constructively to the discussion from your assigned perspective.`,
      `- Speak strictly in your own voice as ${agent.name}.`,
      `- DO NOT prepend your response with your name (e.g. do not output "${agent.name}: ...").`,
      `- NEVER impersonate, pretend to be, or fabricate turns for other participants.`,
      `- Keep answers focused, substantive, and address the discussion topic.`,
    ].join('\n\n');

    const systemPromptTokens = this.tokenEstimator.estimate(systemPrompt);
    let remainingBudget = availableInputBudget - systemPromptTokens;

    if (remainingBudget <= 0) {
      // Emergency truncation of instructions if system prompt is somehow massive
      systemPrompt = `You are ${agent.name}. Topic: ${group.goal}. Role: ${effectiveRolePrompt.slice(0, 200)}`;
      remainingBudget = availableInputBudget - this.tokenEstimator.estimate(systemPrompt);
    }

    // 3. Assemble Rolling Summary if present
    const messages: FormattedMessage[] = [];
    let rollingSummaryBudget = 0;
    if (conversation.summaries.rollingSummary) {
      const summaryText = `[Context Rolling Summary of Prior Turns]:\n${conversation.summaries.rollingSummary}`;
      rollingSummaryBudget = this.tokenEstimator.estimate(summaryText);
      if (remainingBudget > rollingSummaryBudget) {
        messages.push({
          role: 'system',
          content: summaryText,
        });
        remainingBudget -= rollingSummaryBudget;
      }
    }

    // Phase 2: Inject Shared Working Memory Blackboard if present
    if (conversation.blackboard && conversation.blackboard.items) {
      const activeItems = Object.values(conversation.blackboard.items).filter((i) => i.status === 'active');
      if (activeItems.length > 0) {
        const decisions = activeItems.filter((i) => i.category === 'decision').map((i) => `  - ✅ [Decision]: ${i.text}`);
        const hypotheses = activeItems.filter((i) => i.category === 'hypothesis').map((i) => `  - 💡 [Hypothesis]: ${i.text}`);
        const assumptions = activeItems.filter((i) => i.category === 'assumption').map((i) => `  - ⚠️ [Assumption]: ${i.text}`);
        const questions = activeItems.filter((i) => i.category === 'open_question').map((i) => `  - ❓ [Question]: ${i.text}`);

        const blackboardText = [
          `[Shared Working Memory Blackboard]:`,
          decisions.length ? decisions.join('\n') : null,
          hypotheses.length ? hypotheses.join('\n') : null,
          assumptions.length ? assumptions.join('\n') : null,
          questions.length ? questions.join('\n') : null,
        ].filter(Boolean).join('\n');

        const blackboardTokens = this.tokenEstimator.estimate(blackboardText);
        if (remainingBudget > blackboardTokens) {
          messages.push({ role: 'system', content: blackboardText });
          remainingBudget -= blackboardTokens;
        }
      }
    }

    // 4. Assemble Recent Turns (from newest to oldest until budget is exhausted)
    // Only completed turns and user messages
    const validTurns = options?.blindMode
      ? [] // In blind mode, agent sees no prior peer turns from this round
      : conversation.turns.filter((t) => t.status === 'completed' && t.content.trim().length > 0);

    const includedTurns: Turn[] = [];
    const excludedTurns: Turn[] = [];

    // Walk backwards from newest to oldest
    for (let i = validTurns.length - 1; i >= 0; i--) {
      const turn = validTurns[i];
      const speakerPrefix =
        turn.role === 'user'
          ? `[User (${turn.speakerName})]`
          : turn.role === 'moderator'
          ? `[Moderator (${turn.speakerName})]`
          : `[Agent (${turn.speakerName})]`;

      const turnText = `${speakerPrefix}: ${turn.content}`;
      const turnTokens = this.tokenEstimator.estimate(turnText);

      if (remainingBudget >= turnTokens) {
        includedTurns.unshift(turn);
        remainingBudget -= turnTokens;
      } else {
        // Excluded due to budget overflow
        excludedTurns.unshift(turn);
      }
    }

    // Format included turns into messages array
    for (const turn of includedTurns) {
      if (turn.speakerId === agent.id) {
        messages.push({
          role: 'assistant',
          name: agent.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
          content: turn.content,
        });
      } else {
        const prefix = turn.role === 'user' ? 'User' : turn.speakerName;
        messages.push({
          role: 'user',
          name: prefix.replace(/[^a-zA-Z0-9_-]/g, '_'),
          content: `[${prefix}]: ${turn.content}`,
        });
      }
    }

    const estimatedTotal =
      this.tokenEstimator.estimate(systemPrompt) +
      messages.reduce((acc, m) => acc + this.tokenEstimator.estimate(m.content), 0);

    return {
      systemPrompt,
      messages,
      estimatedTokens: estimatedTotal,
      reservedOutputTokens,
      turnsIncluded: includedTurns.length,
      turnsNeedingSummary: excludedTurns,
      requiresCompression: excludedTurns.length > 0,
    };
  }
}
