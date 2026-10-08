/**
 * Phase 1 End-to-End Acceptance Scenario (Section 4.2)
 * Tests all 10 acceptance checkpoints end-to-end against the headless core engine.
 */

import { describe, it, expect } from 'vitest';
import { Group, Agent } from '../../packages/core/types.ts';
import { createGroupChat } from '../../packages/core/orchestrator.ts';
import { MockProvider } from '../../packages/providers/mockProvider.ts';
import { ProviderRegistry } from '../../packages/providers/registry.ts';
import { MemoryStorageAdapter } from '../../packages/storage/memoryStorage.ts';
import { ExportService } from '../../packages/storage/exportService.ts';

describe('Phase 1 MVP Full Acceptance Scenario (Section 4.2)', () => {
  it('executes all 10 acceptance checkpoints successfully', async () => {
    // 1. Create a group with three participant agents and one moderator, using at least two different models/providers
    const agents: Record<string, Agent> = {
      'agent-arch': {
        id: 'agent-arch',
        name: 'System Architect',
        role: 'participant',
        provider: 'mock-provider-a',
        model: 'model-alpha',
        rolePrompt: 'Focus on distributed message logs and storage partitioning.',
        temperature: 0.7,
        maxOutputTokens: 200,
        contextBudget: 4000,
        timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
        visualIdentity: { color: '#0ea5e9' },
      },
      'agent-sec': {
        id: 'agent-sec',
        name: 'Security Lead',
        role: 'participant',
        provider: 'mock-provider-b',
        model: 'model-beta',
        rolePrompt: 'Focus on zero-trust credential isolation.',
        temperature: 0.5,
        maxOutputTokens: 200,
        contextBudget: 4000,
        timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
        visualIdentity: { color: '#f43f5e' },
      },
      'agent-sre': {
        id: 'agent-sre',
        name: 'SRE Lead',
        role: 'participant',
        provider: 'mock-provider-a',
        model: 'model-gamma',
        rolePrompt: 'Focus on circuit breakers and graceful degraded states.',
        temperature: 0.6,
        maxOutputTokens: 200,
        contextBudget: 4000,
        timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
        visualIdentity: { color: '#10b981' },
      },
      'agent-mod': {
        id: 'agent-mod',
        name: 'Deliberation Moderator',
        role: 'moderator',
        provider: 'mock-provider-b',
        model: 'model-beta',
        rolePrompt: 'Steer deliberation cleanly and conclude when appropriate.',
        temperature: 0.2,
        maxOutputTokens: 200,
        contextBudget: 4000,
        timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
        visualIdentity: { color: '#a855f7' },
      },
    };

    const group: Group = {
      id: 'grp-acceptance',
      name: 'Resilient Multi-Agent Engine Deliberation',
      goal: 'Determine the storage format and failure recovery policy for headless multi-agent runs.',
      agentIds: ['agent-arch', 'agent-sec', 'agent-sre', 'agent-mod'],
      moderatorId: 'agent-mod',
      speakerPolicy: 'moderator-directed',
      terminationPolicy: 'moderator-conclusion',
      maxRounds: 4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockA = new MockProvider({ id: 'mock-provider-a', name: 'Mock Provider A', chunkDelayMs: 0 });
    const mockB = new MockProvider({ id: 'mock-provider-b', name: 'Mock Provider B', chunkDelayMs: 0 });
    const registry = new ProviderRegistry();
    registry.register(mockA);
    registry.register(mockB);

    const storage = new MemoryStorageAdapter();

    const session = createGroupChat({
      group,
      agents,
      storage,
      providerRegistry: registry,
    });

    expect(session.currentState).toBe('idle');

    // 2. Start a moderator-directed conversation
    await session.start();
    expect(session.currentState).toBe('running');

    // 3. Verify streamed output and completed turns written to the event log
    const streamedTokens: string[] = [];
    const unsubToken = session.on('token', (data: { chunk: string }) => {
      streamedTokens.push(data.chunk);
    });

    const turn1 = await session.step();
    expect(turn1).not.toBeNull();
    expect(turn1?.status).toBe('completed');
    expect(session.conversation.turns.length).toBe(1);
    expect(session.conversation.events.some((e) => e.type === 'turn.completed')).toBe(true);
    expect(streamedTokens.length).toBeGreaterThan(0);
    unsubToken();

    // 4. Interject as the user and verify the interjection becomes part of the conversation context
    await session.interject('Remember to verify that all API credentials are excluded from disk.', 'Security Reviewer');
    const userTurn = session.conversation.turns.find((t) => t.role === 'user');
    expect(userTurn).toBeDefined();
    expect(userTurn?.content).toContain('excluded from disk');

    // Verify context builder incorporates user message
    const nextAgent = agents['agent-arch'];
    const ctx = session.contextBuilder.build(nextAgent, session.conversation);
    const hasUserMsg = ctx.messages.some((m) => m.content.includes('excluded from disk'));
    expect(hasUserMsg).toBe(true);

    // 5. Pause, resume, and stop the run; verify state transitions are durable and replayable
    session.pause();
    expect(session.currentState).toBe('paused');

    session.resume();
    expect(session.currentState).toBe('running');

    // Step turn 2 while resumed
    await session.step();
    expect(session.conversation.turns.length).toBe(3); // turn 1 + user interject + turn 2

    // 6. Deliberately cause one provider to fail. Verify retry/recovery behavior and that conversation does not deadlock
    mockA.updateConfig({
      forcedErrorCode: 'unavailable',
      failureCountdown: 1, // Fails on 1st attempt, auto-retries and succeeds
    });

    const recoveryTurn = await session.step();
    expect(recoveryTurn).not.toBeNull();
    expect(recoveryTurn?.status).toBe('completed');
    // Ensure conversation did not deadlock
    expect(session.currentState).toBe('running');
    mockA.updateConfig({ forcedErrorCode: null, failureCountdown: 0 });

    // 7. Force context growth. Verify compression occurs before model exceeds budget
    // Add artificial turns to verify context builder requires compression
    const dummyTurns = session.conversation.turns;
    for (let i = 0; i < 30; i++) {
      dummyTurns.push({
        id: `t-bulk-${i}`,
        conversationId: session.conversation.id,
        speakerId: 'agent-arch',
        speakerName: 'System Architect',
        role: 'agent',
        selectedModel: 'model-alpha',
        selectedProvider: 'mock-provider-a',
        status: 'completed',
        content: `Detailed analysis turn ${i}. We must examine the entire storage layer, transaction logs, snapshotting intervals, memory buffers, network partitions, split-brain scenarios, and failure recoveries in exhaustive technical detail to ensure complete system durability.`,
        startedAt: Date.now(),
      });
    }

    const constrainedAgent: Agent = {
      ...agents['agent-arch'],
      contextBudget: 1500, // Small budget
      maxOutputTokens: 300,
    };
    const compressedCtx = session.contextBuilder.build(constrainedAgent, session.conversation);
    expect(compressedCtx.requiresCompression).toBe(true);
    expect(compressedCtx.turnsNeedingSummary.length).toBeGreaterThan(0);

    // 8. End the conversation. Generate the next-steps summary and detailed summary
    session.stop('Acceptance criteria verified');
    expect(session.currentState).toBe('ended');

    const summaries = await session.summarize();
    expect(summaries.nextSteps).toBeDefined();
    expect(summaries.nextSteps.decisions.length).toBeGreaterThan(0);
    expect(summaries.detailed).toBeDefined();
    expect(session.conversation.summaries.nextSteps).toBeDefined();

    // 9. Reload from persistence. Verify conversation and group/agent configuration restore correctly
    const loadedConv = await storage.loadConversation(session.conversation.id);
    expect(loadedConv).not.toBeNull();
    expect(loadedConv?.id).toBe(session.conversation.id);
    expect(loadedConv?.state).toBe('ended');
    expect(loadedConv?.turns.length).toBe(session.conversation.turns.length);

    // 10. Export the conversation and verify that secrets are absent
    const exportedJson = ExportService.exportToJson(session.conversation);
    expect(exportedJson).not.toContain('apiKey');
    expect(exportedJson).not.toContain('secret');
    expect(exportedJson).toContain('Resilient Multi-Agent Engine Deliberation');

    const exportedMd = ExportService.exportToMarkdown(session.conversation);
    expect(exportedMd).toContain('# Multi-Agent Deliberation Transcript');
    expect(exportedMd).toContain('System Architect');
  });
});
