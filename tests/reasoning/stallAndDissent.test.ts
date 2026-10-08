/**
 * Stall Detection & Dissent Log Tests (Phase 2 - P2.5)
 */

import { describe, it, expect } from 'vitest';
import { detectStall, extractDissentItems } from '../../packages/reasoning/stallAndDissent.ts';
import { Conversation, Turn } from '../../packages/core/types.ts';

function createMockConversationWithTurns(turnsContent: string[]): Conversation {
  const turns: Turn[] = turnsContent.map((content, idx) => ({
    id: `turn-${idx + 1}`,
    conversationId: 'conv-stall',
    selectedModel: 'mock-fast',
    selectedProvider: 'mock',
    speakerId: `agent-${idx % 2}`,
    speakerName: idx % 2 === 0 ? 'Alice' : 'Bob',
    role: 'agent',
    content,
    status: 'completed',
    startedAt: 1000 + idx * 10,
    completedAt: 1005 + idx * 10,
  }));

  return {
    id: 'conv-stall',
    groupId: 'grp-stall',
    groupSnapshot: {
      id: 'grp-stall',
      name: 'Stall Test Group',
      goal: 'Consensus goal',
      agentIds: ['agent-0', 'agent-1'],
      moderatorId: 'agent-0',
      speakerPolicy: 'round-robin',
      terminationPolicy: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
    },
    agentSnapshots: {},
    state: 'running',
    totalTurns: turns.length,
    roundCount: 1,
    totalUsage: { inputTokens: 50, outputTokens: 50, totalTokens: 100, latencyMs: 10, estimatedCost: 0 },
    events: [],
    turns,
    summaries: {},
    blackboard: { items: {}, updatedAt: 1000 },
    dissentLog: [],
    branch: { conversationId: 'conv-stall', branchName: 'main', createdAt: 1000 },
    protocol: 'standard',
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe('Stall Detection and Dissent Logging', () => {
  it('detects circular semantic repetition when agents repeat identical arguments', () => {
    const repetitiveContent = [
      'We must use Kafka for the event streaming backbone because of its disk partition throughput and durability guarantees.',
      'Kafka is the only event streaming backbone with sufficient partition throughput and disk persistence for this architecture.',
      'I agree that Kafka event streaming has high partition throughput and disk durability that satisfies our core requirements.',
      'Kafka partition throughput and durability guarantees are the primary reason we should select this event streaming platform.',
    ];

    const conversation = createMockConversationWithTurns(repetitiveContent);
    const result = detectStall(conversation, { threshold: 0.5, windowSize: 4 });

    expect(result.stalled).toBe(true);
    expect(result.reason).toContain('Circular reasoning detected');
    expect(result.suggestedIntervention).toBeDefined();
  });

  it('does not flag stall when discussion progresses with diverse viewpoints', () => {
    const diverseContent = [
      'We should evaluate Redis Streams for lightweight pub/sub in-memory operations.',
      'Redis Streams lacks distributed offset retention when consumers restart unexpectedly.',
      'Apache Pulsar decouples storage nodes with Apache BookKeeper from serving broker nodes.',
      'BookKeeper operational overhead requires maintaining ZooKeeper clusters in production.',
    ];

    const conversation = createMockConversationWithTurns(diverseContent);
    const result = detectStall(conversation, { threshold: 0.7, windowSize: 4 });

    expect(result.stalled).toBe(false);
  });

  it('extracts structured dissent items from turn text', () => {
    const text = `
I recognize the group is moving towards choosing MongoDB.
[Dissent]: MongoDB document locking under heavy concurrent writes will violate our 99th percentile latency SLA.
[Objection]: The licensing terms of SSPL impose severe legal distribution liabilities.
    `;

    const dissentItems = extractDissentItems(text, 'Database Decision', 'agent-charlie', 'Charlie');
    expect(dissentItems).toHaveLength(2);
    expect(dissentItems[0].objection).toContain('MongoDB document locking');
    expect(dissentItems[0].agentName).toBe('Charlie');
    expect(dissentItems[1].objection).toContain('licensing terms of SSPL');
  });
});
