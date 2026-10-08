/**
 * Hybrid Tiered Model Dispatcher (Phase 2 - Confirmed Decision 3)
 * Intelligently schedules high-throughput local models or fast models for parallel brainstorming
 * while reserving frontier models for arbitration, synthesis, and blackboard reconciliation.
 */

import { Agent, AgentRole } from '../core/types.ts';

export type ModelTier = 'fast_local' | 'balanced' | 'frontier';

export interface ModelTierConfig {
  fastBrainstormModels: Array<{ provider: string; model: string }>;
  frontierArbiterModels: Array<{ provider: string; model: string }>;
}

export const DEFAULT_TIER_CONFIG: ModelTierConfig = {
  fastBrainstormModels: [
    { provider: 'mock', model: 'mock-fast' },
    { provider: 'openai-compatible', model: 'llama3:8b' },
    { provider: 'gemini', model: 'gemini-2.5-flash' },
  ],
  frontierArbiterModels: [
    { provider: 'anthropic', model: 'claude-3-7-sonnet' },
    { provider: 'gemini', model: 'gemini-2.5-pro' },
    { provider: 'openai-compatible', model: 'gpt-4o' },
  ],
};

export class TieredModelDispatcher {
  constructor(private config: ModelTierConfig = DEFAULT_TIER_CONFIG) {}

  /**
   * Resolves the optimal provider and model based on role and operation type.
   * - Brainstorming / participant turn: High-throughput local / fast model
   * - Moderator / Arbiter / Summary / Blackboard synthesis: Frontier model
   */
  resolveModel(
    agent: Agent,
    operationType: 'brainstorm' | 'turn' | 'moderator_decision' | 'synthesis' | 'blackboard_update',
    tierSchedulingEnabled: boolean
  ): { provider: string; model: string } {
    if (!tierSchedulingEnabled) {
      return { provider: agent.provider, model: agent.model };
    }

    if (operationType === 'brainstorm') {
      const preferred = this.config.fastBrainstormModels[0];
      return preferred || { provider: agent.provider, model: agent.model };
    }

    if (
      operationType === 'moderator_decision' ||
      operationType === 'synthesis' ||
      operationType === 'blackboard_update' ||
      agent.role === 'moderator'
    ) {
      const frontier = this.config.frontierArbiterModels[0];
      return frontier || { provider: agent.provider, model: agent.model };
    }

    return { provider: agent.provider, model: agent.model };
  }

  /**
   * Classifies a model identifier into a tier.
   */
  classifyTier(model: string): ModelTier {
    const lower = model.toLowerCase();
    if (
      lower.includes('opus') ||
      lower.includes('sonnet') ||
      lower.includes('pro') ||
      lower.includes('gpt-4o') ||
      lower.includes('o1')
    ) {
      return 'frontier';
    }
    if (
      lower.includes('fast') ||
      lower.includes('flash') ||
      lower.includes('mini') ||
      lower.includes('7b') ||
      lower.includes('8b') ||
      lower.includes('local')
    ) {
      return 'fast_local';
    }
    return 'balanced';
  }
}

export const defaultTieredDispatcher = new TieredModelDispatcher();
