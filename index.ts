/**
 * Roundtable - Multi-Agent Group Chat & Deliberation Engine
 * Main pluggable library entry point.
 */

// Core Engine & Orchestrator
export * from './packages/core/index.ts';

// Provider Adapters (Ollama, LM Studio, OpenAI, Claude, Gemini, Mock)
export * from './packages/providers/index.ts';

// Storage Adapters & Export
export * from './packages/storage/index.ts';

// Embeddable React Components & Hooks
export * from './packages/ui-react/index.ts';
