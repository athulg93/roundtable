/**
 * In-Memory Storage Adapter (P1.9)
 * Used for automated test suites and isolated runtimes.
 */

import { StorageAdapter, ConversationSummaryItem } from './types.ts';
import { Agent, Conversation, ConversationEvent, Group } from '../core/types.ts';

export class MemoryStorageAdapter implements StorageAdapter {
  private eventsByConversation = new Map<string, ConversationEvent[]>();
  private conversations = new Map<string, Conversation>();
  private groups = new Map<string, Group>();
  private agents = new Map<string, Agent>();

  async appendEvent(event: ConversationEvent): Promise<void> {
    if (!event || !event.conversationId) {
      throw new Error('Invalid event: missing conversationId');
    }
    const list = this.eventsByConversation.get(event.conversationId) || [];
    list.push(event);
    this.eventsByConversation.set(event.conversationId, list);
  }

  async loadEvents(conversationId: string): Promise<ConversationEvent[]> {
    return [...(this.eventsByConversation.get(conversationId) || [])];
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.id, { ...conversation });
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    const found = this.conversations.get(id);
    return found ? { ...found } : null;
  }

  async listConversations(): Promise<ConversationSummaryItem[]> {
    return Array.from(this.conversations.values()).map((c) => ({
      id: c.id,
      groupId: c.groupId,
      groupName: c.groupSnapshot.name,
      goal: c.groupSnapshot.goal,
      totalTurns: c.totalTurns,
      state: c.state,
      updatedAt: c.updatedAt,
    }));
  }

  async saveGroup(group: Group): Promise<void> {
    this.groups.set(group.id, { ...group });
  }

  async getGroup(id: string): Promise<Group | null> {
    const found = this.groups.get(id);
    return found ? { ...found } : null;
  }

  async listGroups(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async saveAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, { ...agent });
  }

  async getAgent(id: string): Promise<Agent | null> {
    const found = this.agents.get(id);
    return found ? { ...found } : null;
  }

  async listAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }
}
