/**
 * GroupSetup Component (P1.10)
 * Group and Agent Configuration view with multi-model assignments,
 * support for OpenAI, Claude, Gemini, and Local LLMs (Ollama, LM Studio).
 */

import React, { useState } from 'react';
import { Agent, Group, SpeakerSelectionPolicy, TerminationPolicy, DeliberationProtocol } from '../core/types.ts';
import {
  SupportedProviderType,
  PROVIDER_PRESETS,
} from '../providers/presets.ts';
import { createConfiguredAdapter } from '../providers/factory.ts';
import { ProviderAdapter } from '../providers/types.ts';
import { DeveloperGuideModal } from './DeveloperGuideModal.tsx';
import {
  Bot,
  Shield,
  Plus,
  Trash2,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  RefreshCw,
  Code,
} from 'lucide-react';

export interface GroupSetupProps {
  onStartSession: (
    group: Group,
    agents: Record<string, Agent>,
    adapters?: Record<string, ProviderAdapter>
  ) => void;
}

const PRESET_TOPICS = [
  {
    name: 'Distributed Architecture Deliberation',
    goal: 'Design a resilient multi-agent orchestration architecture that supports local and frontier models with zero secrets leakage and graceful failure recovery.',
  },
  {
    name: 'Database Migration & Consistency Strategy',
    goal: 'Evaluate migrating an append-only event-sourced system from in-memory persistence to SQLite and IndexedDB while guaranteeing zero data corruption under concurrent load.',
  },
  {
    name: 'Production Outage Post-Mortem & Hardening',
    goal: 'Analyze a sudden 503 provider failure during high-traffic deliberation, determine why the retry backoff behaved as expected, and establish actionable safeguards.',
  },
];

interface AgentConnectionState {
  providerType: SupportedProviderType;
  baseUrl: string;
  apiKey: string;
  showApiKey: boolean;
  testing: boolean;
  testStatus?: {
    success: boolean;
    message: string;
    discoveredModels?: string[];
  };
}

const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-architect',
    name: 'System Architect',
    role: 'participant',
    provider: 'provider-agent-architect',
    model: 'mock-pro',
    rolePrompt: 'Senior Distributed Systems Architect. Prioritize composability, clean provider abstraction, single-writer queues, and backward-compatible event schemas.',
    temperature: 0.7,
    maxOutputTokens: 1024,
    contextBudget: 8192,
    timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
    visualIdentity: { color: '#0ea5e9' },
  },
  {
    id: 'agent-security',
    name: 'Security Lead',
    role: 'participant',
    provider: 'provider-agent-security',
    model: 'mock-fast',
    rolePrompt: 'Application Security Engineer. Enforce zero API secrets in event logs or exported JSON, boundary sanitation, and token budget bounds.',
    temperature: 0.5,
    maxOutputTokens: 1024,
    contextBudget: 8192,
    timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
    visualIdentity: { color: '#f43f5e' },
  },
  {
    id: 'agent-reliability',
    name: 'SRE / Reliability Lead',
    role: 'participant',
    provider: 'provider-agent-reliability',
    model: 'gemini-2.5-flash',
    rolePrompt: 'Site Reliability Engineer. Champion timeout boundaries, exponential backoff, circuit breaking when servers die, and automatic context compression.',
    temperature: 0.6,
    maxOutputTokens: 1024,
    contextBudget: 12000,
    timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
    visualIdentity: { color: '#10b981' },
  },
  {
    id: 'agent-moderator',
    name: 'Discussion Moderator',
    role: 'moderator',
    provider: 'provider-agent-moderator',
    model: 'mock-pro',
    rolePrompt: 'Discussion Moderator. Keep the group aligned on the goal, invite relevant experts to speak next, prevent deadlocks, and synthesize conclusions.',
    temperature: 0.2,
    maxOutputTokens: 500,
    contextBudget: 8192,
    timeoutSettings: { firstTokenMs: 8000, totalMs: 20000 },
    visualIdentity: { color: '#a855f7' },
  },
];

const INITIAL_CONNECTIONS: Record<string, AgentConnectionState> = {
  'agent-architect': {
    providerType: 'mock',
    baseUrl: '',
    apiKey: '',
    showApiKey: false,
    testing: false,
  },
  'agent-security': {
    providerType: 'mock',
    baseUrl: '',
    apiKey: '',
    showApiKey: false,
    testing: false,
  },
  'agent-reliability': {
    providerType: 'gemini',
    baseUrl: '',
    apiKey: '',
    showApiKey: false,
    testing: false,
  },
  'agent-moderator': {
    providerType: 'mock',
    baseUrl: '',
    apiKey: '',
    showApiKey: false,
    testing: false,
  },
};

export const GroupSetup: React.FC<GroupSetupProps> = ({ onStartSession }) => {
  const [groupName, setGroupName] = useState('Core Architecture Working Group');
  const [goal, setGoal] = useState(PRESET_TOPICS[0].goal);
  const [protocol, setProtocol] = useState<DeliberationProtocol>('blind-first');
  const [tierScheduling, setTierScheduling] = useState(true);
  const [speakerPolicy, setSpeakerPolicy] = useState<SpeakerSelectionPolicy>('moderator-directed');
  const [terminationPolicy, setTerminationPolicy] = useState<TerminationPolicy>('moderator-conclusion');
  const [maxRounds, setMaxRounds] = useState(5);
  const [maxTokens, setMaxTokens] = useState(50000);
  const [moderatorId, setModeratorId] = useState('agent-moderator');
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [connections, setConnections] = useState<Record<string, AgentConnectionState>>(INITIAL_CONNECTIONS);
  const [showDevGuide, setShowDevGuide] = useState(false);

  const handleApplyPreset = (index: number) => {
    setGroupName(PRESET_TOPICS[index].name);
    setGoal(PRESET_TOPICS[index].goal);
  };

  const handleAddAgent = () => {
    const id = `agent-${Date.now().toString(36)}`;
    const newAgent: Agent = {
      id,
      name: `Specialist ${agents.length + 1}`,
      role: 'participant',
      provider: `provider-${id}`,
      model: 'llama3.2',
      rolePrompt: 'Domain expert contributing critical domain insights to achieve the discussion goal.',
      temperature: 0.7,
      maxOutputTokens: 1024,
      contextBudget: 8192,
      timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
      visualIdentity: { color: '#eab308' },
    };

    setAgents([...agents, newAgent]);
    setConnections({
      ...connections,
      [id]: {
        providerType: 'ollama',
        baseUrl: PROVIDER_PRESETS.ollama.defaultBaseUrl || '',
        apiKey: '',
        showApiKey: false,
        testing: false,
      },
    });
  };

  const handleRemoveAgent = (id: string) => {
    if (agents.length <= 2) {
      alert('A group must have at least 2 participants.');
      return;
    }
    const filtered = agents.filter((a) => a.id !== id);
    setAgents(filtered);
    const updatedConns = { ...connections };
    delete updatedConns[id];
    setConnections(updatedConns);
    if (moderatorId === id) {
      setModeratorId(filtered[0]?.id || '');
    }
  };

  const handleUpdateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(agents.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handleUpdateConnection = (id: string, updates: Partial<AgentConnectionState>) => {
    setConnections({
      ...connections,
      [id]: {
        ...connections[id],
        ...updates,
      },
    });
  };

  const handleProviderTypeChange = (agentId: string, newType: SupportedProviderType) => {
    const preset = PROVIDER_PRESETS[newType];
    const defaultModel = preset.popularModels[0] || 'default';

    // Update connection
    handleUpdateConnection(agentId, {
      providerType: newType,
      baseUrl: preset.defaultBaseUrl || '',
      testStatus: undefined,
    });

    // Update agent default model
    handleUpdateAgent(agentId, {
      model: defaultModel,
    });
  };

  // Test provider connection
  const handleTestConnection = async (agentId: string) => {
    const conn = connections[agentId];
    if (!conn) return;

    handleUpdateConnection(agentId, { testing: true, testStatus: undefined });

    try {
      const adapter = createConfiguredAdapter(`test-${agentId}`, conn.providerType, {
        baseUrl: conn.baseUrl,
        apiKey: conn.apiKey,
      });

      const isHealthy = await adapter.healthCheck();
      let discoveredModels: string[] | undefined;

      try {
        const models = await adapter.listModels();
        if (models && models.length > 0) {
          discoveredModels = models.map((m) => m.id);
        }
      } catch {
        // Model discovery optional
      }

      if (isHealthy || (discoveredModels && discoveredModels.length > 0)) {
        handleUpdateConnection(agentId, {
          testing: false,
          testStatus: {
            success: true,
            message: `Connected successfully! ${discoveredModels ? `(${discoveredModels.length} models discovered)` : ''}`,
            discoveredModels,
          },
        });
      } else {
        handleUpdateConnection(agentId, {
          testing: false,
          testStatus: {
            success: false,
            message: conn.providerType === 'ollama' || conn.providerType === 'lmstudio'
              ? 'Could not connect. Verify server is running and CORS is enabled.'
              : 'Connection check returned false. Verify API key and network.',
          },
        });
      }
    } catch (err: any) {
      handleUpdateConnection(agentId, {
        testing: false,
        testStatus: {
          success: false,
          message: err.message || 'Connection test failed',
        },
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !goal.trim()) {
      alert('Please provide a group name and discussion goal.');
      return;
    }

    const agentsMap: Record<string, Agent> = {};
    const adaptersMap: Record<string, ProviderAdapter> = {};

    for (const a of agents) {
      const conn = connections[a.id] || {
        providerType: 'mock' as SupportedProviderType,
        baseUrl: '',
        apiKey: '',
      };

      const adapterId = `provider-${a.id}`;

      // Create isolated configured adapter
      const adapter = createConfiguredAdapter(adapterId, conn.providerType, {
        baseUrl: conn.baseUrl,
        apiKey: conn.apiKey,
        name: `${a.name} (${PROVIDER_PRESETS[conn.providerType].label})`,
      });

      adaptersMap[adapterId] = adapter;

      // Assign agent snapshot with reference to adapter ID
      agentsMap[a.id] = {
        ...a,
        provider: adapterId,
        role: a.id === moderatorId ? 'moderator' : 'participant',
      };
    }

    const group: Group = {
      id: `grp-${Date.now().toString(36)}`,
      name: groupName.trim(),
      goal: goal.trim(),
      agentIds: agents.map((a) => a.id),
      moderatorId,
      speakerPolicy,
      terminationPolicy,
      protocol,
      tierScheduling,
      maxRounds,
      maxTokens,
      turnTimeoutMs: 30000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onStartSession(group, agentsMap, adaptersMap);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Intro Header */}
      <div className="flex items-start justify-between bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase tracking-wider">
              Roundtable • Multi-Model Orchestration
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Roundtable — Multi-Agent Deliberation Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure participant agents with any combination of Local LLMs (Ollama, LM Studio) or Frontier Models (OpenAI, Claude, Gemini, OpenRouter).
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-col gap-1.5 items-end">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Topic Presets
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDevGuide(true)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-semibold transition-colors flex items-center gap-1 shadow-xs"
            >
              <Code className="w-3 h-3 text-cyan-400" /> Pluggable API Guide
            </button>
            {PRESET_TOPICS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(idx)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Preset {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Group Topic & Goal */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" /> Group Objective & Policies
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Moderator</label>
              <select
                value={moderatorId}
                onChange={(e) => setModeratorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {agents.map((a) => {
                  const conn = connections[a.id];
                  const providerLabel = conn ? PROVIDER_PRESETS[conn.providerType].label : a.provider;
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name} ({providerLabel} / {a.model})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Deliberation Topic / Problem Statement</label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed"
              required
            />
          </div>

          {/* Phase 2: Deliberation Protocol Presets */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Deliberation Protocol Preset
              </label>
              <span className="text-[11px] text-cyan-400 font-mono">
                {protocol === 'blind-first' && 'Epistemic Isolation Mode'}
                {protocol === 'debate' && 'Dialectical Affirmative/Negative'}
                {protocol === 'red-team' && 'Adversarial Threat Modeling'}
                {protocol === 'pre-mortem' && 'Counterfactual Failure Analysis'}
                {protocol === 'standard' && 'Open Collaborative Debate'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                {
                  id: 'blind-first',
                  title: 'Blind-First Delphi',
                  tag: 'Epistemic Independence',
                  desc: 'All participants generate independent stances in parallel before group cross-examination to eliminate anchoring.',
                  badge: 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300',
                },
                {
                  id: 'debate',
                  title: 'Formal Debate',
                  tag: 'Strict Dialectic',
                  desc: 'Structured rounds: Affirmative constructive -> Negative rebuttal -> Affirmative defense -> Closing verdict.',
                  badge: 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300',
                },
                {
                  id: 'red-team',
                  title: 'Adversarial Red-Team',
                  tag: 'Security & Robustness',
                  desc: 'Architecture proposal -> Red-team exploit vectors -> Blue-team hardening -> Security arbiter sign-off.',
                  badge: 'bg-red-950/60 border-red-700/60 text-red-300',
                },
                {
                  id: 'pre-mortem',
                  title: 'Pre-Mortem Analysis',
                  tag: 'Failure Prevention',
                  desc: 'Assume failure 6 months out -> Root cause inquest -> Actionable preventive failsafes on blackboard.',
                  badge: 'bg-amber-950/60 border-amber-700/60 text-amber-300',
                },
                {
                  id: 'standard',
                  title: 'Standard Deliberation',
                  tag: 'Open Dynamic Flow',
                  desc: 'Open multi-turn collaboration guided by moderator speaker selection and working memory blackboard.',
                  badge: 'bg-slate-900 border-slate-700 text-slate-300',
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProtocol(p.id as DeliberationProtocol)}
                  className={`text-left p-2.5 rounded-xl border transition ${
                    protocol === p.id
                      ? 'border-cyan-500 bg-cyan-950/30 ring-1 ring-cyan-500/40'
                      : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200">{p.title}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${p.badge}`}>
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
                </button>
              ))}
            </div>

            {/* Hybrid Tiered Scheduling toggle */}
            <div className="mt-2 p-3 rounded-lg border border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-300">Hybrid Tiered Model Scheduling</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dispatches fast/local models (Ollama, LM Studio) for brainstorming turns, while reserving frontier models (Claude, Gemini 2.5 Pro) for arbitration and blackboard synthesis.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={tierScheduling}
                  onChange={(e) => setTierScheduling(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>
          </div>

          {/* Orchestration Policies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Speaker Selection</label>
              <select
                value={speakerPolicy}
                onChange={(e) => setSpeakerPolicy(e.target.value as SpeakerSelectionPolicy)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="moderator-directed">Moderator-Directed</option>
                <option value="round-robin">Round-Robin</option>
                <option value="manual">Manual Selection</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Termination Policy</label>
              <select
                value={terminationPolicy}
                onChange={(e) => setTerminationPolicy(e.target.value as TerminationPolicy)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="moderator-conclusion">Moderator Conclusion</option>
                <option value="max-rounds">Max Rounds Limit</option>
                <option value="token-budget">Token Budget Limit</option>
                <option value="manual">Manual Stop Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Max Rounds</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value, 10) || 5)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Token Budget Ceiling</label>
              <input
                type="number"
                step={5000}
                min={5000}
                max={500000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 50000)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Agents Configuration */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" /> Multi-Agent Participants ({agents.length})
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Assign different local or frontier models to each agent. Credentials stay strictly client-side.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddAgent}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Agent
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const isMod = agent.id === moderatorId;
              const conn = connections[agent.id] || {
                providerType: 'mock' as SupportedProviderType,
                baseUrl: '',
                apiKey: '',
                showApiKey: false,
                testing: false,
              };
              const preset = PROVIDER_PRESETS[conn.providerType];

              return (
                <div
                  key={agent.id}
                  className={`bg-slate-950 border rounded-xl p-4 space-y-3.5 relative transition-all ${
                    isMod ? 'border-purple-500/50 shadow-xs shadow-purple-500/10' : 'border-slate-800'
                  }`}
                >
                  {/* Agent Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ backgroundColor: agent.visualIdentity.color }}
                      >
                        {isMod ? <Shield className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>
                      <input
                        type="text"
                        value={agent.name}
                        onChange={(e) => handleUpdateAgent(agent.id, { name: e.target.value })}
                        className="font-semibold text-xs bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500 text-slate-200 outline-none px-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {isMod ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          MODERATOR
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setModeratorId(agent.id)}
                          className="text-[10px] px-2 py-0.5 rounded text-slate-500 hover:text-purple-300 hover:bg-purple-950/40"
                        >
                          Make Moderator
                        </button>
                      )}

                      {agents.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAgent(agent.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Provider Selector */}
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5 font-medium">Provider Service</label>
                        <select
                          value={conn.providerType}
                          onChange={(e) => handleProviderTypeChange(agent.id, e.target.value as SupportedProviderType)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs cursor-pointer focus:border-cyan-500"
                        >
                          <option value="mock">🧪 Deterministic Mock</option>
                          <option value="ollama">💻 Ollama (Local LLM)</option>
                          <option value="lmstudio">🖥️ LM Studio (Local LLM)</option>
                          <option value="openai">⚡ OpenAI</option>
                          <option value="anthropic">🧠 Anthropic Claude</option>
                          <option value="gemini">💎 Google Gemini</option>
                          <option value="openrouter">🌐 OpenRouter</option>
                          <option value="openai-compatible">⚙️ Custom OpenAI-Compatible</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5 font-medium">Model Name</label>
                        <input
                          type="text"
                          value={agent.model}
                          onChange={(e) => handleUpdateAgent(agent.id, { model: e.target.value })}
                          placeholder="e.g. gpt-4o, llama3.2"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Popular model chips */}
                    {preset.popularModels && preset.popularModels.length > 0 && (
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">Suggested Models:</span>
                        <div className="flex flex-wrap gap-1">
                          {preset.popularModels.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleUpdateAgent(agent.id, { model: m })}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                                agent.model === m
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Base URL (if configurable) */}
                    {conn.providerType !== 'gemini' && conn.providerType !== 'mock' && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Base URL Endpoint
                        </label>
                        <input
                          type="text"
                          value={conn.baseUrl}
                          onChange={(e) => handleUpdateConnection(agent.id, { baseUrl: e.target.value })}
                          placeholder={preset.defaultBaseUrl || 'http://localhost:11434/v1'}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:border-cyan-500"
                        />
                      </div>
                    )}

                    {/* API Key Input (if applicable) */}
                    {preset.requiresApiKey && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>API Key</span>
                          <span className="text-[9px] text-emerald-400">Client-side only (never saved to logs)</span>
                        </div>
                        <div className="relative">
                          <input
                            type={conn.showApiKey ? 'text' : 'password'}
                            value={conn.apiKey}
                            onChange={(e) => handleUpdateConnection(agent.id, { apiKey: e.target.value })}
                            placeholder={preset.apiKeyPlaceholder || 'Enter API Key...'}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono pr-7 focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateConnection(agent.id, { showApiKey: !conn.showApiKey })}
                            className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
                          >
                            {conn.showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CORS Notice for Local LLMs */}
                    {preset.corsNotice && (
                      <div className="text-[10px] text-amber-400/90 bg-amber-950/30 border border-amber-900/40 p-2 rounded leading-tight flex items-start gap-1.5">
                        <Radio className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                        <span>{preset.corsNotice}</span>
                      </div>
                    )}

                    {/* Connection Test Action & Result */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(agent.id)}
                        disabled={conn.testing}
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 disabled:opacity-50 transition-colors"
                      >
                        {conn.testing ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" /> Testing...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-3 h-3" /> Test Connection
                          </>
                        )}
                      </button>

                      {conn.testStatus && (
                        <div
                          className={`flex items-center gap-1 text-[10px] ${
                            conn.testStatus.success ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {conn.testStatus.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="truncate max-w-[180px]">{conn.testStatus.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Discovered Models Dropdown from Live Server */}
                    {conn.testStatus?.discoveredModels && conn.testStatus.discoveredModels.length > 0 && (
                      <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                        <span className="text-slate-400 block mb-1">Discovered on Server:</span>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {conn.testStatus.discoveredModels.map((dm) => (
                            <button
                              key={dm}
                              type="button"
                              onClick={() => handleUpdateAgent(agent.id, { model: dm })}
                              className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 font-mono text-[9px]"
                            >
                              + {dm}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Role Persona */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-medium">Assigned Role & Instructions</span>
                      <span className="text-[9px] text-cyan-400/80 font-mono font-medium">(Optional)</span>
                    </div>
                    <textarea
                      rows={2}
                      value={agent.rolePrompt || ''}
                      onChange={(e) => handleUpdateAgent(agent.id, { rolePrompt: e.target.value })}
                      placeholder="Optional: Define what role this agent is supposed to do (e.g. 'Security auditor evaluating threat vectors'). If left empty, agent contributes as a general analytical expert."
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-[11px] text-slate-300 leading-relaxed focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                    />
                  </div>

                  {/* Budget & Parameters */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 pt-1">
                    <div>
                      <span>Context Budget</span>
                      <input
                        type="number"
                        value={agent.contextBudget}
                        onChange={(e) => handleUpdateAgent(agent.id, { contextBudget: parseInt(e.target.value, 10) || 4000 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 font-mono text-[10px] mt-0.5"
                      />
                    </div>
                    <div>
                      <span>Max Output</span>
                      <input
                        type="number"
                        value={agent.maxOutputTokens}
                        onChange={(e) => handleUpdateAgent(agent.id, { maxOutputTokens: parseInt(e.target.value, 10) || 500 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 font-mono text-[10px] mt-0.5"
                      />
                    </div>
                    <div>
                      <span>Color</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="color"
                          value={agent.visualIdentity.color}
                          onChange={(e) =>
                            handleUpdateAgent(agent.id, {
                              visualIdentity: { ...agent.visualIdentity, color: e.target.value },
                            })
                          }
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="font-mono text-[9px] text-slate-500">{agent.visualIdentity.color}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Initialize & Start Deliberation
          </button>
        </div>
      </form>

      {/* Pluggable Integration Guide Modal */}
      {showDevGuide && <DeveloperGuideModal onClose={() => setShowDevGuide(false)} />}
    </div>
  );
};
