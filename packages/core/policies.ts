/**
 * Orchestration Policies (P1.5)
 * Composable speaker selection and termination policies.
 */

import { Conversation, RunOptions, SpeakerSelectionPolicy, TerminationPolicy } from './types.ts';

export const DEFAULT_HARD_TURN_LIMIT = 50;

export interface TerminationCheckResult {
  terminate: boolean;
  reason?: string;
}

export function checkTermination(
  conversation: Conversation,
  options: RunOptions = {}
): TerminationCheckResult {
  const group = conversation.groupSnapshot;
  const hardCeiling = options.hardTurnLimit ?? DEFAULT_HARD_TURN_LIMIT;

  // 1. Hard safety ceiling is ALWAYS enforced
  if (conversation.totalTurns >= hardCeiling) {
    return {
      terminate: true,
      reason: `Hard safety limit of ${hardCeiling} turns reached.`,
    };
  }

  const terminationPolicy: TerminationPolicy =
    options.terminationPolicy ?? group.terminationPolicy ?? 'manual';

  // 2. Max rounds policy
  if (terminationPolicy === 'max-rounds') {
    const maxRounds = options.maxRounds ?? group.maxRounds ?? 5;
    if (conversation.roundCount >= maxRounds) {
      return {
        terminate: true,
        reason: `Max rounds (${maxRounds}) reached.`,
      };
    }
  }

  // 3. Token budget policy
  if (terminationPolicy === 'token-budget') {
    const maxTokens = options.maxTokens ?? group.maxTokens ?? 40000;
    if (conversation.totalUsage.totalTokens >= maxTokens) {
      return {
        terminate: true,
        reason: `Total token budget (${maxTokens}) exceeded (used: ${conversation.totalUsage.totalTokens}).`,
      };
    }
  }

  // 4. If conversation state is already ended
  if (conversation.state === 'ended') {
    return {
      terminate: true,
      reason: conversation.terminationReason || 'Conversation was ended.',
    };
  }

  return { terminate: false };
}

export function selectRoundRobinSpeaker(
  participantAgentIds: string[],
  turns: Conversation['turns']
): string {
  if (participantAgentIds.length === 0) {
    throw new Error('Cannot select speaker from empty participant list');
  }

  // Find the last participant turn
  const lastParticipantTurn = [...turns]
    .reverse()
    .find((t) => t.role === 'agent' && participantAgentIds.includes(t.speakerId));

  if (!lastParticipantTurn) {
    return participantAgentIds[0];
  }

  const lastIndex = participantAgentIds.indexOf(lastParticipantTurn.speakerId);
  const nextIndex = (lastIndex + 1) % participantAgentIds.length;
  return participantAgentIds[nextIndex];
}
