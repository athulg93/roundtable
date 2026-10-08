/**
 * Roundtable Pluggable Builders & Helpers
 * Provides clean factory functions for creating Agents, Groups, and Sessions
 * when embedding Roundtable into external projects.
 */

import { Agent, AgentRole, Group, SpeakerSelectionPolicy, TerminationPolicy } from './types.ts';
import { GroupChatSession, createGroupChat } from './orchestrator.ts';
import { ProviderRegistry, defaultProviderRegistry } from '../providers/registry.ts';
import { StorageAdapter } from '../storage/types.ts';
import { MemoryStorageAdapter } from '../storage/memoryStorage.ts';

const PALETTE = [
  '#0ea5e9', // cyan
  '#f43f5e', // rose
  '#10b981', // emerald
  '#a855f7', // purple
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#ec4899', // pink
  '#14b8a6', // teal
];

export interface CreateAgentOptions {
  id?: string;
  name: string;
  provider?: string; // 'mock' | 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini' | string
  model: string;
  role?: AgentRole; // 'participant' | 'moderator', defaults to 'participant'
  rolePrompt?: string; // OPTIONAL: what role the agent is supposed to do
  temperature?: number;
  maxOutputTokens?: number;
  contextBudget?: number;
  timeoutSettings?: {
    firstTokenMs?: number;
    totalMs?: number;
  };
  visualIdentity?: {
    avatar?: string;
    color?: string;
  };
}

/**
 * Creates an Agent with robust defaults and optional rolePrompt.
 */
export function createAgent(options: CreateAgentOptions): Agent {
  const id = options.id || `agent-${Math.random().toString(36).substring(2, 9)}`;
  const role = options.role || 'participant';
  const colorIndex = Math.abs(id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % PALETTE.length;

  return {
    id,
    name: options.name,
    role,
    provider: options.provider || 'mock',
    model: options.model,
    rolePrompt: options.rolePrompt,
    temperature: options.temperature ?? (role === 'moderator' ? 0.2 : 0.7),
    maxOutputTokens: options.maxOutputTokens ?? 1024,
    contextBudget: options.contextBudget ?? 8192,
    timeoutSettings: {
      firstTokenMs: options.timeoutSettings?.firstTokenMs ?? 15000,
      totalMs: options.timeoutSettings?.totalMs ?? 60000,
    },
    visualIdentity: {
      color: options.visualIdentity?.color || PALETTE[colorIndex],
      avatar: options.visualIdentity?.avatar,
    },
  };
}

export interface CreateGroupOptions {
  id?: string;
  name: string;
  goal: string;
  agentIds: string[];
  moderatorId?: string;
  speakerPolicy?: SpeakerSelectionPolicy;
  terminationPolicy?: TerminationPolicy;
  maxRounds?: number;
  maxTokens?: number;
  turnTimeoutMs?: number;
}

/**
 * Creates a Group with sensible default orchestration policies.
 */
export function createGroup(options: CreateGroupOptions): Group {
  const id = options.id || `grp-${Math.random().toString(36).substring(2, 9)}`;
  const moderatorId = options.moderatorId || options.agentIds[0];

  return {
    id,
    name: options.name,
    goal: options.goal,
    agentIds: options.agentIds,
    moderatorId,
    speakerPolicy: options.speakerPolicy || 'moderator-directed',
    terminationPolicy: options.terminationPolicy || 'moderator-conclusion',
    maxRounds: options.maxRounds ?? 5,
    maxTokens: options.maxTokens ?? 50000,
    turnTimeoutMs: options.turnTimeoutMs ?? 30000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export interface QuickSessionOptions {
  topic: string;
  agents: Agent[];
  groupName?: string;
  moderatorId?: string;
  speakerPolicy?: SpeakerSelectionPolicy;
  terminationPolicy?: TerminationPolicy;
  storage?: StorageAdapter;
  providerRegistry?: ProviderRegistry;
}

/**
 * Convenience helper to initialize an entire multi-agent deliberation session in one line.
 */
export function createDeliberationSession(options: QuickSessionOptions): GroupChatSession {
  const agentIds = options.agents.map((a) => a.id);
  const modId = options.moderatorId || options.agents.find((a) => a.role === 'moderator')?.id || agentIds[0];

  const group = createGroup({
    name: options.groupName || 'Roundtable Deliberation',
    goal: options.topic,
    agentIds,
    moderatorId: modId,
    speakerPolicy: options.speakerPolicy,
    terminationPolicy: options.terminationPolicy,
  });

  const agentsMap: Record<string, Agent> = {};
  for (const a of options.agents) {
    agentsMap[a.id] = {
      ...a,
      role: a.id === modId ? 'moderator' : a.role,
    };
  }

  return createGroupChat({
    group,
    agents: agentsMap,
    storage: options.storage || new MemoryStorageAdapter(),
    providerRegistry: options.providerRegistry || defaultProviderRegistry,
  });
}
