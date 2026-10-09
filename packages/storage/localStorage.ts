/**
 * Browser LocalStorage Persistence Adapter (P1.9)
 * Saves groups, agents, events, and conversation snapshots into browser localStorage.
 */

import { StorageAdapter, ConversationSummaryItem } from './types.ts';
import { Agent, Conversation, ConversationEvent, Group } from '../core/types.ts';
import { MemoryStorageAdapter } from './memoryStorage.ts';

const PREFIX = 'magc_p1_';

export class LocalStorageAdapter implements StorageAdapter {
  private fallbackMemory = new MemoryStorageAdapter();

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private getItem<T>(key: string): T | null {
    if (!this.isAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (!this.isAvailable()) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage quota or write error:', e);
    }
  }

  async appendEvent(event: ConversationEvent): Promise<void> {
    await this.fallbackMemory.appendEvent(event);
    if (!this.isAvailable()) return;

    const key = `events_${event.conversationId}`;
    const list = this.getItem<ConversationEvent[]>(key) || [];
    list.push(event);
    this.setItem(key, list);
  }

  async loadEvents(conversationId: string): Promise<ConversationEvent[]> {
    if (this.isAvailable()) {
      const stored = this.getItem<ConversationEvent[]>(`events_${conversationId}`);
      if (stored && stored.length > 0) return stored;
    }
    return this.fallbackMemory.loadEvents(conversationId);
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    await this.fallbackMemory.saveConversation(conversation);
    if (!this.isAvailable()) return;

    this.setItem(`conv_${conversation.id}`, conversation);
    const index = this.getItem<string[]>('conversation_ids') || [];
    if (!index.includes(conversation.id)) {
      index.unshift(conversation.id);
      this.setItem('conversation_ids', index);
    }
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    if (this.isAvailable()) {
      const stored = this.getItem<Conversation>(`conv_${id}`);
      if (stored) return stored;
    }
    return this.fallbackMemory.loadConversation(id);
  }

  async listConversations(): Promise<ConversationSummaryItem[]> {
    if (this.isAvailable()) {
      const index = this.getItem<string[]>('conversation_ids') || [];
      const list: ConversationSummaryItem[] = [];
      for (const id of index) {
        const c = this.getItem<Conversation>(`conv_${id}`);
        if (c) {
          list.push({
            id: c.id,
            groupId: c.groupId,
            groupName: c.groupSnapshot.name,
            goal: c.groupSnapshot.goal,
            totalTurns: c.totalTurns,
            state: c.state,
            updatedAt: c.updatedAt,
          });
        }
      }
      if (list.length > 0) return list;
    }
    return this.fallbackMemory.listConversations();
  }

  async saveGroup(group: Group): Promise<void> {
    await this.fallbackMemory.saveGroup(group);
    if (!this.isAvailable()) return;

    this.setItem(`group_${group.id}`, group);
    const ids = this.getItem<string[]>('group_ids') || [];
    if (!ids.includes(group.id)) {
      ids.push(group.id);
      this.setItem('group_ids', ids);
    }
  }

  async getGroup(id: string): Promise<Group | null> {
    if (this.isAvailable()) {
      const g = this.getItem<Group>(`group_${id}`);
      if (g) return g;
    }
    return this.fallbackMemory.getGroup(id);
  }

  async listGroups(): Promise<Group[]> {
    if (this.isAvailable()) {
      const ids = this.getItem<string[]>('group_ids') || [];
      const list: Group[] = [];
      for (const id of ids) {
        const g = this.getItem<Group>(`group_${id}`);
        if (g) list.push(g);
      }
      if (list.length > 0) return list;
    }
    return this.fallbackMemory.listGroups();
  }

  async deleteGroup(id: string): Promise<void> {
    await this.fallbackMemory.deleteGroup(id);
    if (!this.isAvailable()) return;
    try {
      window.localStorage.removeItem(PREFIX + `group_${id}`);
      const ids = this.getItem<string[]>('group_ids') || [];
      this.setItem('group_ids', ids.filter((x) => x !== id));
    } catch (e) {
      console.warn('LocalStorage deleteGroup error:', e);
    }
  }

  async saveAgent(agent: Agent): Promise<void> {
    await this.fallbackMemory.saveAgent(agent);
    if (!this.isAvailable()) return;

    this.setItem(`agent_${agent.id}`, agent);
    const ids = this.getItem<string[]>('agent_ids') || [];
    if (!ids.includes(agent.id)) {
      ids.push(agent.id);
      this.setItem('agent_ids', ids);
    }
  }

  async getAgent(id: string): Promise<Agent | null> {
    if (this.isAvailable()) {
      const a = this.getItem<Agent>(`agent_${id}`);
      if (a) return a;
    }
    return this.fallbackMemory.getAgent(id);
  }

  async listAgents(): Promise<Agent[]> {
    if (this.isAvailable()) {
      const ids = this.getItem<string[]>('agent_ids') || [];
      const list: Agent[] = [];
      for (const id of ids) {
        const a = this.getItem<Agent>(`agent_${id}`);
        if (a) list.push(a);
      }
      if (list.length > 0) return list;
    }
    return this.fallbackMemory.listAgents();
  }

  async deleteAgent(id: string): Promise<void> {
    await this.fallbackMemory.deleteAgent(id);
    if (!this.isAvailable()) return;
    try {
      window.localStorage.removeItem(PREFIX + `agent_${id}`);
      const ids = this.getItem<string[]>('agent_ids') || [];
      this.setItem('agent_ids', ids.filter((x) => x !== id));
    } catch (e) {
      console.warn('LocalStorage deleteAgent error:', e);
    }
  }
}
