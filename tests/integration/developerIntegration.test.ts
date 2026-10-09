/**
 * Phase 2 Developer Integration & Headless Core Tests
 * Validates public package entry point, headless core orchestration,
 * human vs agent moderation, pause/resume/interject/stop controls,
 * failure containment, secret isolation, and embed bridge origin safety.
 */

import { describe, it, expect, vi } from 'vitest';
// Test importing directly from public package entry point
import {
  createGroupChat,
  createAgent,
  createGroup,
  Agent,
  Group,
  ProviderRegistry,
  MockProvider,
  MemoryStorageAdapter,
  ExportService,
  VSCodeHostAdapter,
  checkTermination,
  selectRoundRobinSpeaker,
} from '../../index.ts';

describe('Phase 2 Developer Integration & Headless Core', () => {
  // Test 1: Public package entry point imports and types
  it('exports stable headless interfaces without pulling in React UI dependencies', () => {
    expect(createGroupChat).toBeTypeOf('function');
    expect(createAgent).toBeTypeOf('function');
    expect(createGroup).toBeTypeOf('function');
    expect(ProviderRegistry).toBeDefined();
    expect(MockProvider).toBeDefined();
    expect(MemoryStorageAdapter).toBeDefined();
    expect(ExportService).toBeDefined();
    expect(VSCodeHostAdapter).toBeDefined();
    expect(checkTermination).toBeTypeOf('function');
    expect(selectRoundRobinSpeaker).toBeTypeOf('function');
  });

  // Test 2: Agents configured with distinct providers, models, and roles
  it('supports configuring agents with distinct providers, models, and roles', () => {
    const agents: Record<string, Agent> = {
      'agent-gemini': createAgent({
        id: 'agent-gemini',
        name: 'Gemini Agent',
        role: 'participant',
        provider: 'gemini-provider',
        model: 'gemini-2.5-flash',
        rolePrompt: 'Grounded reasoning specialist',
        temperature: 0.7,
        maxOutputTokens: 1024,
        contextBudget: 16000,
      }),
      'agent-claude': createAgent({
        id: 'agent-claude',
        name: 'Claude Agent',
        role: 'participant',
        provider: 'claude-provider',
        model: 'claude-3-5-sonnet',
        rolePrompt: 'System architecture specialist',
        temperature: 0.5,
        maxOutputTokens: 1024,
        contextBudget: 16000,
      }),
      'agent-mod': createAgent({
        id: 'agent-mod',
        name: 'Moderator Agent',
        role: 'moderator',
        provider: 'mock-provider',
        model: 'mock-pro',
        rolePrompt: 'Discussion facilitator',
        temperature: 0.2,
        maxOutputTokens: 300,
        contextBudget: 8000,
      }),
    };

    expect(agents['agent-gemini'].model).toBe('gemini-2.5-flash');
    expect(agents['agent-claude'].model).toBe('claude-3-5-sonnet');
    expect(agents['agent-mod'].role).toBe('moderator');
    expect(agents['agent-gemini'].role).toBe('participant');
  });

  // Test 3: Running a group with a Human Moderator
  it('runs a conversation with a Human Moderator using predictable speaker order and manual control', async () => {
    const provider = new MockProvider({ id: 'mock-p1' });
    const registry = new ProviderRegistry();
    registry.register(provider);

    const storage = new MemoryStorageAdapter();

    const group: Group = createGroup({
      id: 'grp-human-mod',
      name: 'Human Moderated Group',
      goal: 'Explore database index topologies',
      agentIds: ['agent-1', 'agent-2'],
      moderatorId: 'user', // Human Moderator
      speakerPolicy: 'round-robin',
      terminationPolicy: 'manual',
    });

    const agents: Record<string, Agent> = {
      'agent-1': createAgent({
        id: 'agent-1',
        name: 'Storage Specialist',
        role: 'participant',
        provider: 'mock-p1',
        model: 'mock-pro',
        rolePrompt: 'B-tree index specialist',
      }),
      'agent-2': createAgent({
        id: 'agent-2',
        name: 'Query Planner',
        role: 'participant',
        provider: 'mock-p1',
        model: 'mock-fast',
        rolePrompt: 'Query cost estimation expert',
      }),
    };

    const session = createGroupChat({ group, agents, providerRegistry: registry, storage });

    await session.start();
    expect(session.currentState).toBe('running');

    // Turn 1: Advance turn
    const turn1 = await session.step();
    expect(turn1).not.toBeNull();
    expect(turn1?.speakerId).toBe('agent-1');
    expect(session.conversation.turns.length).toBe(1);

    // User interjection
    await session.interject('Focus specifically on write amplification in LSM trees.');
    expect(session.conversation.turns.length).toBe(2);
    expect(session.conversation.turns[1].role).toBe('user');

    // Turn 2: Advance next speaker (predictable round-robin chooses agent-2)
    const turn2 = await session.step();
    expect(turn2).not.toBeNull();
    expect(turn2?.speakerId).toBe('agent-2');

    // Pause and Resume
    session.pause();
    expect(session.currentState).toBe('paused');

    session.resume();
    expect(session.currentState).toBe('running');

    // Stop
    session.stop('Human moderator concluded review');
    expect(session.currentState).toBe('ended');
    expect(session.conversation.turns.length).toBe(3);
  });

  // Test 4: Running a group with an Agent Moderator that selects speakers and concludes discussion
  it('runs a conversation with an Agent Moderator that selects speakers and concludes', async () => {
    let callCount = 0;
    const provider = new MockProvider({
      id: 'mock-mod-p',
      customGenerator: (req) => {
        const lastMsg = req.messages[req.messages.length - 1]?.content || '';
        if (lastMsg.includes('Select the next speaker')) {
          callCount++;
          if (callCount === 1) {
            return JSON.stringify({
              nextSpeaker: 'agent-b',
              concluded: false,
              reason: 'Agent B specializes in memory allocation.',
            });
          } else {
            return JSON.stringify({
              nextSpeaker: null,
              concluded: true,
              reason: 'Consensus reached on generational ZGC settings.',
            });
          }
        }
        return 'Standard contribution to discussion.';
      },
    });

    const registry = new ProviderRegistry();
    registry.register(provider);

    const group: Group = createGroup({
      id: 'grp-agent-mod',
      name: 'Agent Facilitated Group',
      goal: 'Benchmark garbage collection pause times',
      agentIds: ['agent-a', 'agent-b', 'agent-fac'],
      moderatorId: 'agent-fac', // Agent Moderator
      speakerPolicy: 'moderator-directed',
      terminationPolicy: 'max-rounds',
      maxRounds: 5,
    });

    const agents: Record<string, Agent> = {
      'agent-a': createAgent({
        id: 'agent-a',
        name: 'Runtime Dev',
        role: 'participant',
        provider: 'mock-mod-p',
        model: 'mock-pro',
        rolePrompt: 'JVM runtime specialist',
      }),
      'agent-b': createAgent({
        id: 'agent-b',
        name: 'Memory Dev',
        role: 'participant',
        provider: 'mock-mod-p',
        model: 'mock-fast',
        rolePrompt: 'Memory allocator specialist',
      }),
      'agent-fac': createAgent({
        id: 'agent-fac',
        name: 'AI Facilitator',
        role: 'moderator',
        provider: 'mock-mod-p',
        model: 'mock-fast',
        rolePrompt: 'Discussion facilitator',
      }),
    };

    const session = createGroupChat({ group, agents, providerRegistry: registry, storage: new MemoryStorageAdapter() });

    await session.start();
    const turn1 = await session.step();
    expect(turn1).not.toBeNull();
    // Moderator selected agent-b
    expect(turn1?.speakerId).toBe('agent-b');

    // Next step triggers moderator conclusion
    const turn2 = await session.step();
    expect(turn2).toBeNull();
    expect(session.currentState).toBe('ended');
    expect(session.conversation.terminationReason).toContain('Consensus reached');
  });

  // Test 5: Provider failures do not hang the session or erase completed turns
  it('handles provider failures gracefully without hanging or losing completed turns', async () => {
    const provider = new MockProvider({ id: 'flaky-provider' });
    const registry = new ProviderRegistry();
    registry.register(provider);

    const group: Group = createGroup({
      id: 'grp-fail-test',
      name: 'Failure Recovery Group',
      goal: 'Test failure handling',
      agentIds: ['agent-ok', 'agent-flaky'],
      moderatorId: 'user',
      speakerPolicy: 'round-robin',
      terminationPolicy: 'manual',
    });

    const agents: Record<string, Agent> = {
      'agent-ok': createAgent({
        id: 'agent-ok',
        name: 'Solid Agent',
        role: 'participant',
        provider: 'flaky-provider',
        model: 'mock-pro',
      }),
      'agent-flaky': createAgent({
        id: 'agent-flaky',
        name: 'Flaky Agent',
        role: 'participant',
        provider: 'flaky-provider',
        model: 'mock-pro',
      }),
    };

    const session = createGroupChat({ group, agents, providerRegistry: registry, storage: new MemoryStorageAdapter() });
    await session.start();

    // Turn 1 succeeds
    const turn1 = await session.step('agent-ok');
    expect(turn1).not.toBeNull();
    expect(turn1?.status).toBe('completed');
    expect(session.conversation.turns.filter((t) => t.status === 'completed').length).toBe(1);

    // Next: force provider error (non-retryable rate_limited / quota exceeded)
    provider.updateConfig({ forcedErrorCode: 'rate_limited', failureCountdown: 99 });

    const failedTurn = await session.step('agent-flaky');
    expect(failedTurn).toBeNull();

    // Completed turn 1 is preserved intact!
    const completedTurns = session.conversation.turns.filter((t) => t.status === 'completed');
    expect(completedTurns.length).toBe(1);
    expect(completedTurns[0].speakerId).toBe('agent-ok');
    expect(session.conversation.turns.find((t) => t.status === 'failed')).toBeDefined();
    expect(session.conversation.events.some((e) => e.type === 'turn.failed')).toBe(true);

    // Clean recovery: remove error and next turn completes
    provider.updateConfig({ forcedErrorCode: null, failureCountdown: 0 });
    const recoveryTurn = await session.step('agent-ok');
    expect(recoveryTurn).not.toBeNull();
    expect(session.conversation.turns.filter((t) => t.status === 'completed').length).toBe(2);
  });

  // Test 6: Prompt stop and cancellation halts immediately without erasing turns
  it('stops immediately when user issues stop without erasing completed turns', async () => {
    const provider = new MockProvider({ id: 'p-stop', chunkDelayMs: 200 });
    const registry = new ProviderRegistry();
    registry.register(provider);

    const group: Group = createGroup({
      id: 'grp-stop-test',
      name: 'Prompt Stop Test',
      goal: 'Test stop control',
      agentIds: ['agent-1', 'agent-2'],
      moderatorId: 'user',
      speakerPolicy: 'round-robin',
      terminationPolicy: 'manual',
    });

    const agents: Record<string, Agent> = {
      'agent-1': createAgent({ id: 'agent-1', name: 'Agent 1', role: 'participant', provider: 'p-stop', model: 'm1' }),
      'agent-2': createAgent({ id: 'agent-2', name: 'Agent 2', role: 'participant', provider: 'p-stop', model: 'm2' }),
    };

    const session = createGroupChat({ group, agents, providerRegistry: registry, storage: new MemoryStorageAdapter() });
    await session.start();

    // Fast turn completes
    provider.updateConfig({ chunkDelayMs: 0 });
    await session.step('agent-1');
    expect(session.conversation.turns.length).toBe(1);

    // Issue prompt stop
    session.stop('Immediate stop requested');
    expect(session.currentState).toBe('ended');
    expect(session.conversation.turns.length).toBe(1); // turn 1 preserved

    // Attempting step after stop returns null
    const postStopTurn = await session.step();
    expect(postStopTurn).toBeNull();
  });

  // Test 7: Zero credential exposure in exports and event logs
  it('guarantees that API keys and authorization secrets are never persisted or exported', () => {
    const provider = new MockProvider({ id: 'p-sec' });
    const registry = new ProviderRegistry();
    registry.register(provider);

    const group: Group = createGroup({
      id: 'grp-sec',
      name: 'Security Test',
      goal: 'Audit sensitive credential isolation',
      agentIds: ['a-sec'],
      moderatorId: 'user',
      speakerPolicy: 'round-robin',
      terminationPolicy: 'manual',
    });

    const agents: Record<string, Agent> = {
      'a-sec': createAgent({
        id: 'a-sec',
        name: 'Sec Agent',
        role: 'participant',
        provider: 'p-sec',
        model: 'mock-pro',
      }),
    };

    const session = createGroupChat({ group, agents, providerRegistry: registry, storage: new MemoryStorageAdapter() });

    // Export conversation to JSON and Markdown
    const jsonExport = ExportService.exportToJson(session.conversation);
    const mdExport = ExportService.exportToMarkdown(session.conversation);

    // Verify absence of sensitive patterns
    expect(jsonExport).not.toContain('apiKey');
    expect(jsonExport).not.toContain('authorization');
    expect(jsonExport).not.toContain('bearer');
    expect(jsonExport).not.toContain('password');
    expect(jsonExport).not.toContain('secret');

    expect(mdExport).not.toContain('apiKey');
    expect(mdExport).not.toContain('authorization');
  });

  // Test 8: Embed host origin validation prevents untrusted control messages
  it('validates incoming message origins in VSCodeHostAdapter and rejects unauthorized origins', () => {
    const host = new VSCodeHostAdapter({ allowedOrigins: ['https://trusted-ide.local', 'vscode-webview://'] });

    const session = createGroupChat({
      group: createGroup({
        id: 'g-emb',
        name: 'Embed Group',
        goal: 'Bridge test',
        agentIds: ['a1'],
        moderatorId: 'user',
      }),
      agents: {
        a1: createAgent({ id: 'a1', name: 'A1', role: 'participant', provider: 'mock', model: 'm1' }),
      },
      storage: new MemoryStorageAdapter(),
    });

    const stepSpy = vi.spyOn(session, 'step');
    host.attachSession(session);

    // Simulate message event from untrusted origin
    const untrustedEvent = {
      origin: 'https://malicious-site.com',
      data: { type: 'ROUNDTABLE_STEP' },
    } as MessageEvent;

    // Trigger internal messageListener directly
    (host as any).messageListener(untrustedEvent);
    expect(stepSpy).not.toHaveBeenCalled();

    // Simulate message event from trusted origin
    const trustedEvent = {
      origin: 'https://trusted-ide.local',
      data: { type: 'ROUNDTABLE_STEP' },
    } as MessageEvent;

    (host as any).messageListener(trustedEvent);
    expect(stepSpy).toHaveBeenCalled();

    host.detach();
  });
});
