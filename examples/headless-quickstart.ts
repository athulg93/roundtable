/**
 * Minimal Headless Integration Example (Phase 2)
 * Demonstrates how an external developer integrates the Roundtable library
 * without any UI or browser dependencies.
 *
 * To run:
 * npx tsx examples/headless-quickstart.ts
 */

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
} from '../index.ts';

async function main() {
  console.log('🚀 Starting Headless Roundtable Deliberation...\n');

  // 1. Configure agents with distinct roles and providers using createAgent helper
  const agents: Record<string, Agent> = {
    'agent-architect': createAgent({
      id: 'agent-architect',
      name: 'System Architect',
      role: 'participant',
      provider: 'mock-frontier',
      model: 'claude-3-5-sonnet',
      rolePrompt: 'Senior Distributed Systems Architect. Prioritize composability and reliability.',
      temperature: 0.7,
      maxOutputTokens: 500,
      contextBudget: 8000,
    }),
    'agent-security': createAgent({
      id: 'agent-security',
      name: 'Security Engineer',
      role: 'participant',
      provider: 'mock-frontier',
      model: 'gpt-4o',
      rolePrompt: 'Application Security Engineer. Enforce zero credential leakage and defense-in-depth.',
      temperature: 0.5,
      maxOutputTokens: 500,
      contextBudget: 8000,
    }),
    'agent-moderator': createAgent({
      id: 'agent-moderator',
      name: 'Discussion Facilitator',
      role: 'moderator',
      provider: 'mock-frontier',
      model: 'gemini-2.5-flash',
      rolePrompt: 'Facilitator. Guide participants toward the goal, select next speakers, and conclude when resolved.',
      temperature: 0.2,
      maxOutputTokens: 300,
      contextBudget: 8000,
    }),
  };

  // 2. Define the group topic and moderation choice using createGroup helper
  // Option A: Human moderator -> moderatorId = 'user'
  // Option B: Agent moderator -> moderatorId = 'agent-moderator'
  const group: Group = createGroup({
    id: 'grp-headless-demo',
    name: 'Zero-Trust Architecture Deliberation',
    goal: 'Design a resilient event-sourced state machine that prevents secret leakage across providers.',
    agentIds: ['agent-architect', 'agent-security', 'agent-moderator'],
    moderatorId: 'agent-moderator', // Or 'user' for human moderation
    speakerPolicy: 'moderator-directed',
    terminationPolicy: 'max-rounds',
    maxRounds: 3,
  });

  // 3. Connect Provider Registry & Storage
  const providers = new ProviderRegistry();
  const mockProvider = new MockProvider({ id: 'mock-frontier', name: 'Mock Frontier Models' });
  providers.register(mockProvider);

  const storage = new MemoryStorageAdapter();

  // 4. Instantiate the Headless Session
  const session = createGroupChat({
    group,
    agents,
    providerRegistry: providers,
    storage,
  });

  // 5. Subscribe to conversation events
  session.on('turn.started', (evt) => {
    console.log(`[Turn Started] ${evt.payload.speakerName} (${evt.payload.model})`);
  });

  session.on('token', (data) => {
    process.stdout.write(data.chunk);
  });

  session.on('turn.completed', () => {
    console.log('\n--- Turn Finished ---\n');
  });

  session.on('stateChange', (conv) => {
    console.log(`[State] -> ${conv.state} (Total turns: ${conv.totalTurns})`);
  });

  // 6. Execute Conversation
  await session.start();

  // Step 1: Let the moderator decide speaker and run turn
  const turn1 = await session.step();
  console.log(`Turn 1 complete. Speaker: ${turn1?.speakerName}`);

  // Optional: User interjection mid-conversation
  await session.interject('Note: Ensure we verify that API keys are strictly in-memory.');

  // Step 2: Next turn
  const turn2 = await session.step();
  console.log(`Turn 2 complete. Speaker: ${turn2?.speakerName}`);

  // 7. Stop conversation cleanly
  session.stop('Discussion concluded by developer script');
  console.log(`Session ended. Final State: ${session.currentState}`);

  // 8. Export sanitized transcript (Secrets guaranteed excluded)
  const jsonExport = ExportService.exportToJson(session.conversation);
  console.log(`\nExported JSON bytes: ${jsonExport.length} (contains zero credentials)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
