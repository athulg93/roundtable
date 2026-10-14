/**
 * Storage Interface (P1.9, Phase 2 Dependability)
 * Abstracts persistence so Memory, LocalStorage, SQLite, or IndexedDB can be swapped.
 */

import { Agent, Conversation, ConversationEvent, Group } from '../core/types.ts';
import { ProviderConfig } from '../providers/types.ts';

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
  // Event & Conversation Persistence
  appendEvent(event: ConversationEvent): Promise<void>;
  loadEvents(conversationId: string): Promise<ConversationEvent[]>;
  saveConversation(conversation: Conversation): Promise<void>;
  loadConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<ConversationSummaryItem[]>;

  // Group Management
  saveGroup(group: Group): Promise<void>;
  getGroup(id: string): Promise<Group | null>;
  listGroups(): Promise<Group[]>;
  deleteGroup(id: string): Promise<void>;

  // Agent Management
  saveAgent(agent: Agent): Promise<void>;
  getAgent(id: string): Promise<Agent | null>;
  listAgents(): Promise<Agent[]>;
  deleteAgent(id: string): Promise<void>;

  // Provider Configuration Persistence (Non-secret endpoints, models & routing)
  saveProviderConfig(config: ProviderConfig): Promise<void>;
  getProviderConfig(id: string): Promise<ProviderConfig | null>;
  listProviderConfigs(): Promise<ProviderConfig[]>;
  deleteProviderConfig(id: string): Promise<void>;
}

export interface ExportBundleMetadata {
  bundleVersion: '1.1';
  exportedAt: string;
  conversationId: string;
  groupName: string;
  goal: string;
  state: string;
  totalTurns: number;
  totalTokens: number;
  sanitized: boolean;
  redactedPatternCount?: number;
}

export interface ExportedSessionBundle {
  formatVersion: '1.1';
  metadata: ExportBundleMetadata;
  conversation: Conversation;
  events?: ConversationEvent[];
  transcriptMarkdown: string;
}

export interface ExportOptions {
  includeEvents?: boolean;
  includeSummaries?: boolean;
  pretty?: boolean;
  redactSensitivePatterns?: boolean;
  customRedactor?: (text: string) => string;
}
