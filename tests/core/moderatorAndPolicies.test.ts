/**
 * Moderator and Policy Tests (P1.4, P1.5)
 */

import { describe, it, expect } from 'vitest';
import {
  parseModeratorDecision,
  buildModeratorRepairPrompt,
  getDeterministicFallbackDecision,
} from '../../packages/core/moderator.ts';
import {
  checkTermination,
  selectRoundRobinSpeaker,
  DEFAULT_HARD_TURN_LIMIT,
} from '../../packages/core/policies.ts';
import { Conversation, Group, Agent } from '../../packages/core/types.ts';

const validParticipantIds = ['agent-alice', 'agent-bob', 'agent-charlie'];

describe('Moderator Decision Validation and Repair', () => {
  it('parses valid speaker selection JSON correctly', () => {
    const raw = JSON.stringify({
      nextSpeaker: 'agent-bob',
      concluded: false,
      reason: 'Needs security review.',
    });

    const res = parseModeratorDecision(raw, validParticipantIds);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.decision.nextSpeaker).toBe('agent-bob');
      expect(res.decision.concluded).toBe(false);
      expect(res.decision.reason).toBe('Needs security review.');
    }
  });

  it('parses valid conclusion JSON correctly', () => {
    const raw = `\`\`\`json
    {
      "concluded": true,
      "reason": "Consensus on event sourcing has been finalized."
    }
    \`\`\``;

    const res = parseModeratorDecision(raw, validParticipantIds);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.decision.concluded).toBe(true);
      expect(res.decision.nextSpeaker).toBeUndefined();
    }
  });

  it('rejects invalid JSON or unknown speaker IDs and provides error message', () => {
    const invalidSpeaker = JSON.stringify({
      nextSpeaker: 'unknown-agent-id',
      concluded: false,
      reason: 'Testing',
    });
    const res1 = parseModeratorDecision(invalidSpeaker, validParticipantIds);
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.error).toContain('unknown-agent-id');
    }

    const unparseable = 'I vote for Bob to speak next!';
    const res2 = parseModeratorDecision(unparseable, validParticipantIds);
    expect(res2.success).toBe(false);
  });

  it('generates a structured repair prompt', () => {
    const repair = buildModeratorRepairPrompt('I vote for Bob', 'Output is not valid JSON', validParticipantIds);
    expect(repair).toContain('Your previous response could not be validated');
    expect(repair).toContain('agent-alice');
    expect(repair).toContain('agent-bob');
  });

  it('deterministic fallback prevents deadlock when moderator fails', () => {
    const fallback1 = getDeterministicFallbackDecision(validParticipantIds, undefined);
    expect(fallback1.nextSpeaker).toBe('agent-alice');
    expect(fallback1.concluded).toBe(false);

    const fallback2 = getDeterministicFallbackDecision(validParticipantIds, 'agent-alice');
    expect(fallback2.nextSpeaker).toBe('agent-bob');

    const fallback3 = getDeterministicFallbackDecision(validParticipantIds, 'agent-charlie');
    expect(fallback3.nextSpeaker).toBe('agent-alice'); // wraps around safely
  });
});

describe('Policies and Turn Ceilings', () => {
  it('selectRoundRobinSpeaker advances through participant IDs in order', () => {
    const turns: Conversation['turns'] = [
      {
        id: 't-1',
        conversationId: 'c-1',
        speakerId: 'agent-alice',
        speakerName: 'Alice',
        role: 'agent',
        selectedModel: 'mock',
        selectedProvider: 'mock',
        status: 'completed',
        content: 'Hello',
        startedAt: 100,
      },
    ];

    const next1 = selectRoundRobinSpeaker(validParticipantIds, turns);
    expect(next1).toBe('agent-bob');

    turns.push({
      id: 't-2',
      conversationId: 'c-1',
      speakerId: 'agent-bob',
      speakerName: 'Bob',
      role: 'agent',
      selectedModel: 'mock',
      selectedProvider: 'mock',
      status: 'completed',
      content: 'Reviewing',
      startedAt: 200,
    });

    const next2 = selectRoundRobinSpeaker(validParticipantIds, turns);
    expect(next2).toBe('agent-charlie');
  });

  it('enforces hard safety turn limit regardless of policy', () => {
    const dummyConv = {
      id: 'c-1',
      groupId: 'g-1',
      groupSnapshot: { speakerPolicy: 'round-robin', terminationPolicy: 'manual' } as Group,
      agentSnapshots: {} as Record<string, Agent>,
      state: 'running',
      roundCount: 10,
      totalTurns: DEFAULT_HARD_TURN_LIMIT,
      totalUsage: { totalTokens: 1000 },
      turns: [],
    } as unknown as Conversation;

    const term = checkTermination(dummyConv);
    expect(term.terminate).toBe(true);
    expect(term.reason).toContain('Hard safety limit');
  });
});
