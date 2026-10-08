/**
 * Conversation State Machine (Section 3.4)
 * Deterministic validation of state transitions.
 */

import { ConversationState } from './types.ts';

const ALLOWED_TRANSITIONS: Record<ConversationState, readonly ConversationState[]> = {
  idle: ['running', 'ended'],
  running: ['paused', 'waiting_for_user', 'ended'],
  paused: ['running', 'ended'],
  waiting_for_user: ['running', 'paused', 'ended'],
  ended: [],
};

export class InvalidStateTransitionError extends Error {
  constructor(public fromState: ConversationState, public toState: ConversationState, reason?: string) {
    super(`Invalid state transition from '${fromState}' to '${toState}'${reason ? `: ${reason}` : ''}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export function isValidTransition(from: ConversationState, to: ConversationState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: ConversationState, to: ConversationState, reason?: string): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to, reason);
  }
}
