/**
 * Conversation Branching & Forking Engine (Phase 2 - P2.3)
 * Supports forking conversations at any historical turn for 'what-if' exploration.
 * Tracks lineage, branch nodes, and isolates branch states deterministically.
 */

import { Conversation, ConversationEvent } from '../core/types.ts';
import { GroupChatSession, createGroupChat } from '../core/orchestrator.ts';
import { replayEvents } from '../core/reducer.ts';

export interface BranchInfo {
  conversationId: string;
  name: string;
  parentConversationId?: string;
  forkTurnSequence?: number;
  forkTurnId?: string;
  createdAt: number;
}

export class BranchRegistry {
  private branches = new Map<string, BranchInfo>();

  register(branch: BranchInfo): void {
    this.branches.set(branch.conversationId, branch);
  }

  get(conversationId: string): BranchInfo | undefined {
    return this.branches.get(conversationId);
  }

  list(): BranchInfo[] {
    return Array.from(this.branches.values());
  }

  getLineage(conversationId: string): BranchInfo[] {
    const lineage: BranchInfo[] = [];
    let current = this.branches.get(conversationId);
    while (current) {
      lineage.unshift(current);
      if (current.parentConversationId) {
        current = this.branches.get(current.parentConversationId);
      } else {
        break;
      }
    }
    return lineage;
  }
}

export const defaultBranchRegistry = new BranchRegistry();

/**
 * Forks a conversation at a specific turn sequence or turnId.
 * Slices the event history up to that point and spawns a new independent session.
 */
export function forkConversation(
  parentSession: GroupChatSession,
  options: {
    forkTurnId?: string;
    forkSequence?: number;
    newBranchName?: string;
    registry?: BranchRegistry;
  }
): GroupChatSession {
  const parentConv = parentSession.conversation;
  const registry = options.registry || defaultBranchRegistry;

  // 1. Determine cutoff sequence
  let cutoffSequence = parentConv.events.length;

  if (options.forkTurnId) {
    const targetTurn = parentConv.turns.find((t) => t.id === options.forkTurnId);
    if (!targetTurn) {
      throw new Error(`Turn '${options.forkTurnId}' not found in conversation`);
    }
    const matchingEvent = parentConv.events.find(
      (e) => e.type === 'turn.completed' && (e.payload as any).turnId === options.forkTurnId
    );
    if (matchingEvent) {
      cutoffSequence = matchingEvent.sequence;
    }
  } else if (typeof options.forkSequence === 'number') {
    cutoffSequence = options.forkSequence;
  }

  // 2. Slice events up to cutoff
  const slicedEvents = parentConv.events.filter((e) => e.sequence <= cutoffSequence);
  if (slicedEvents.length === 0) {
    throw new Error('Cannot fork empty event stream');
  }

  // 3. Generate child conversation identity
  const newConversationId = `conv-fork-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const branchName =
    options.newBranchName ||
    `branch-${parentConv.branch?.branchName || 'main'}-${Date.now().toString(36).slice(-4)}`;

  // Remap events to new conversation ID while preserving deterministic state
  const childEvents: ConversationEvent[] = slicedEvents.map((e, idx) => ({
    ...e,
    conversationId: newConversationId,
    sequence: idx + 1,
  }));

  // Append durable fork event
  const forkEvent: ConversationEvent = {
    eventId: `evt-fork-${Date.now().toString(36)}`,
    conversationId: newConversationId,
    sequence: childEvents.length + 1,
    timestamp: Date.now(),
    schemaVersion: 2,
    type: 'conversation.forked',
    payload: {
      parentConversationId: parentConv.id,
      forkTurnSequence: cutoffSequence,
      forkTurnId: options.forkTurnId,
      newBranchName: branchName,
    },
  };
  childEvents.push(forkEvent);

  // Replay sliced events to construct child state
  const childState = replayEvents(childEvents);

  // Register in branch registry
  const branchInfo: BranchInfo = {
    conversationId: newConversationId,
    name: branchName,
    parentConversationId: parentConv.id,
    forkTurnSequence: cutoffSequence,
    forkTurnId: options.forkTurnId,
    createdAt: Date.now(),
  };
  registry.register(branchInfo);

  // Return new child session
  return createGroupChat({
    group: { ...childState.groupSnapshot, id: `grp-${newConversationId}` },
    agents: { ...childState.agentSnapshots },
    initialEvents: childEvents,
    providerRegistry: parentSession.providers,
    storage: parentSession.storage,
  });
}
