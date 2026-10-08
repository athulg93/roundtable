/**
 * Reducer & Golden Event Log Replay Tests (P1.1, Section 8.3)
 */

import { describe, it, expect } from 'vitest';
import { reduceConversation, replayEvents } from '../../packages/core/reducer.ts';
import { ConversationEvent, Group, Agent } from '../../packages/core/types.ts';
import { isValidTransition } from '../../packages/core/stateMachine.ts';

const mockGroup: Group = {
  id: 'grp-test',
  name: 'Test Group',
  goal: 'Evaluate architecture options',
  agentIds: ['agent-1', 'agent-2', 'agent-mod'],
  moderatorId: 'agent-mod',
  speakerPolicy: 'round-robin',
  terminationPolicy: 'max-rounds',
  maxRounds: 3,
  maxTokens: 20000,
  createdAt: 1000,
  updatedAt: 1000,
};

const mockAgents: Record<string, Agent> = {
  'agent-1': {
    id: 'agent-1',
    name: 'Alice',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    rolePrompt: 'System Engineer',
    temperature: 0.7,
    maxOutputTokens: 500,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#0ea5e9' },
  },
  'agent-2': {
    id: 'agent-2',
    name: 'Bob',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    rolePrompt: 'Security Lead',
    temperature: 0.7,
    maxOutputTokens: 500,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#f43f5e' },
  },
  'agent-mod': {
    id: 'agent-mod',
    name: 'Moderator',
    role: 'moderator',
    provider: 'mock',
    model: 'mock-fast',
    rolePrompt: 'Discussion Lead',
    temperature: 0.2,
    maxOutputTokens: 250,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#a855f7' },
  },
};

describe('State Machine Transitions', () => {
  it('enforces legal and illegal transitions', () => {
    expect(isValidTransition('idle', 'running')).toBe(true);
    expect(isValidTransition('running', 'paused')).toBe(true);
    expect(isValidTransition('paused', 'running')).toBe(true);
    expect(isValidTransition('running', 'ended')).toBe(true);
    expect(isValidTransition('ended', 'running')).toBe(false);
    expect(isValidTransition('ended', 'paused')).toBe(false);
  });
});

describe('Event Reducer and Golden Event Log Replay', () => {
  const goldenEvents: ConversationEvent[] = [
    {
      eventId: 'evt-1',
      conversationId: 'conv-golden',
      sequence: 1,
      timestamp: 1000,
      schemaVersion: 1,
      type: 'conversation.created',
      payload: { group: mockGroup, agents: mockAgents },
    },
    {
      eventId: 'evt-2',
      conversationId: 'conv-golden',
      sequence: 2,
      timestamp: 1050,
      schemaVersion: 1,
      type: 'turn.started',
      payload: {
        turnId: 'turn-1',
        speakerId: 'agent-1',
        speakerName: 'Alice',
        role: 'agent',
        model: 'mock-fast',
        provider: 'mock',
        effectiveConfig: { temperature: 0.7, maxOutputTokens: 500, contextBudget: 4000 },
      },
    },
    {
      eventId: 'evt-3',
      conversationId: 'conv-golden',
      sequence: 3,
      timestamp: 1100,
      schemaVersion: 1,
      type: 'turn.completed',
      payload: {
        turnId: 'turn-1',
        speakerId: 'agent-1',
        content: 'We should adopt an event-sourced architecture for auditability.',
        usage: {
          inputTokens: 120,
          outputTokens: 35,
          latencyMs: 50,
          provider: 'mock',
          model: 'mock-fast',
        },
      },
    },
    {
      eventId: 'evt-4',
      conversationId: 'conv-golden',
      sequence: 4,
      timestamp: 1150,
      schemaVersion: 1,
      type: 'user.message',
      payload: {
        turnId: 'turn-user-1',
        text: 'Make sure it also supports offline replay.',
        senderName: 'Lead Architect',
      },
    },
    {
      eventId: 'evt-5',
      conversationId: 'conv-golden',
      sequence: 5,
      timestamp: 1200,
      schemaVersion: 1,
      type: 'turn.started',
      payload: {
        turnId: 'turn-2',
        speakerId: 'agent-2',
        speakerName: 'Bob',
        role: 'agent',
        model: 'mock-fast',
        provider: 'mock',
        effectiveConfig: { temperature: 0.7, maxOutputTokens: 500, contextBudget: 4000 },
      },
    },
    {
      eventId: 'evt-6',
      conversationId: 'conv-golden',
      sequence: 6,
      timestamp: 1250,
      schemaVersion: 1,
      type: 'turn.completed',
      payload: {
        turnId: 'turn-2',
        speakerId: 'agent-2',
        content: 'Agreed, offline replay works seamlessly with append-only stores.',
        usage: {
          inputTokens: 180,
          outputTokens: 40,
          latencyMs: 50,
          provider: 'mock',
          model: 'mock-fast',
        },
      },
    },
    {
      eventId: 'evt-7',
      conversationId: 'conv-golden',
      sequence: 7,
      timestamp: 1300,
      schemaVersion: 1,
      type: 'conversation.ended',
      payload: {
        reason: 'Consensus achieved',
        finalTurnCount: 3,
      },
    },
  ];

  it('progressively reduces events correctly', () => {
    let state = reduceConversation(null, goldenEvents[0]);
    expect(state.state).toBe('idle');
    expect(state.turns.length).toBe(0);

    state = reduceConversation(state, goldenEvents[1]);
    expect(state.state).toBe('running');
    expect(state.turns.length).toBe(1);
    expect(state.turns[0].status).toBe('started');

    state = reduceConversation(state, goldenEvents[2]);
    expect(state.turns[0].status).toBe('completed');
    expect(state.turns[0].content).toContain('event-sourced');
    expect(state.totalUsage.inputTokens).toBe(120);
    expect(state.totalUsage.outputTokens).toBe(35);

    state = reduceConversation(state, goldenEvents[3]);
    expect(state.turns.length).toBe(2);
    expect(state.turns[1].role).toBe('user');
    expect(state.turns[1].content).toContain('offline replay');

    state = reduceConversation(state, goldenEvents[4]);
    state = reduceConversation(state, goldenEvents[5]);
    state = reduceConversation(state, goldenEvents[6]);
    expect(state.state).toBe('ended');
    expect(state.terminationReason).toBe('Consensus achieved');
  });

  it('golden replay produces 100% identical state deterministically', () => {
    const run1 = replayEvents(goldenEvents);
    const run2 = replayEvents(goldenEvents);

    expect(run1).toEqual(run2);
    expect(run1.turns.length).toBe(3);
    expect(run1.events.length).toBe(7);
    expect(run1.totalUsage.totalTokens).toBe(120 + 35 + 180 + 40);
  });
});
