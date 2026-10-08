/**
 * Multi-Agent Group Chat - Event Log Reducer (Section 3.1, 3.6, P1.1)
 * Pure function that derives state from an append-only event stream.
 * Replaying the same event log reconstructs the exact same state deterministically.
 */

import {
  Conversation,
  ConversationEvent,
  Turn,
  NextStepsSummary,
  DetailedSummary,
} from './types.ts';

export function reduceConversation(
  state: Conversation | null,
  event: ConversationEvent
): Conversation {
  switch (event.type) {
    case 'conversation.created': {
      return {
        id: event.conversationId,
        groupId: event.payload.group.id,
        groupSnapshot: { ...event.payload.group },
        agentSnapshots: { ...event.payload.agents },
        state: 'idle',
        roundCount: 0,
        totalTurns: 0,
        totalUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          latencyMs: 0,
          estimatedCost: 0,
        },
        events: [event],
        turns: [],
        summaries: {},
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    }

    case 'user.message': {
      if (!state) throw new Error('Cannot apply user.message before conversation.created');
      const userTurn: Turn = {
        id: event.payload.turnId,
        conversationId: state.id,
        speakerId: 'user',
        speakerName: event.payload.senderName || 'User',
        role: 'user',
        selectedModel: 'human',
        selectedProvider: 'human',
        status: 'completed',
        content: event.payload.text,
        startedAt: event.timestamp,
        completedAt: event.timestamp,
      };

      return {
        ...state,
        events: [...state.events, event],
        turns: [...state.turns, userTurn],
        totalTurns: state.totalTurns + 1,
        updatedAt: event.timestamp,
      };
    }

    case 'turn.started': {
      if (!state) throw new Error('Cannot apply turn.started before conversation.created');
      const agent = state.agentSnapshots[event.payload.speakerId];
      const isModerator = agent?.role === 'moderator' || event.payload.role === 'moderator';

      const turn: Turn = {
        id: event.payload.turnId,
        conversationId: state.id,
        speakerId: event.payload.speakerId,
        speakerName: event.payload.speakerName,
        role: isModerator ? 'moderator' : 'agent',
        selectedModel: event.payload.model,
        selectedProvider: event.payload.provider,
        status: 'started',
        content: '',
        startedAt: event.timestamp,
        effectiveConfig: event.payload.effectiveConfig,
      };

      return {
        ...state,
        state: state.state === 'ended' ? 'ended' : 'running',
        currentSpeakerId: event.payload.speakerId,
        events: [...state.events, event],
        turns: [...state.turns, turn],
        updatedAt: event.timestamp,
      };
    }

    case 'turn.completed': {
      if (!state) throw new Error('Cannot apply turn.completed before conversation.created');
      const turns = state.turns.map((t) => {
        if (t.id === event.payload.turnId) {
          return {
            ...t,
            status: 'completed' as const,
            content: event.payload.content,
            usage: event.payload.usage,
            completedAt: event.timestamp,
          };
        }
        return t;
      });

      const usage = event.payload.usage;
      const totalUsage = {
        inputTokens: state.totalUsage.inputTokens + (usage?.inputTokens || 0),
        outputTokens: state.totalUsage.outputTokens + (usage?.outputTokens || 0),
        totalTokens:
          state.totalUsage.totalTokens +
          (usage?.inputTokens || 0) +
          (usage?.outputTokens || 0),
        latencyMs: state.totalUsage.latencyMs + (usage?.latencyMs || 0),
        estimatedCost: state.totalUsage.estimatedCost + (usage?.estimatedCost || 0),
      };

      // Compute round count: if the speaker is a participant agent, increment turn count
      const completedTurnsCount = turns.filter(
        (t) => t.status === 'completed' && t.role === 'agent'
      ).length;
      const participantCount = Object.values(state.agentSnapshots).filter(
        (a) => a.role === 'participant'
      ).length || 1;
      const roundCount = Math.floor(completedTurnsCount / participantCount);

      return {
        ...state,
        events: [...state.events, event],
        turns,
        totalTurns: state.totalTurns + 1,
        roundCount,
        totalUsage,
        currentSpeakerId: undefined,
        updatedAt: event.timestamp,
      };
    }

    case 'turn.failed': {
      if (!state) throw new Error('Cannot apply turn.failed before conversation.created');
      const turns = state.turns.map((t) => {
        if (t.id === event.payload.turnId) {
          return {
            ...t,
            status: 'failed' as const,
            error: event.payload.error,
            recoveryAction: event.payload.recoveryAction,
            completedAt: event.timestamp,
          };
        }
        return t;
      });

      const nextState =
        event.payload.recoveryAction === 'pause' ? 'paused' : state.state;

      return {
        ...state,
        state: nextState,
        events: [...state.events, event],
        turns,
        currentSpeakerId: undefined,
        updatedAt: event.timestamp,
      };
    }

    case 'turn.skipped': {
      if (!state) throw new Error('Cannot apply turn.skipped before conversation.created');
      const turns = state.turns.map((t) => {
        if (t.id === event.payload.turnId) {
          return {
            ...t,
            status: 'skipped' as const,
            completedAt: event.timestamp,
          };
        }
        return t;
      });

      return {
        ...state,
        events: [...state.events, event],
        turns,
        currentSpeakerId: undefined,
        updatedAt: event.timestamp,
      };
    }

    case 'summary.created': {
      if (!state) throw new Error('Cannot apply summary.created before conversation.created');
      const summaries = { ...state.summaries };
      if (event.payload.summaryType === 'rolling') {
        summaries.rollingSummary = event.payload.content;
      } else if (event.payload.summaryType === 'next-steps') {
        summaries.nextSteps = event.payload.structured as NextStepsSummary;
        summaries.renderedMarkdown = event.payload.content;
      } else if (event.payload.summaryType === 'detailed') {
        summaries.detailed = event.payload.structured as DetailedSummary;
        summaries.renderedMarkdown = (summaries.renderedMarkdown ? summaries.renderedMarkdown + '\n\n' : '') + event.payload.content;
      }

      return {
        ...state,
        events: [...state.events, event],
        summaries,
        updatedAt: event.timestamp,
      };
    }

    case 'conversation.ended': {
      if (!state) throw new Error('Cannot apply conversation.ended before conversation.created');
      return {
        ...state,
        state: 'ended',
        terminationReason: event.payload.reason,
        currentSpeakerId: undefined,
        events: [...state.events, event],
        updatedAt: event.timestamp,
      };
    }

    default:
      return state!;
  }
}

/**
 * Reconstruct state by replaying an event log from start to finish.
 */
export function replayEvents(events: ConversationEvent[]): Conversation {
  if (events.length === 0) {
    throw new Error('Cannot replay empty event list');
  }

  let state: Conversation | null = null;
  for (const event of events) {
    state = reduceConversation(state, event);
  }

  return state!;
}
