# Multi-Agent Group Chat - Phase 1 MVP Development Notes

## 1. Overview & Architectural Decisions
Built strictly against the **Gemini Development Specification (Version 1.0 - Phase 1 MVP)**:
- **Headless Core (`packages/core`)**: Zero UI dependencies. Exposes typed commands (`start`, `step`, `run`, `pause`, `resume`, `stop`, `interject`, `summarize`) and typed subscriptions via EventEmitter (`on('token')`, `on('event')`, `on('stateChange')`, etc.).
- **Single-Writer Execution (`queue.ts`)**: Every state mutation is sequenced through a mutex queue, ensuring concurrent turns never interleave or mutate state simultaneously.
- **Event-Sourced Conversation (`reducer.ts`, `types.ts`)**: All actions produce append-only durable events (`conversation.created`, `user.message`, `turn.started`, `turn.completed`, `turn.failed`, `turn.skipped`, `summary.created`, `conversation.ended`). State is deterministically derived via pure reduction. Replaying the event stream reproduces identical state.
- **Deterministic State Machine (`stateMachine.ts`)**: Transitions between `idle`, `running`, `paused`, `waiting_for_user`, and `ended`.
- **Model-Driven Moderator with Safe Fallback (`moderator.ts`)**: Evaluates discussion turns and suggests `nextSpeaker` or declares `concluded: true` with a rationale. Schema validation is enforced; malformed outputs trigger a repair prompt, and persistent failures automatically fall back to deterministic round-robin to ensure **conversations never deadlock**.
- **Turn Orchestration & Safety Ceilings (`policies.ts`)**: Supports `manual`, `round-robin`, and `moderator-directed` speaker selection, alongside `manual`, `max-rounds`, `token-budget`, and `moderator-conclusion` termination. A hard ceiling of 50 turns is enforced on all runs.
- **Baseline Context Management (`contextBuilder.ts`, `tokenEstimator.ts`)**: Reserves 20–25% of the context budget for output generation. Assembles system prompt, topic/goal, participant roster, rolling summary, and recent turns. When budget is exceeded, older turns are condensed into a durable rolling summary event.
- **Error Normalization & Failure Recovery (`packages/providers`)**: Vendor errors are normalized to `timeout`, `rate_limited`, `unavailable`, `context_overflow`, `auth`, or `unknown`. Supports automatic retry with exponential backoff and circuit-breaking pause when all agents fail.
- **Strict Secret Boundary & Sanitization (`exportService.ts`, `errors.ts`)**: API keys and authorization headers are scrubbed from errors, event streams, and exports.
- **Storage Abstraction (`packages/storage`)**: Includes `MemoryStorageAdapter` for automated testing and `LocalStorageAdapter` for browser persistence across reloads.
- **Minimal React UI Surface (`packages/ui-react`)**: Provides `GroupChat` and `useGroupChat`, setup screen, turn-by-turn message list with streaming animation, live controls, summary view modal, event stream inspector with one-click replay verification, and an interactive acceptance failure-injection harness.

---

## 2. Directory Structure
```
packages/
  core/
    types.ts            # Domain types, Event types, State machine types
    reducer.ts          # Pure reducer & deterministic replay logic
    stateMachine.ts     # Valid transitions and transition assertions
    tokenEstimator.ts   # TokenEstimator interface & default char/4 estimator
    contextBuilder.ts   # Context assembly, budget reserving, and prompt safety
    moderator.ts        # Moderator decision schema, validation, repair, fallback
    policies.ts         # Speaker selection and termination policies
    queue.ts            # Single-writer execution queue
    summarizer.ts       # Rolling summary, next-steps, and detailed deliberation summaries
    orchestrator.ts     # Core GroupChatSession engine
    index.ts
  providers/
    types.ts            # ProviderAdapter, GenerationChunk, ProviderCapabilities
    errors.ts           # Error normalization and secret redactor
    mockProvider.ts     # Deterministic Mock Provider with failure injection
    openaiAdapter.ts    # OpenAI-compatible adapter (Ollama, LM Studio, OpenAI)
    anthropicAdapter.ts # Native Anthropic Messages API adapter
    geminiAdapter.ts    # Google Gemini GenAI adapter
    registry.ts         # Provider adapter registry
    index.ts
  storage/
    types.ts            # StorageAdapter interface
    memoryStorage.ts    # In-memory persistence adapter
    localStorage.ts     # LocalStorage browser persistence adapter
    exportService.ts    # JSON and Markdown export service (scrubs secrets)
    index.ts
  ui-react/
    useGroupChat.ts     # React hook wrapping GroupChatSession
    GroupChat.tsx       # Reusable embeddable component
    GroupSetup.tsx      # Group configuration and multi-agent setup
    MessageList.tsx     # Message list with live streaming and speaker identities
    TurnControls.tsx    # Run, step, pause, resume, stop, and interject controls
    SummaryView.tsx     # Next-steps & detailed summaries modal
    EventLogView.tsx    # Live event stream inspector & replay verifier
    TestHarness.tsx     # Interactive failure injection & acceptance test harness
    index.ts
tests/
  core/
    reducerAndReplay.test.ts
    singleWriter.test.ts
    contextBuilder.test.ts
    moderatorAndPolicies.test.ts
  providers/
    adaptersAndFailure.test.ts
  storage/
    persistenceAndExport.test.ts
  acceptance/
    e2eScenario.test.ts
```

---

## 3. Verification & Phase 1 Gate Checklist
- **Test Suite**: Vitest (`npm test`) runs 7 test suites, 24 tests, **100% green**.
- **Type Checking**: `npm run lint` (`tsc --noEmit`) passes with zero errors.
- **Production Compilation**: `npm run build` succeeds cleanly.
- **Acceptance Scenario (Section 4.2)**: All 10 checkpoints pass end-to-end.
- **Phase Boundary**: Stopped strictly at Phase 1 gate. No Phase 2 or Phase 3 features introduced.
