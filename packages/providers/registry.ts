/**
 * Provider Adapter Registry (P1.2)
 * Manages provider adapters and resolves them by agent provider ID.
 */

import { ProviderAdapter } from './types.ts';
import { MockProvider } from './mockProvider.ts';
import { OpenAICompatibleAdapter } from './openaiAdapter.ts';
import { AnthropicAdapter } from './anthropicAdapter.ts';
import { GeminiAdapter } from './geminiAdapter.ts';

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  constructor() {
    // Register default adapters
    this.register(new MockProvider());
    this.register(new OpenAICompatibleAdapter());
    this.register(new AnthropicAdapter());
    this.register(new GeminiAdapter());
  }

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  require(id: string): ProviderAdapter {
    const adapter = this.get(id);
    if (!adapter) {
      throw new Error(`Provider adapter '${id}' not registered in ProviderRegistry. Available: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    return adapter;
  }

  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const defaultProviderRegistry = new ProviderRegistry();
