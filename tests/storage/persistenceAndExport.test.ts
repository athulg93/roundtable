/**
 * Persistence and Export Tests (P1.9)
 */

import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../../packages/storage/memoryStorage.ts';
import { ExportService } from '../../packages/storage/exportService.ts';
import { Conversation, Group, Agent } from '../../packages/core/types.ts';

const mockGroup: Group = {
  id: 'g-export',
  name: 'Export Test Group',
  goal: 'Verify zero secrets in export',
  agentIds: ['a-1'],
  moderatorId: 'a-1',
  speakerPolicy: 'manual',
  terminationPolicy: 'manual',
  createdAt: 1000,
  updatedAt: 1000,
};

const mockAgent: Agent = {
  id: 'a-1',
  name: 'Security Lead',
  role: 'participant',
  provider: 'mock',
  model: 'mock-fast',
  rolePrompt: 'Audit all outputs',
  temperature: 0.7,
  maxOutputTokens: 500,
  contextBudget: 4000,
  timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
  visualIdentity: { color: '#0ea5e9' },
};

const mockConv: Conversation = {
  id: 'conv-export-1',
  groupId: 'g-export',
  groupSnapshot: mockGroup,
  agentSnapshots: { 'a-1': mockAgent },
  state: 'ended',
  roundCount: 1,
  totalTurns: 1,
  totalUsage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    latencyMs: 120,
    estimatedCost: 0.0003,
  },
  events: [],
  turns: [
    {
      id: 't-1',
      conversationId: 'conv-export-1',
      speakerId: 'a-1',
      speakerName: 'Security Lead',
      role: 'agent',
      selectedModel: 'mock-fast',
      selectedProvider: 'mock',
      status: 'completed',
      content: 'Secrets successfully excluded from state.',
      startedAt: 1000,
      completedAt: 1120,
    },
  ],
  summaries: {
    rollingSummary: 'Discussion confirmed clean export.',
    nextSteps: {
      decisions: ['Approve export schema'],
      actionItems: [{ task: 'Deploy rules', owner: 'DevOps', priority: 'high' }],
      openQuestions: [],
    },
  },
  createdAt: 1000,
  updatedAt: 1200,
};

describe('Storage Adapter & Persistence', () => {
  it('saves and reloads conversations and events', async () => {
    const storage = new MemoryStorageAdapter();
    await storage.saveGroup(mockGroup);
    await storage.saveAgent(mockAgent);
    await storage.saveConversation(mockConv);

    const loadedGroup = await storage.getGroup('g-export');
    expect(loadedGroup?.name).toBe('Export Test Group');

    const loadedAgent = await storage.getAgent('a-1');
    expect(loadedAgent?.name).toBe('Security Lead');

    const loadedConv = await storage.loadConversation('conv-export-1');
    expect(loadedConv?.id).toBe('conv-export-1');
    expect(loadedConv?.turns.length).toBe(1);
  });
});

describe('Export Service Security & Formatting', () => {
  it('generates valid JSON export and ensures NO secret keys exist', () => {
    // Add potentially sensitive fake property
    const testConvWithSecret = {
      ...mockConv,
      apiKey: 'sk-1234567890abcdef',
      clientSecret: 'secret_value_xyz',
    } as unknown as Conversation;

    const jsonStr = ExportService.exportToJson(testConvWithSecret);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('1.0');
    expect(jsonStr).not.toContain('sk-1234567890abcdef');
    expect(jsonStr).not.toContain('secret_value_xyz');
    expect(parsed.conversation.turns[0].content).toContain('Secrets successfully excluded');
  });

  it('generates rich human-readable markdown transcript', () => {
    const md = ExportService.exportToMarkdown(mockConv);
    expect(md).toContain('# Multi-Agent Deliberation Transcript');
    expect(md).toContain('Verify zero secrets in export');
    expect(md).toContain('Security Lead');
    expect(md).toContain('Secrets successfully excluded from state');
    expect(md).toContain('Approve export schema');
  });
});
