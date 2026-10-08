/**
 * Dynamic Provider Adapter Factory
 * Instantiates and wires adapters for any local or frontier configuration.
 */

import { ProviderAdapter } from './types.ts';
import { MockProvider } from './mockProvider.ts';
import { OpenAICompatibleAdapter } from './openaiAdapter.ts';
import { AnthropicAdapter } from './anthropicAdapter.ts';
import { GeminiAdapter } from './geminiAdapter.ts';
import { SupportedProviderType, PROVIDER_PRESETS } from './presets.ts';

export interface AdapterOptions {
  baseUrl?: string;
  apiKey?: string;
  name?: string;
}

export function createConfiguredAdapter(
  id: string,
  type: SupportedProviderType,
  options: AdapterOptions = {}
): ProviderAdapter {
  const preset = PROVIDER_PRESETS[type];
  const baseUrl = options.baseUrl || preset?.defaultBaseUrl;
  const apiKey = options.apiKey?.trim() || undefined;
  const name = options.name || preset?.label || type;

  switch (type) {
    case 'mock':
      return new MockProvider({ id, name });

    case 'anthropic':
      return new AnthropicAdapter({
        id,
        name,
        baseUrl,
        apiKey,
      });

    case 'gemini':
      return new GeminiAdapter({
        id,
        name,
        apiKey,
      });

    case 'ollama':
    case 'lmstudio':
    case 'openai':
    case 'openrouter':
    case 'openai-compatible':
    default:
      return new OpenAICompatibleAdapter({
        id,
        name,
        baseUrl: baseUrl || 'http://localhost:11434/v1',
        apiKey,
      });
  }
}
