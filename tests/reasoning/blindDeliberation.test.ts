/**
 * Blind-First Deliberation Tests (Phase 2 - P2.2)
 */

import { describe, it, expect } from 'vitest';
import { createGroupChat } from '../../packages/core/orchestrator.ts';
import { executeBlindRound } from '../../packages/reasoning/blindDeliberation.ts';
import { Group, Agent } from '../../packages/core/types.ts';
import { MockProvider } from '../../packages/providers/mockProvider.ts';
import { ProviderRegistry } from '../../packages/providers/registry.ts';

const testGroup: Group = {
  id: 'grp-blind',
  name: 'Security Evaluation',
  goal: 'Evaluate passkey adoption vs SMS OTP',
  agentIds: ['sec-alice', 'sec-bob'],
  moderatorId: 'sec-alice',
  speakerPolicy: 'round-robin',
  terminationPolicy: 'manual',
  maxRounds: 3,
  contextBudget: 8000,
  createdAt: 1000,
  updatedAt: 1000,
};

const testAgents: Record<string, Agent> = {
  'sec-alice': {
    id: 'sec-alice',
    name: 'Alice Sec',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.7,
    maxOutputTokens: 300,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#0ea5e9' },
    createdAt: 1000,
  },
  'sec-bob': {
    id: 'sec-bob',
    name: 'Bob Sec',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.7,
    maxOutputTokens: 300,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#10b981' },
    createdAt: 1000,
  },
};

describe('Blind-First Deliberation Engine', () => {
  it('dispatches participants in parallel with epistemic isolation and registers hypotheses on blackboard', async () => {
    const mock = new MockProvider();
    mock.registerScript('Alice Stance', 'Passkeys provide hardware phishing-resistance and eliminate SIM swap attack vectors entirely.');
    mock.registerScript('Bob Stance', 'Passkeys reduce credential stuffing but cross-ecosystem synchronization requires fallback recovery.');

    const registry = new ProviderRegistry();
    registry.register(mock);

    const session = createGroupChat({
      group: testGroup,
      agents: testAgents,
      providerRegistry: registry,
    });

    const stances = await executeBlindRound(session);

    expect(stances['sec-alice']).toBeDefined();
    expect(stances['sec-bob']).toBeDefined();
    expect(stances['sec-alice'].content.length).toBeGreaterThan(10);
    expect(stances['sec-bob'].content.length).toBeGreaterThan(10);

    // Verify turns logged in conversation
    const turns = session.conversation.turns;
    expect(turns.length).toBe(2);
    expect(turns[0].content).toContain('[Independent Blind Stance]');
    expect(turns[1].content).toContain('[Independent Blind Stance]');

    // Verify blackboard hypotheses created from blind round
    const bbItems = Object.values(session.conversation.blackboard.items);
    expect(bbItems.length).toBeGreaterThanOrEqual(2);
    expect(bbItems.some((item) => item.category === 'hypothesis')).toBe(true);
  });
});
