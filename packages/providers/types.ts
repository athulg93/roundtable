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
