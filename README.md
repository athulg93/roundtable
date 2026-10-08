# Roundtable 🛡️

**A human-steered multi-agent reasoning engine that combines local and frontier models, orchestrates structured discussion, preserves recoverable state, manages context per agent, and produces actionable conclusions and next steps.**

---

## 🌟 Overview

Roundtable is designed as a **reusable, headless multi-agent group conversation component**. A user creates a group, configures multiple AI agents with distinct personas and model providers, assigns a model-driven moderator, and runs a structured deliberation. The user can steer turns manually or allow the group to proceed automatically according to configurable policies.

The core is UI-agnostic and embeddable into any frontend, Node.js service, or extension.

---

## 🏗️ Architecture & Core Principles

- **Headless Core (`packages/core`)**: Zero UI dependencies. Exposes typed commands (`start`, `step`, `run`, `pause`, `resume`, `stop`, `interject`, `summarize`) and typed event subscriptions (`on('token')`, `on('event')`, `on('stateChange')`).
- **Append-Only Event Sourcing (`reducer.ts`)**: State is deterministically derived from an append-only event stream (`conversation.created`, `user.message`, `turn.started`, `turn.completed`, `turn.failed`, `turn.skipped`, `summary.created`, `conversation.ended`). Replaying the event stream reproduces identical state.
- **Single-Writer Execution (`queue.ts`)**: Every state-changing turn is serialized through an asynchronous mutex queue, guaranteeing that no concurrent operations can interleave or corrupt state.
- **Deterministic State Machine (`stateMachine.ts`)**: Governs transitions between `idle`, `running`, `paused`, `waiting_for_user`, and terminal `ended`.
- **Provider Abstraction (`packages/providers`)**: A unified `generate()` streaming interface that supports:
  - **OpenAI-Compatible**: Ollama, LM Studio, llama.cpp, OpenAI, OpenRouter.
  - **Native Anthropic**: Claude Messages API with SSE streaming.
  - **Google Gemini**: GenAI SDK (`gemini-2.5-flash`, `gemini-2.5-pro`).
  - **Deterministic Mock Provider**: Full test fixture supporting chunk delay, streaming tokens, failure injection, server kill/restart simulation, and malformed JSON generation.
- **Model-Driven Moderator with Deadlock Prevention (`moderator.ts`)**:
  - Emits structured decisions: `{ "nextSpeaker": string, "concluded": boolean, "reason": string }`.
  - Malformed outputs trigger a structured repair prompt.
  - Persistent failures fall back to deterministic round-robin selection to guarantee **the conversation never deadlocks**.
- **Turn Orchestration & Safety Ceilings (`policies.ts`)**:
  - Speaker policies: `moderator-directed`, `round-robin`, `manual`.
  - Termination policies: `moderator-conclusion`, `max-rounds`, `token-budget`, `manual`.
  - Enforces a hard safety ceiling (50 turns default) on all runs.
- **Baseline Context Management (`contextBuilder.ts`, `tokenEstimator.ts`)**:
  - Reserves 20–25% of context budget for model output generation.
  - Wraps token estimation behind a `TokenEstimator` interface (`characters / 4`).
  - Automatically condenses older turns into a durable rolling summary when context limits are reached, preserving raw history in the event log.
- **Error Normalization & Failure Containment (`errors.ts`)**:
  - Normalizes vendor errors into typed domain failures: `timeout`, `rate_limited`, `unavailable`, `context_overflow`, `auth`, `unknown`.
  - Automatically handles retries with exponential backoff and pauses cleanly if all agents fail.
- **Secret Redaction (`exportService.ts`, `errors.ts`)**: API keys and authorization headers are scrubbed from event streams, logs, and exports.
- **Persistence & Export (`packages/storage`)**:
  - Swappable storage adapters (`MemoryStorageAdapter`, `LocalStorageAdapter`).
  - Full conversation export to sanitized JSON and formatted Markdown.
- **Embeddable React UI (`packages/ui-react`)**:
  - `GroupChat` component and `useGroupChat` hook.
  - Renders live streaming tokens, agent badges, turn controls, user interjection composer, summaries modal, event stream inspector, and an interactive acceptance failure-injection harness.

---

## 🔌 Pluggable Library Usage (Embedding in Your Projects)

Roundtable is designed as an unopinionated, pluggable library. You can pull it directly into any Node.js backend, microservice, CLI, or React frontend:

### 1. Headless Node.js Deliberation (No UI required)

```typescript
import {
  createDeliberationSession,
  createAgent,
} from 'roundtable';

// Configure agents with optional role definitions
const session = createDeliberationSession({
  topic: 'Select caching topology for multi-region microservices',
  agents: [
    // Role is optional: defaults to an analytical contributor if omitted
    createAgent({ name: 'Alice', model: 'gpt-4o', provider: 'openai' }),
    createAgent({ name: 'Bob', model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' }),
    createAgent({ name: 'Charlie', model: 'llama3.2', provider: 'ollama' }), // Local LLM!
  ],
});

// Stream real-time tokens to terminal or websocket
session.on('token', ({ chunk }) => process.stdout.write(chunk));

// Run deliberation automatically
await session.run({ maxRounds: 3 });

// Extract structured conclusions & action items
const { nextSteps } = await session.summarize();
console.log('Decisions:', nextSteps.decisions);
console.log('Action Items:', nextSteps.actionItems);
```

### 2. Embed into Any React Application

```tsx
import React from 'react';
import { GroupChat } from 'roundtable';

export function DeliberationPanel() {
  return (
    <div className="w-full h-screen">
      <GroupChat />
    </div>
  );
}
```

### 3. Custom Provider Adapter

```typescript
import { ProviderAdapter, defaultProviderRegistry } from 'roundtable';

class MyInternalGPUAdapter implements ProviderAdapter {
  readonly id = 'internal-cluster';
  readonly name = 'On-Premises GPU Cluster';
  readonly capabilities = { streaming: true, supportsSystemPrompt: true, defaultContextWindow: 32768 };

  async *generate(request, signal) {
    // Call your own internal inference API
    yield { text: 'Cluster response chunk...' };
  }
  async listModels() { return [{ id: 'cluster-70b', name: 'Cluster 70B', contextWindow: 32768, supportsStreaming: true }]; }
  async healthCheck() { return true; }
}

defaultProviderRegistry.register(new MyInternalGPUAdapter());
```

---

## 📁 Repository Structure

```
packages/
  core/           # Domain types, reducer, state machine, queue, moderator, policies, orchestrator
  providers/      # Unified provider interface, OpenAI, Anthropic, Gemini, and Mock adapters
  storage/        # Storage abstraction, memory adapter, localStorage adapter, export service
  ui-react/       # Embeddable React components, hooks, controls, and failure test harness
src/              # Host application shell embedding Roundtable
tests/            # Vitest unit, contract, failure injection, and end-to-end acceptance tests
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/athulg93/roundtable.git
cd roundtable

# Install dependencies
npm install
```

### Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set any optional API keys or endpoints in `.env` (the Deterministic Mock Provider works out of the box with zero keys required):

```env
GEMINI_API_KEY="your-gemini-key"
```

### Running the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to interact with Roundtable.

---

## 🧪 Testing & Verification

Roundtable includes a comprehensive Vitest test suite covering every Phase 1 specification requirement:

```bash
# Run all tests
npm test

# Run type-checking
npm run lint

# Build production bundle
npm run build
```

### Test Coverage Highlights
- **Reducer & Event Log Replay (`tests/core/reducerAndReplay.test.ts`)**: Verifies that replaying event streams reproduces 100% identical state deterministically.
- **Single-Writer Mutex (`tests/core/singleWriter.test.ts`)**: Proves overlapping async operations never interleave or mutate state concurrently.
- **Context Builder (`tests/core/contextBuilder.test.ts`)**: Validates token budgeting, output reservations, and persona isolation.
- **Moderator & Policies (`tests/core/moderatorAndPolicies.test.ts`)**: Tests schema validation, repair prompts, deterministic round-robin fallback, and turn limits.
- **Provider Adapters (`tests/providers/adaptersAndFailure.test.ts`)**: Tests streaming, error normalization, secret redaction, and server outage simulation.
- **Persistence & Export (`tests/storage/persistenceAndExport.test.ts`)**: Tests reload from storage and verifies zero secrets in JSON/Markdown exports.
- **E2E Acceptance Suite (`tests/acceptance/e2eScenario.test.ts`)**: Validates all 10 acceptance checkpoints end-to-end.
- **Shared Structured Blackboard (`tests/core/blackboard.test.ts`)**: Validates live working memory reductions, structured tag extraction, and deterministic replay.
- **Blind-First Deliberation (`tests/reasoning/blindDeliberation.test.ts`)**: Proves parallel epistemic isolation with zero prior peer turn exposure and simultaneous blackboard synthesis.
- **Branching & Forking Engine (`tests/core/branching.test.ts`)**: Validates forking at historical turns, event log slicing, and parent-child session isolation.
- **Deliberation Protocol Presets (`tests/reasoning/protocols.test.ts`)**: Tests strict turn ordering for Formal Debate, Adversarial Red-Team, and Pre-Mortem Analysis.
- **Stall Detection & Dissent Log (`tests/reasoning/stallAndDissent.test.ts`)**: Validates Szymkiewicz-Simpson semantic loop detection and guaranteed permanent archival of minority viewpoints.

---

## 🗺️ Roadmap

- [x] **Phase 1: MVP Core Component**
  - Append-only event sourcing and deterministic replay
  - Single-writer execution queue
  - Provider adapters (OpenAI-compatible, Anthropic, Gemini, Mock)
  - Model-driven moderator with repair and safe round-robin fallback
  - Baseline context management and rolling summaries
  - Failure recovery, timeouts, and stop cancellation
  - Next-steps and detailed deliberation summaries
  - Browser LocalStorage persistence and secret-free exports
  - Thin embeddable React component and hooks
- [x] **Phase 2: Advanced Multi-Agent Reasoning Engine**
  - Shared structured blackboard (decisions, hypotheses, assumptions, open questions)
  - Blind-first deliberation rounds with parallel epistemic isolation
  - Interactive branch tree with what-if counterfactual exploration
  - Deliberation protocol presets (Debate, Adversarial Red-Team, Pre-Mortem, Delphi)
  - Semantic stall detection & immutable dissent log
  - Hybrid tiered model scheduling (fast local models for brainstorming, frontier models for arbitration)
  - Two-pane high-density deliberation cockpit UI
- [ ] **Phase 3: Integrations & Platform**
  - VS Code extension webview
  - Tools and workspace grounding via MCP
  - Shareable agent/group definitions gallery

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
