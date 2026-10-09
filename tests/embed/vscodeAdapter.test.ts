import { describe, it, expect, vi } from 'vitest';
import { VSCodeHostAdapter } from '../../packages/embed/vscodeHost.ts';
import { createGroupChat } from '../../packages/core/orchestrator.ts';
import { MockProvider } from '../../packages/providers/mockProvider.ts';
import { defaultProviderRegistry } from '../../packages/providers/registry.ts';
import { MemoryStorageAdapter } from '../../packages/storage/memoryStorage.ts';
import { Agent, Group } from '../../packages/core/types.ts';

const testGroup: Group = {
  id: 'grp-embed',
  name: 'VS Code Embed Group',
  goal: 'Review code patch',
  agentIds: ['a-1', 'a-2'],
  moderatorId: 'a-2',
  speakerPolicy: 'round-robin',
  terminationPolicy: 'manual',
  createdAt: 1000,
  updatedAt: 1000,
};

const testAgents: Record<string, Agent> = {
  'a-1': {
    id: 'a-1',
    name: 'Dev Lead',
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
  'a-2': {
    id: 'a-2',
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

describe('VS Code Webview & Embed Host Adapter (Phase 3)', () => {
  it('bridges session events and responds to host commands', async () => {
    const mock = new MockProvider();
    mock.registerScript('Turn 1', 'The authentication middleware lacks rate-limiting.');
    defaultProviderRegistry.register(mock);

    const session = createGroupChat({
      group: testGroup,
      agents: testAgents,
      providerRegistry: defaultProviderRegistry,
      storage: new MemoryStorageAdapter(),
    });

    const host = new VSCodeHostAdapter();
    const sentMessages: any[] = [];
    vi.spyOn(host, 'sendToHost').mockImplementation((msg) => {
      sentMessages.push(msg);
    });

    const detach = host.attachSession(session);

    // Initial ready event sent
    expect(host).toBeDefined();

    // Trigger turn and verify state sync to host
    await session.start();
    await session.step();

    const syncMsgs = sentMessages.filter((m) => m.type === 'ROUNDTABLE_STATE_SYNC');
    expect(syncMsgs.length).toBeGreaterThanOrEqual(1);
    const lastSync = syncMsgs[syncMsgs.length - 1];
    expect(lastSync.payload.totalTurns).toBeGreaterThanOrEqual(1);

    // Test code insertion helper
    host.insertCodeToActiveEditor('export const SAFE_RATE_LIMIT = 100;', 'typescript');
    const insertMsg = sentMessages.find((m) => m.type === 'ROUNDTABLE_INSERT_CODE');
    expect(insertMsg).toBeDefined();
    expect(insertMsg.payload.code).toContain('SAFE_RATE_LIMIT');

    detach();
  });
});
