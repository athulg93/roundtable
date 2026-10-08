/**
 * Context Builder and Token Estimator Tests (P1.3, P1.7)
 */

import { describe, it, expect } from 'vitest';
import { ContextBuilder, validateAgentBudget, ContextBudgetError } from '../../packages/core/contextBuilder.ts';
import { CharDivisionTokenEstimator } from '../../packages/core/tokenEstimator.ts';
import { Agent, Conversation, Group } from '../../packages/core/types.ts';

const validAgent: Agent = {
  id: 'agent-1',
  name: 'Architect',
  role: 'participant',
  provider: 'mock',
  model: 'mock-fast',
  rolePrompt: 'Focus on distributed consensus.',
  temperature: 0.7,
  maxOutputTokens: 500,
  contextBudget: 4000,
  timeoutSettings: { firstTokenMs: 5000, totalMs: 15000 },
  visualIdentity: { color: '#0ea5e9' },
};

const dummyConversation = {
  id: 'conv-1',
  groupId: 'g-1',
  groupSnapshot: {
    id: 'g-1',
    name: 'Arch Group',
    goal: 'Select consensus protocol',
    speakerPolicy: 'round-robin',
    terminationPolicy: 'max-rounds',
  } as Group,
  agentSnapshots: {
    'agent-1': validAgent,
    'agent-2': {
      ...validAgent,
      id: 'agent-2',
      name: 'Security Lead',
      rolePrompt: 'Focus on threat model.',
    },
  },
  state: 'running',
  turns: [
    {
      id: 't-1',
      conversationId: 'conv-1',
      speakerId: 'agent-2',
      speakerName: 'Security Lead',
      role: 'agent',
      selectedModel: 'mock',
      selectedProvider: 'mock',
      status: 'completed',
      content: 'We need Byzantine fault tolerance for untrusted nodes.',
      startedAt: 100,
    },
  ],
  summaries: {},
} as unknown as Conversation;

describe('Context Builder and Token Estimation', () => {
  it('token estimator calculates Math.ceil(chars / 4)', () => {
    const estimator = new CharDivisionTokenEstimator(4);
    expect(estimator.estimate('1234')).toBe(1);
    expect(estimator.estimate('12345')).toBe(2);
    expect(estimator.estimate('')).toBe(0);
  });

  it('rejects impossible budgets where output exceeds available budget', () => {
    const invalidAgent: Agent = {
      ...validAgent,
      contextBudget: 1000,
      maxOutputTokens: 900, // Consumes 90%, leaving less than min 25% input reserve
    };

    expect(() => validateAgentBudget(invalidAgent)).toThrow(ContextBudgetError);
  });

  it('assembles unambiguous prompt with role and speaker attribution rules', () => {
    const builder = new ContextBuilder();
    const ctx = builder.build(validAgent, dummyConversation);

    expect(ctx.systemPrompt).toContain('You are Architect.');
    expect(ctx.systemPrompt).toContain('Select consensus protocol');
    expect(ctx.systemPrompt).toContain('DO NOT prepend your response with your name');
    expect(ctx.systemPrompt).toContain('NEVER impersonate');

    // Recent turn from Security Lead is formatted cleanly with speaker identity
    expect(ctx.messages.length).toBe(1);
    expect(ctx.messages[0].content).toContain('[Security Lead]: We need Byzantine fault tolerance');
  });

  it('reserves 20-25% of context budget for output generation', () => {
    const builder = new ContextBuilder();
    const ctx = builder.build(validAgent, dummyConversation);

    // Budget is 4000, 25% is 1000, maxOutputTokens is 500, so reserved is max(500, 1000) = 1000
    expect(ctx.reservedOutputTokens).toBeGreaterThanOrEqual(1000);
  });
});
