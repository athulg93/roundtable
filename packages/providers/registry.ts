/**
 * Provider Adapter Registry & Router (P1.2, Phase 2 Dependability)
 * Manages provider adapters, persistent configs, route aliases,
 * model-based dispatch, and resilient fallback chains.
 */

import { ProviderAdapter, ProviderConfig, ProviderResolutionResult } from './types.ts';
import { MockProvider } from './mockProvider.ts';
import { OpenAICompatibleAdapter } from './openaiAdapter.ts';
import { AnthropicAdapter } from './anthropicAdapter.ts';
import { GeminiAdapter } from './geminiAdapter.ts';
import { createConfiguredAdapter, createFromConfig } from './factory.ts';
import { SupportedProviderType, PROVIDER_PRESETS } from './presets.ts';

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();
  private configs = new Map<string, ProviderConfig>();
  private aliases = new Map<string, string>();
  private fallbackChains = new Map<string, string[]>();
  private modelRoutes: Array<{ pattern: RegExp; targetProviderId: string }> = [];

  constructor() {
    // 1. Register base adapters
    this.register(new MockProvider());
    this.register(new OpenAICompatibleAdapter());
    this.register(new AnthropicAdapter());
    this.register(new GeminiAdapter());

    // 2. Setup standard canonical aliases
    this.aliases.set('mock-provider', 'mock');
    this.aliases.set('openai', 'openai-compatible');
    this.aliases.set('claude', 'anthropic');
    this.aliases.set('google', 'gemini');

    // 3. Setup standard model-to-provider routes
    this.addModelRoute(/^(gpt-|o1|o3|text-embedding)/i, 'openai-compatible');
    this.addModelRoute(/^claude/i, 'anthropic');
    this.addModelRoute(/^gemini/i, 'gemini');
    this.addModelRoute(/^(llama|mistral|qwen|deepseek|phi)/i, 'ollama');
    this.addModelRoute(/^mock/i, 'mock');

    // 4. Default fallback chains (resilience)
    this.setFallbackRoute('anthropic', ['gemini', 'mock']);
    this.setFallbackRoute('openai-compatible', ['gemini', 'mock']);
    this.setFallbackRoute('gemini', ['openai-compatible', 'mock']);
    this.setFallbackRoute('ollama', ['lmstudio', 'mock']);
    this.setFallbackRoute('lmstudio', ['ollama', 'mock']);
  }

  // --- Adapter Registration ---

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  unregister(id: string): boolean {
    return this.adapters.delete(id);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  // --- Config Persistence & Factory Wiring ---

  registerConfig(config: ProviderConfig, apiKey?: string): void {
    this.configs.set(config.id, { ...config, updatedAt: Date.now() });
    // Automatically instantiate and register adapter
    const adapter = createFromConfig(config, apiKey);
    this.register(adapter);

    if (config.fallbackProviderId) {
      this.setFallbackRoute(config.id, [config.fallbackProviderId]);
    }
  }

  getConfig(id: string): ProviderConfig | undefined {
    return this.configs.get(id);
  }

  listConfigs(): ProviderConfig[] {
    return Array.from(this.configs.values());
  }

  deleteConfig(id: string): boolean {
    this.adapters.delete(id);
    return this.configs.delete(id);
  }

  // --- Routing & Aliases ---

  addRouteAlias(alias: string, targetProviderId: string): void {
    this.aliases.set(alias.toLowerCase(), targetProviderId);
  }

  setFallbackRoute(primaryProviderId: string, fallbackProviderIds: string[]): void {
    this.fallbackChains.set(primaryProviderId, [...fallbackProviderIds]);
  }

  getFallbackRoute(primaryProviderId: string): string[] {
    return this.fallbackChains.get(primaryProviderId) || ['mock'];
  }

  addModelRoute(pattern: RegExp | string, targetProviderId: string): void {
    const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`, 'i') : pattern;
    this.modelRoutes.push({ pattern: regex, targetProviderId });
  }

  /**
   * Resilient Provider Resolution:
   * Resolves a provider by ID, alias, model hint, or dynamic preset on demand.
   */
  resolve(providerIdOrModel?: string, modelHint?: string): ProviderAdapter {
    const result = this.resolveRouting(providerIdOrModel, modelHint);
    return result.primary;
  }

  /**
   * Resolves primary adapter and all configured fallback adapters in order.
   */
  resolveChain(providerIdOrModel?: string, modelHint?: string): ProviderResolutionResult {
    return this.resolveRouting(providerIdOrModel, modelHint);
  }

  require(id: string): ProviderAdapter {
    return this.resolve(id);
  }

  private resolveRouting(providerIdOrModel?: string, modelHint?: string): ProviderResolutionResult {
    const rawId = (providerIdOrModel || '').trim();
    const effectiveModel = modelHint || rawId;

    // 1. Direct adapter match
    if (rawId && this.adapters.has(rawId)) {
      const primary = this.adapters.get(rawId)!;
      return this.buildResult(rawId, primary);
    }

    // 2. Alias resolution
    const aliasedId = rawId ? this.aliases.get(rawId.toLowerCase()) : undefined;
    if (aliasedId && this.adapters.has(aliasedId)) {
      const primary = this.adapters.get(aliasedId)!;
      return this.buildResult(aliasedId, primary);
    }

    // 3. Stored Config resolution
    if (rawId && this.configs.has(rawId)) {
      const config = this.configs.get(rawId)!;
      const adapter = createFromConfig(config);
      this.register(adapter);
      return this.buildResult(rawId, adapter);
    }

    // 4. Dynamic Preset instantiation on demand (ollama, lmstudio, openrouter, etc.)
    const lowerRaw = rawId.toLowerCase() as SupportedProviderType;
    if (PROVIDER_PRESETS[lowerRaw]) {
      const adapter = createConfiguredAdapter(lowerRaw, lowerRaw);
      this.register(adapter);
      return this.buildResult(lowerRaw, adapter);
    }

    // 5. Model-based routing pattern
    if (effectiveModel) {
      for (const rule of this.modelRoutes) {
        if (rule.pattern.test(effectiveModel)) {
          const target = this.adapters.get(rule.targetProviderId);
          if (target) {
            return this.buildResult(rule.targetProviderId, target);
          }
        }
      }
    }

    // 6. Check if mock is available as fallback
    const mock = this.adapters.get('mock');
    if (mock) {
      return {
        primary: mock,
        fallbacks: [],
        resolvedId: 'mock',
      };
    }

    // 7. Exhausted
    const available = Array.from(this.adapters.keys()).join(', ');
    throw new Error(
      `Unable to route provider '${rawId || 'unknown'}' (model: '${effectiveModel}'). Available adapters: ${available}`
    );
  }

  private buildResult(resolvedId: string, primary: ProviderAdapter): ProviderResolutionResult {
    const fallbackIds = this.fallbackChains.get(resolvedId) || [];
    const fallbacks: ProviderAdapter[] = [];

    for (const fId of fallbackIds) {
      if (fId === resolvedId) continue;
      const fAdapter = this.adapters.get(fId) || (PROVIDER_PRESETS[fId as SupportedProviderType] ? createConfiguredAdapter(fId, fId as SupportedProviderType) : undefined);
      if (fAdapter && !fallbacks.some((x) => x.id === fAdapter.id)) {
        fallbacks.push(fAdapter);
      }
    }

    return {
      primary,
      fallbacks,
      resolvedId,
    };
  }
}

export const defaultProviderRegistry = new ProviderRegistry();
