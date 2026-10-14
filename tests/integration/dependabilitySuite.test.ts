/**
 * Dependability Suite: Provider Persistence/Routing & Export/Embed Boundaries
 * Automated tests verifying rock-solid provider resolution, storage persistence,
 * strict origin/schema embed boundaries, and comprehensive secret redaction.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ProviderRegistry,
  MockProvider,
  createConfiguredAdapter,
  ProviderConfig,
} from '../../packages/providers/index.ts';
import {
  MemoryStorageAdapter,
  ExportService,
  LocalStorageAdapter,
} from '../../packages/storage/index.ts';
import {
  VSCodeHostAdapter,
  EmbedTransport,
  RoundtableToHostMessage,
} from '../../packages/embed/index.ts';
import { createGroupChat, GroupChatSession } from '../../packages/core/orchestrator.ts';
import { Agent, Group, Conversation } from '../../packages/core/types.ts';
import { createAgent, createGroup } from '../../packages/core/builders.ts';

describe('1. Provider Persistence and Routing Dependability', () => {
  it('resolves canonical provider aliases and model-based routes', () => {
    const registry = new ProviderRegistry();

    // Alias checks
    const openai = registry.resolve('openai');
    expect(openai).toBeDefined();
    expect(openai.id).toBe('openai-compatible');

    const claude = registry.resolve('claude');
    expect(claude).toBeDefined();
    expect(claude.id).toBe('anthropic');

    const google = registry.resolve('google');
    expect(google).toBeDefined();
    expect(google.id).toBe('gemini');

    // Model-based pattern routing
    const gptModelResolved = registry.resolve(undefined, 'gpt-4o-mini');
    expect(gptModelResolved.id).toBe('openai-compatible');

    const claudeModelResolved = registry.resolve(undefined, 'claude-3-5-sonnet');
    expect(claudeModelResolved.id).toBe('anthropic');

    const geminiModelResolved = registry.resolve(undefined, 'gemini-2.5-flash');
    expect(geminiModelResolved.id).toBe('gemini');
  });

  it('dynamically instantiates presets on demand (ollama, lmstudio, etc.)', () => {
    const registry = new ProviderRegistry();

    const ollama = registry.resolve('ollama');
    expect(ollama).toBeDefined();
    expect(ollama.id).toBe('ollama');

    const lmstudio = registry.resolve('lmstudio');
    expect(lmstudio).toBeDefined();
    expect(lmstudio.id).toBe('lmstudio');
  });

  it('persists and reloads non-secret ProviderConfig across storage engines', async () => {
    const memory = new MemoryStorageAdapter();

    const customOllamaConfig: ProviderConfig = {
      id: 'local-ollama-cluster',
      name: 'Local Ollama Cluster',
      type: 'ollama',
      baseUrl: 'http://192.168.1.100:11434/v1',
      defaultModel: 'llama3.2:3b',
      fallbackProviderId: 'mock',
    };

    await memory.saveProviderConfig(customOllamaConfig);

    const retrieved = await memory.getProviderConfig('local-ollama-cluster');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.baseUrl).toBe('http://192.168.1.100:11434/v1');
    expect(retrieved?.fallbackProviderId).toBe('mock');

    const allConfigs = await memory.listProviderConfigs();
    expect(allConfigs.length).toBe(1);

    // Register config in ProviderRegistry and verify adapter resolution
    const registry = new ProviderRegistry();
    registry.registerConfig(retrieved!);

    const resolved = registry.resolve('local-ollama-cluster');
    expect(resolved).toBeDefined();
    expect(resolved.id).toBe('local-ollama-cluster');

    // Delete config
    await memory.deleteProviderConfig('local-ollama-cluster');
    const afterDelete = await memory.getProviderConfig('local-ollama-cluster');
    expect(afterDelete).toBeNull();
  });

  it('routes to agent fallbackProvider when primary provider suffers non-retryable failure', async () => {
    const registry = new ProviderRegistry();

    // Primary provider that simulates hard auth / 401 failure
    const deadProvider = new MockProvider({ id: 'failing-primary' });
    deadProvider.updateConfig({ forcedErrorCode: 'auth', failureCountdown: 99 });
    registry.register(deadProvider);

    // Fallback backup provider that succeeds
    const backupProvider = new MockProvider({
      id: 'reliable-backup',
      customGenerator: () => 'Resilient response delivered via fallback provider route.',
    });
    registry.register(backupProvider);


    const group = createGroup({
      id: 'grp-fallback-test',
      name: 'Fallback Routing Group',
      goal: 'Verify fallback routing',
      agentIds: ['agent-resilient'],
      moderatorId: 'user',
      speakerPolicy: 'manual',
    });

    const agent = createAgent({
      id: 'agent-resilient',
      name: 'Resilient Agent',
      role: 'participant',
      provider: 'failing-primary',
      model: 'primary-model',
      fallbackProvider: 'reliable-backup',
      fallbackModel: 'mock-fast',
    });

    const session = createGroupChat({
      group,
      agents: { 'agent-resilient': agent },
      providerRegistry: registry,
      storage: new MemoryStorageAdapter(),
    });

    await session.start();
    const turn = await session.step('agent-resilient');

    expect(turn).not.toBeNull();
    expect(turn?.status).toBe('completed');
    expect(turn?.content).toContain('Resilient response delivered via fallback provider route.');
  });
});

describe('2. Tightened Export Boundaries Dependability', () => {
  const dummyConv: Conversation = {
    id: 'conv-tight-export',
    groupId: 'grp-test',
    groupSnapshot: createGroup({ id: 'grp-test', name: 'Security Audit Group', goal: 'Data leakage audit' }),
    agentSnapshots: {
      'agent-auditor': createAgent({ id: 'agent-auditor', name: 'Auditor', provider: 'mock', model: 'mock-fast' }),
    },
    state: 'ended',
    roundCount: 1,
    totalTurns: 1,
    totalUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200, latencyMs: 90, estimatedCost: 0.0001 },
    events: [],
    turns: [
      {
        id: 'turn-1',
        conversationId: 'conv-tight-export',
        speakerId: 'agent-auditor',
        speakerName: 'Auditor',
        role: 'agent',
        selectedModel: 'mock-fast',
        selectedProvider: 'mock',
        status: 'completed',
        content: 'Accidentally mentioned API key sk-live-112233445566778899aabbcc and Bearer eyJhbGciOiJIUzI1NiJ9 in dialogue.',
        startedAt: 1000,
        completedAt: 1090,
      },
    ],
    summaries: {
      rollingSummary: 'Token sk-ant-api03-abcdef1234567890abcdef was mentioned during prompt engineering.',
    },
    blackboard: { items: {}, updatedAt: 1000 },
    dissentLog: [],
    branch: { conversationId: 'conv-tight-export', branchName: 'main', createdAt: 1000 },
    protocol: 'standard',
    createdAt: 1000,
    updatedAt: 1090,
  };

  it('redacts secret keys and regex credential patterns in deep conversation text', () => {
    // Add raw secret property keys as well
    const polluted = {
      ...dummyConv,
      apiKey: 'sk-998877665544332211',
      clientSecret: 'super-secret-pass',
      internalAuthToken: 'bearer-xyz',
    } as any;

    const exported = ExportService.sanitizeForExport(polluted) as { conversation: any };
    const json = JSON.stringify(exported);

    // Key stripping
    expect(exported.conversation.apiKey).toBeUndefined();
    expect(exported.conversation.clientSecret).toBeUndefined();
    expect(exported.conversation.internalAuthToken).toBeUndefined();

    // String value pattern redaction
    expect(json).not.toContain('sk-live-112233445566778899aabbcc');
    expect(json).not.toContain('sk-ant-api03-abcdef1234567890abcdef');
    expect(json).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(json).toContain('[REDACTED_API_KEY]');
    expect(json).toContain('Bearer [REDACTED_TOKEN]');

    // Essential token metrics preserved
    expect(exported.conversation.totalUsage.totalTokens).toBe(200);
    expect(exported.conversation.totalUsage.inputTokens).toBe(120);
    expect(exported.conversation.totalUsage.outputTokens).toBe(80);
  });


  it('generates a typed ExportedSessionBundle with verifiable metadata', () => {
    const bundle = ExportService.exportBundle(dummyConv);

    expect(bundle.formatVersion).toBe('1.1');
    expect(bundle.metadata.sanitized).toBe(true);
    expect(bundle.metadata.conversationId).toBe('conv-tight-export');
    expect(bundle.metadata.groupName).toBe('Security Audit Group');
    expect(bundle.transcriptMarkdown).toContain('# Multi-Agent Deliberation Transcript');
    expect(bundle.transcriptMarkdown).toContain('[REDACTED_API_KEY]');

    const validation = ExportService.validateExportBundle(bundle);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('flags unredacted credentials or corrupted structures during bundle validation', () => {
    const corruptedBundle = {
      formatVersion: '1.1',
      conversation: {
        id: 'bad-conv',
        // Missing groupSnapshot and turns
      },
    };
    const invalidRes = ExportService.validateExportBundle(corruptedBundle);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.errors.length).toBeGreaterThan(0);

    const leakingBundle = {
      formatVersion: '1.1',
      conversation: {
        id: 'leaking-conv',
        groupSnapshot: { name: 'Leak Group' },
        turns: [{ content: 'Unsanitized key sk-123456789012345678901234' }],
      },
    };
    const leakValidation = ExportService.validateExportBundle(leakingBundle);
    expect(leakValidation.valid).toBe(false);
    expect(leakValidation.errors.some((e) => e.includes('sensitive patterns'))).toBe(true);
  });
});

describe('3. Tightened Embed Boundaries Dependability', () => {
  it('rejects postMessages from unauthorized origins when allowedOrigins is configured', () => {
    const host = new VSCodeHostAdapter({
      allowedOrigins: ['https://trusted-editor.com'],
    });

    const sentMessages: RoundtableToHostMessage[] = [];
    vi.spyOn(host, 'sendToHost').mockImplementation((msg) => {
      sentMessages.push(msg);
    });

    // Simulate incoming message from rogue origin
    (host as any).processIncomingMessage(
      { type: 'ROUNDTABLE_STEP' },
      'https://malicious-origin.com'
    );

    const errorMsg = sentMessages.find((m) => m.type === 'ROUNDTABLE_ERROR');
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.payload && 'code' in errorMsg.payload && errorMsg.payload.code).toBe('UNTRUSTED_ORIGIN');
  });

  it('rejects malformed payloads with schema error', () => {
    const host = new VSCodeHostAdapter({
      allowedOrigins: ['https://trusted.com'],
    });

    const sentMessages: RoundtableToHostMessage[] = [];
    vi.spyOn(host, 'sendToHost').mockImplementation((msg) => {
      sentMessages.push(msg);
    });

    // Empty text in interject
    (host as any).processIncomingMessage(
      { type: 'ROUNDTABLE_INTERJECT', payload: { text: '' }, messageId: 'msg-1' },
      'https://trusted.com'
    );

    const errorMsg = sentMessages.find((m) => m.type === 'ROUNDTABLE_ERROR');
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.payload && 'code' in errorMsg.payload && errorMsg.payload.code).toBe('INVALID_PAYLOAD');
  });

  it('enforces auth token validation when authToken is configured', () => {
    const host = new VSCodeHostAdapter({
      allowedOrigins: ['https://trusted.com'],
      authToken: 'secret-embed-token-123',
    });

    const sentMessages: RoundtableToHostMessage[] = [];
    vi.spyOn(host, 'sendToHost').mockImplementation((msg) => {
      sentMessages.push(msg);
    });

    // Message without matching token
    (host as any).processIncomingMessage(
      { type: 'ROUNDTABLE_PAUSE', messageId: 'msg-2' },
      'https://trusted.com'
    );

    const errorMsg = sentMessages.find((m) => m.type === 'ROUNDTABLE_ERROR');
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.payload && 'code' in errorMsg.payload && errorMsg.payload.code).toBe('UNAUTHORIZED');
  });

  it('acknowledges commands with ROUNDTABLE_ACK and responds to ROUNDTABLE_PING', async () => {
    const group = createGroup({ id: 'grp-ack', name: 'Ack Test', goal: 'Test ack' });
    const agents = {
      'agent-1': createAgent({ id: 'agent-1', name: 'Agent 1', provider: 'mock', model: 'mock-fast' }),
    };
    const session = createGroupChat({ group, agents });

    const host = new VSCodeHostAdapter({
      allowedOrigins: ['https://trusted.com'],
    });

    const sentMessages: RoundtableToHostMessage[] = [];
    vi.spyOn(host, 'sendToHost').mockImplementation((msg) => {
      sentMessages.push(msg);
    });

    host.attachSession(session, { allowedOrigins: ['https://trusted.com'] });

    // Send valid step command with messageId
    (host as any).processIncomingMessage(
      { type: 'ROUNDTABLE_STEP', messageId: 'step-req-999' },
      'https://trusted.com'
    );

    const ackMsg = sentMessages.find((m) => m.type === 'ROUNDTABLE_ACK');
    expect(ackMsg).toBeDefined();
    expect(ackMsg?.payload && 'messageId' in ackMsg.payload && ackMsg.payload.messageId).toBe('step-req-999');

    // Ping / Pong
    (host as any).processIncomingMessage(
      { type: 'ROUNDTABLE_PING', messageId: 'ping-123' },
      'https://trusted.com'
    );

    const pongMsg = sentMessages.find((m) => m.type === 'ROUNDTABLE_PONG');
    expect(pongMsg).toBeDefined();
    expect(pongMsg?.payload && 'messageId' in pongMsg.payload && pongMsg.payload.messageId).toBe('ping-123');
  });

  it('supports custom EmbedTransport bridges without window or DOM dependency', () => {
    const capturedToHost: RoundtableToHostMessage[] = [];
    let hostHandler: ((msg: unknown, origin?: string) => void) | null = null;

    const mockTransport: EmbedTransport = {
      postMessage: (msg) => capturedToHost.push(msg),
      onMessage: (handler) => {
        hostHandler = handler;
        return () => { hostHandler = null; };
      },
    };

    const host = new VSCodeHostAdapter({ transport: mockTransport });
    const group = createGroup({ id: 'grp-tr', name: 'Transport Group', goal: 'Transport test' });
    const agents = { 'a-tr': createAgent({ id: 'a-tr', name: 'A', provider: 'mock', model: 'mock-fast' }) };
    const session = createGroupChat({ group, agents });

    const detach = host.attachSession(session, { transport: mockTransport });

    // Host sends ping through transport bridge
    expect(hostHandler).not.toBeNull();
    hostHandler!({ type: 'ROUNDTABLE_PING', messageId: 'bridge-ping' }, 'worker-origin');

    const pong = capturedToHost.find((m) => m.type === 'ROUNDTABLE_PONG');
    expect(pong).toBeDefined();

    detach();
    expect(hostHandler).toBeNull();
  });
});
