/**
 * Branching & What-If Exploration Tests (Phase 2 - P2.3)
 */

import { describe, it, expect } from 'vitest';
import { createGroupChat } from '../../packages/core/orchestrator.ts';
import { forkConversation, BranchRegistry } from '../../packages/reasoning/branching.ts';
import { Group, Agent } from '../../packages/core/types.ts';
import { MockProvider } from '../../packages/providers/mockProvider.ts';
import { ProviderRegistry } from '../../packages/providers/registry.ts';

const testGroup: Group = {
  id: 'grp-branch',
  name: 'Database Architecture',
  goal: 'Select database engine',
  agentIds: ['agent-alice', 'agent-bob'],
  moderatorId: 'agent-bob',
  speakerPolicy: 'round-robin',
  terminationPolicy: 'manual',
  maxRounds: 5,
  contextBudget: 8000,
  createdAt: 1000,
  updatedAt: 1000,
};

const testAgents: Record<string, Agent> = {
  'agent-alice': {
    id: 'agent-alice',
    name: 'Alice',
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
  'agent-bob': {
    id: 'agent-bob',
    name: 'Bob',
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

describe('Conversation Branching & Forking Engine', () => {
  it('forks conversation at turn 2 and isolates child events from parent', async () => {
    const mock = new MockProvider();
    mock.registerScript('Alice: Turn 1', 'Turn 1: We should use PostgreSQL.');
    mock.registerScript('Bob: Turn 2', 'Turn 2: We need graph query support.');
    mock.registerScript('Alice: Turn 3', 'Turn 3: We can use Apache AGE extension.');
    mock.registerScript('Child: Turn Alternative', 'Alternative path: Let us use Neo4j instead.');

    const registry = new ProviderRegistry();
    registry.register(mock);

    const parentSession = createGroupChat({
      group: testGroup,
      agents: testAgents,
      providerRegistry: registry,
    });

    // Run 3 turns in parent
    await parentSession.step('agent-alice');
    await parentSession.step('agent-bob');
    await parentSession.step('agent-alice');

    expect(parentSession.conversation.turns).toHaveLength(3);
    const turn2 = parentSession.conversation.turns[1];
    expect(turn2).toBeDefined();

    const branchRegistry = new BranchRegistry();

    // Fork at Turn 2
    const childSession = forkConversation(parentSession, {
      forkTurnId: turn2.id,
      newBranchName: 'neo4j-exploration',
      registry: branchRegistry,
    });

    // Verify child retained only Turns 1 and 2
    expect(childSession.conversation.turns).toHaveLength(2);
    expect(childSession.conversation.branch.branchName).toBe('neo4j-exploration');
    expect(childSession.conversation.branch.parentConversationId).toBe(parentSession.conversation.id);

    // Verify lineage in registry
    const lineage = branchRegistry.getLineage(childSession.conversation.id);
    expect(lineage).toHaveLength(1);
    expect(lineage[0].name).toBe('neo4j-exploration');

    // Execute turn in child - parent must remain untouched!
    await childSession.step('agent-bob');
    expect(childSession.conversation.turns).toHaveLength(3);
    expect(parentSession.conversation.turns).toHaveLength(3);
    expect(childSession.conversation.events.length).not.toBe(parentSession.conversation.events.length);
  });
});
