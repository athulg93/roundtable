/**
 * Storage Interface (P1.9)
 * Abstracts persistence so Memory, LocalStorage, SQLite, or IndexedDB can be swapped.
 */

import { Agent, Conversation, ConversationEvent, Group } from '../core/types.ts';

export interface ConversationSummaryItem {
  id: string;
  groupId: string;
  groupName: string;
  goal: string;
  totalTurns: number;
  state: string;
  updatedAt: number;
}

export interface StorageAdapter {
  appendEvent(event: ConversationEvent): Promise<void>;
  loadEvents(conversationId: string): Promise<ConversationEvent[]>;
  saveConversation(conversation: Conversation): Promise<void>;
  loadConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<ConversationSummaryItem[]>;
  saveGroup(group: Group): Promise<void>;
  getGroup(id: string): Promise<Group | null>;
  listGroups(): Promise<Group[]>;
  saveAgent(agent: Agent): Promise<void>;
  getAgent(id: string): Promise<Agent | null>;
  listAgents(): Promise<Agent[]>;
}
