/**
 * Roundtable - Multi-Agent Group Chat & Deliberation Engine
 * Headless TypeScript library entry point.
 * 
 * Provides stable, documented interfaces for agents, providers,
 * moderation, orchestration, events, and persistence.
 * Completely usable independently of any UI or browser environment.
 */

// Core Engine, Types & Orchestration
export * from './packages/core/index.ts';

// Provider Adapters & Registry (Ollama, LM Studio, OpenAI, Claude, Gemini, Mock)
export * from './packages/providers/index.ts';

// Storage Adapters, Persistence & Safe Export
export * from './packages/storage/index.ts';

// Tool Registry & Safe Execution Engine
export * from './packages/tools/index.ts';

// Embed Host & IDE Webview Adapter
export * from './packages/embed/index.ts';
