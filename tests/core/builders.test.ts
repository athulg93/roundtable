/**
 * Tests for Pluggable Builders & Helpers (createAgent, createGroup, createDeliberationSession)
 */

import { describe, it, expect } from 'vitest';
import { createAgent, createGroup, createDeliberationSession } from '../../packages/core/builders.ts';

describe('Pluggable Builders & Factory Helpers', () => {
  it('creates an agent with optional rolePrompt omitted', () => {
    const agent = createAgent({
      name: 'General Analyst',
      model: 'mock-fast',
      provider: 'mock',
    });

    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('General Analyst');
    expect(agent.role).toBe('participant');
    expect(agent.rolePrompt).toBeUndefined(); // role is optional!
    expect(agent.visualIdentity.color).toBeDefined();
    expect(agent.temperature).toBe(0.7);
    expect(agent.contextBudget).toBe(8192);
  });

  it('creates an agent with custom rolePrompt and settings', () => {
    const agent = createAgent({
      name: 'Security Lead',
      model: 'mock-pro',
      provider: 'mock',
      role: 'participant',
      rolePrompt: 'Audit zero-trust storage and credentials boundaries',
      temperature: 0.3,
      contextBudget: 16000,
    });

    expect(agent.name).toBe('Security Lead');
    expect(agent.rolePrompt).toBe('Audit zero-trust storage and credentials boundaries');
    expect(agent.temperature).toBe(0.3);
    expect(agent.contextBudget).toBe(16000);
  });

  it('creates a group with default policies and round ceiling', () => {
    const group = createGroup({
      name: 'Architecture Committee',
      goal: 'Decide message queue protocol',
      agentIds: ['agent-1', 'agent-2'],
    });

    expect(group.name).toBe('Architecture Committee');
    expect(group.moderatorId).toBe('agent-1');
    expect(group.speakerPolicy).toBe('moderator-directed');
    expect(group.terminationPolicy).toBe('moderator-conclusion');
    expect(group.maxRounds).toBe(5);
  });

  it('createDeliberationSession enables 1-line pluggable session execution', async () => {
    const agent1 = createAgent({ name: 'Alice', model: 'mock-fast', provider: 'mock' });
    const agent2 = createAgent({ name: 'Bob', model: 'mock-fast', provider: 'mock' });

    const session = createDeliberationSession({
      topic: 'Evaluate append-only storage logs',
      agents: [agent1, agent2],
    });

    expect(session.currentState).toBe('idle');
    await session.start();
    expect(session.currentState).toBe('running');

    const turn = await session.step();
    expect(turn).not.toBeNull();
    expect(turn?.status).toBe('completed');
    expect(session.conversation.turns.length).toBe(1);
  });
});
