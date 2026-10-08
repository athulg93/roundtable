/**
 * Deliberation Protocols Preset Tests (Phase 2 - P2.4)
 */

import { describe, it, expect } from 'vitest';
import { createGroupChat } from '../../packages/core/orchestrator.ts';
import { PROTOCOL_PRESETS } from '../../packages/reasoning/protocols.ts';
import { Group, Agent } from '../../packages/core/types.ts';
import { MockProvider } from '../../packages/providers/mockProvider.ts';
import { ProviderRegistry } from '../../packages/providers/registry.ts';

const testGroup: Group = {
  id: 'grp-protocols',
  name: 'Protocol Deliberation',
  goal: 'Should we replace REST with gRPC across all internal microservices?',
  agentIds: ['agent-pro', 'agent-con', 'agent-judge'],
  moderatorId: 'agent-judge',
  speakerPolicy: 'round-robin',
  terminationPolicy: 'manual',
  maxRounds: 5,
  contextBudget: 8000,
  createdAt: 1000,
  updatedAt: 1000,
};

const testAgents: Record<string, Agent> = {
  'agent-pro': {
    id: 'agent-pro',
    name: 'Proponent',
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
  'agent-con': {
    id: 'agent-con',
    name: 'Opponent',
    role: 'participant',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.7,
    maxOutputTokens: 300,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#ef4444' },
    createdAt: 1000,
  },
  'agent-judge': {
    id: 'agent-judge',
    name: 'Arbiter',
    role: 'moderator',
    provider: 'mock',
    model: 'mock-fast',
    temperature: 0.2,
    maxOutputTokens: 300,
    contextBudget: 4000,
    timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
    visualIdentity: { color: '#a855f7' },
    createdAt: 1000,
  },
};

describe('Deliberation Protocols Presets', () => {
  it('enforces Debate protocol turn progression and speaker ordering', async () => {
    const mock = new MockProvider();
    mock.registerScript('Turn 1', 'gRPC multiplexing and Protobuf binary serialization drastically reduce payload size.');
    mock.registerScript('Turn 2', 'Browser debugging and ingress proxies have poor native HTTP/2 trailer support.');
    mock.registerScript('Turn 3', 'Connect-Web and Envoy gRPC-JSON transcoding resolve ingress and browser support.');
    mock.registerScript('Turn 4', 'Operational complexity of Protobuf schema registries outweighs benefits for small services.');
    mock.registerScript('Judge', 'Based on arguments, hybrid adoption with gRPC for internal meshes and REST for edge is optimal.');

    const registry = new ProviderRegistry();
    registry.register(mock);

    const session = createGroupChat({
      group: { ...testGroup, protocol: 'debate' },
      agents: testAgents,
      providerRegistry: registry,
    });

    const participants = [testAgents['agent-pro'], testAgents['agent-con']];

    // Check step 0 -> Proponent
    const next0 = PROTOCOL_PRESETS.debate.determineNextSpeaker(session, participants);
    expect(next0.speakerId).toBe('agent-pro');
    expect(next0.promptPrefix).toContain('AFFIRMATIVE CONSTRUCTIVE');

    await session.step();

    // Check step 1 -> Opponent
    const next1 = PROTOCOL_PRESETS.debate.determineNextSpeaker(session, participants);
    expect(next1.speakerId).toBe('agent-con');
    expect(next1.promptPrefix).toContain('NEGATIVE REBUTTAL');

    await session.step();

    // Check step 2 -> Proponent defense
    const next2 = PROTOCOL_PRESETS.debate.determineNextSpeaker(session, participants);
    expect(next2.speakerId).toBe('agent-pro');
    expect(next2.promptPrefix).toContain('AFFIRMATIVE DEFENSE');

    await session.step();

    // Check step 3 -> Opponent summary
    const next3 = PROTOCOL_PRESETS.debate.determineNextSpeaker(session, participants);
    expect(next3.speakerId).toBe('agent-con');
    expect(next3.promptPrefix).toContain('NEGATIVE SUMMARY');

    await session.step();

    // Check step 4 -> Moderator verdict and concluded
    const next4 = PROTOCOL_PRESETS.debate.determineNextSpeaker(session, participants);
    expect(next4.isConcluded).toBe(true);
    expect(next4.conclusionReason).toContain('Debate protocol completed');
  });

  it('provides Red-Team threat modeling progression', () => {
    const session = createGroupChat({
      group: { ...testGroup, protocol: 'red-team' },
      agents: testAgents,
    });
    const participants = [testAgents['agent-pro'], testAgents['agent-con'], testAgents['agent-judge']];

    const next0 = PROTOCOL_PRESETS['red-team'].determineNextSpeaker(session, participants);
    expect(next0.speakerId).toBe('agent-pro');
    expect(next0.promptPrefix).toContain('SYSTEM PROPOSAL');
  });

  it('provides Pre-Mortem failure analysis progression', () => {
    const session = createGroupChat({
      group: { ...testGroup, protocol: 'pre-mortem' },
      agents: testAgents,
    });
    const participants = [testAgents['agent-pro'], testAgents['agent-con']];

    const next0 = PROTOCOL_PRESETS['pre-mortem'].determineNextSpeaker(session, participants);
    expect(next0.speakerId).toBe('agent-pro');
    expect(next0.promptPrefix).toContain('HYPOTHETICAL FAILURE');
  });
});
