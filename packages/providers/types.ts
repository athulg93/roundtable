/**
 * Provider Types and Interfaces (P1.2)
 * Isolated model interface for both local and frontier providers.
 */

import { NormalizedProviderError, Usage } from '../core/types.ts';

export interface MessageInput {
  role: 'system' | 'user' | 'assistant';
  name?: string;
  content: string;
}

export interface GenerationRequest {
  model: string;
  systemPrompt?: string;
  messages: MessageInput[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutSettings?: {
    firstTokenMs?: number;
    totalMs?: number;
  };
}

export interface GenerationChunk {
  text: string;
  isFinal?: boolean;
  usage?: Usage;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsStreaming: boolean;
}

export interface ProviderCapabilities {
  streaming: boolean;
  supportsSystemPrompt: boolean;
  defaultContextWindow: number;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncIterable<GenerationChunk>;

  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<boolean>;
}

/**
 * Non-secret, persistent provider configuration.
 * Safe for storage, export, and cross-session persistence.
 * Secrets (API keys) MUST NEVER be placed in ProviderConfig.
 */
export interface ProviderConfig {
  id: string; // e.g. 'local-ollama', 'gemini-default', 'claude-prod'
  name: string; // e.g. 'Ollama Local Instance', 'Claude Frontier'
  type: 'mock' | 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'openai-compatible';
  baseUrl?: string; // non-secret URL (e.g. 'http://localhost:11434/v1')
  defaultModel?: string; // fallback or default model
  fallbackProviderId?: string; // fallback provider if primary fails
  timeoutSettings?: {
    firstTokenMs?: number;
    totalMs?: number;
  };
  isDefault?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProviderRouteRule {
  pattern: string | RegExp; // matches provider id or model name (e.g. 'claude-*', 'gpt-*')
  targetProviderId: string;
  priority?: number;
}

export interface ProviderResolutionResult {
  primary: ProviderAdapter;
  fallbacks: ProviderAdapter[];
  resolvedId: string;
}

