/**
 * Shared Structured Blackboard Tests (Phase 2 - P2.1)
 */

import { describe, it, expect } from 'vitest';
import { reduceConversation, replayEvents } from '../../packages/core/reducer.ts';
import { ConversationEvent, Group, Agent } from '../../packages/core/types.ts';
import { createBlackboardItem, extractBlackboardItems } from '../../packages/reasoning/blackboard.ts';

const testGroup: Group = {
  id: 'grp-test',
  name: 'Architecture Deliberation',
  goal: 'Decide distributed consensus mechanism',
  agentIds: ['agent-1', 'agent-2', 'agent-mod'],
  moderatorId: 'agent-mod',
  speakerPolicy: 'round-robin',
  terminationPolicy: 'max-rounds',
  maxRounds: 3,
  contextBudget: 8000,
  createdAt: 1000,
  updatedAt: 1000,
};

const testAgents: Record<string, Agent> = {
  'agent-1': {
    id: 'agent-1',
    name: 'Alice',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.7,
    maxOutputTokens: 500,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#0ea5e9' },
    createdAt: 1000,
  },
  'agent-2': {
    id: 'agent-2',
    name: 'Bob',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.7,
    maxOutputTokens: 500,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#10b981' },
    createdAt: 1000,
  },
  'agent-mod': {
    id: 'agent-mod',
    name: 'Moderator',
    role: 'moderator',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.2,
    maxOutputTokens: 500,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#a855f7' },
    createdAt: 1000,
  },
};

describe('Shared Structured Blackboard Reducer & State', () => {
  it('adds items to blackboard and derives correct state', () => {
    const createdEvent: ConversationEvent = {
      eventId: 'evt-1',
      conversationId: 'conv-1',
      sequence: 1,
      timestamp: 1000,
      schemaVersion: 2,
      type: 'conversation.created',
      payload: { group: testGroup, agents: testAgents },
    };

    let state = reduceConversation(null, createdEvent);
    expect(state.blackboard).toBeDefined();
    expect(Object.keys(state.blackboard.items)).toHaveLength(0);

    const item = createBlackboardItem('hypothesis', 'Raft is better than Paxos', 'agent-1', 'Alice');
    const addEvent: ConversationEvent = {
      eventId: 'evt-2',
      conversationId: 'conv-1',
      sequence: 2,
      timestamp: 1010,
      schemaVersion: 2,
      type: 'blackboard.item_added',
      payload: { item },
    };

    state = reduceConversation(state, addEvent);
    expect(state.blackboard.items[item.id]).toBeDefined();
    expect(state.blackboard.items[item.id].text).toBe('Raft is better than Paxos');
    expect(state.blackboard.items[item.id].status).toBe('active');

    // Resolve item
    const resolveEvent: ConversationEvent = {
      eventId: 'evt-3',
      conversationId: 'conv-1',
      sequence: 3,
      timestamp: 1020,
      schemaVersion: 2,
      type: 'blackboard.item_resolved',
      payload: {
        itemId: item.id,
        status: 'resolved',
        reason: 'Consensus achieved in round 2',
      },
    };

    state = reduceConversation(state, resolveEvent);
    expect(state.blackboard.items[item.id].status).toBe('resolved');
    expect(state.blackboard.items[item.id].resolvedReason).toBe('Consensus achieved in round 2');
  });

  it('replays blackboard events deterministically', () => {
    const item1 = createBlackboardItem('decision', 'Adopt SQLite WAL mode', 'agent-1', 'Alice');
    const item2 = createBlackboardItem('open_question', 'What is the read/write concurrency ratio?', 'agent-2', 'Bob');

    const events: ConversationEvent[] = [
      {
        eventId: 'evt-1',
        conversationId: 'conv-1',
        sequence: 1,
        timestamp: 1000,
        schemaVersion: 2,
        type: 'conversation.created',
        payload: { group: testGroup, agents: testAgents },
      },
      {
        eventId: 'evt-2',
        conversationId: 'conv-1',
        sequence: 2,
        timestamp: 1010,
        schemaVersion: 2,
        type: 'blackboard.item_added',
        payload: { item: item1 },
      },
      {
        eventId: 'evt-3',
        conversationId: 'conv-1',
        sequence: 3,
        timestamp: 1020,
        schemaVersion: 2,
        type: 'blackboard.item_added',
        payload: { item: item2 },
      },
      {
        eventId: 'evt-4',
        conversationId: 'conv-1',
        sequence: 4,
        timestamp: 1030,
        schemaVersion: 2,
        type: 'blackboard.item_resolved',
        payload: { itemId: item1.id, status: 'resolved', reason: 'Confirmed by benchmark' },
      },
    ];

    const replayed = replayEvents(events);
    expect(Object.keys(replayed.blackboard.items)).toHaveLength(2);
    expect(replayed.blackboard.items[item1.id].status).toBe('resolved');
    expect(replayed.blackboard.items[item2.id].status).toBe('active');
  });

  it('extracts blackboard items from model text using structured tags', () => {
    const content = `
Here is my architectural proposal:
[Decision]: Store append-only events directly to durable disk
[Hypothesis]: Batching disk syncs every 10ms yields 10x write throughput
[Assumption]: Hardware failure rate is under 0.01% annually
[Question]: What is our recovery time objective during node partition?
    `;

    const items = extractBlackboardItems(content, 'agent-1', 'Alice');
    expect(items).toHaveLength(4);
    expect(items[0].category).toBe('decision');
    expect(items[0].text).toContain('Store append-only events');
    expect(items[1].category).toBe('hypothesis');
    expect(items[2].category).toBe('assumption');
    expect(items[3].category).toBe('open_question');
  });
});
