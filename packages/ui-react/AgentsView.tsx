/**
 * AgentsView Component
 * Tab view to create, inspect, monitor, test, and manage AI agents.
 * Supports Claude, Gemini, Local LLMs (Ollama / LM Studio), OpenAI, and deterministic mocks.
 */

import React, { useState } from 'react';
import { Agent } from '../core/types.ts';
import {
  SupportedProviderType,
  PROVIDER_PRESETS,
} from '../providers/presets.ts';
import { createConfiguredAdapter } from '../providers/factory.ts';
import { sessionCredentials } from './sessionCredentials.ts';
import {
  Bot,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Cpu,
  Sparkles,
  Server,
  Zap,
  Shield,
  HelpCircle,
  X,
} from 'lucide-react';

export interface AgentsViewProps {
  agents: Agent[];
  onSaveAgent: (agent: Agent, creds?: { apiKey?: string; baseUrl?: string; providerType?: SupportedProviderType }) => void;
  onDeleteAgent: (agentId: string) => void;
}

const PROVIDER_ICONS: Record<SupportedProviderType, { icon: typeof Bot; color: string; bg: string; border: string }> = {
  gemini: { icon: Sparkles, color: 'text-cyan-400', bg: 'bg-cyan-950/40', border: 'border-cyan-500/30' },
  anthropic: { icon: Cpu, color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-500/30' },
  openai: { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/30' },
  ollama: { icon: Server, color: 'text-purple-400', bg: 'bg-purple-950/40', border: 'border-purple-500/30' },
  lmstudio: { icon: Server, color: 'text-violet-400', bg: 'bg-violet-950/40', border: 'border-violet-500/30' },
  openrouter: { icon: Zap, color: 'text-blue-400', bg: 'bg-blue-950/40', border: 'border-blue-500/30' },
  'openai-compatible': { icon: Server, color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700' },
  mock: { icon: Shield, color: 'text-slate-400', bg: 'bg-slate-800/80', border: 'border-slate-700' },
};

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  onSaveAgent,
  onDeleteAgent,
}) => {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Helper to extract provider type from agent's provider string or default
  const getAgentProviderType = (agent: Agent): SupportedProviderType => {
    const creds = sessionCredentials.getAgentCredentials(agent.id);
    if (creds && (sessionCredentials as any).agentCredentials?.get(agent.id)?.providerType) {
      return (sessionCredentials as any).agentCredentials.get(agent.id).providerType;
    }
    // Infer from provider ID or model name
    if (agent.provider?.includes('anthropic') || agent.model?.toLowerCase().includes('claude')) return 'anthropic';
    if (agent.provider?.includes('gemini') || agent.model?.toLowerCase().includes('gemini')) return 'gemini';
    if (agent.provider?.includes('openai') || agent.model?.toLowerCase().includes('gpt')) return 'openai';
    if (agent.provider?.includes('ollama') || agent.model?.toLowerCase().includes('llama')) return 'ollama';
    if (agent.provider?.includes('lmstudio')) return 'lmstudio';
    if (agent.provider?.includes('mock') || agent.model?.startsWith('mock')) return 'mock';
    return 'mock';
  };

  const handleTestAgent = async (agent: Agent) => {
    setTestingId(agent.id);
    const pType = getAgentProviderType(agent);
    const creds = sessionCredentials.getAgentCredentials(agent.id, pType);

    try {
      const adapter = createConfiguredAdapter(`test-${agent.id}`, pType, {
        baseUrl: creds.baseUrl,
        apiKey: creds.apiKey,
      });

      const isHealthy = await adapter.healthCheck();
      if (isHealthy) {
        setTestResults((prev) => ({
          ...prev,
          [agent.id]: { success: true, message: `Connected to ${PROVIDER_PRESETS[pType]?.label || pType} successfully.` },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [agent.id]: { success: false, message: 'Health check returned false. Verify key/URL.' },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [agent.id]: { success: false, message: err?.message || 'Connection failed' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleStartCreate = () => {
    const newId = `agent-${Date.now().toString(36)}`;
    const newAgent: Agent = {
      id: newId,
      name: '',
      role: 'participant',
      provider: `provider-${newId}`,
      model: 'gemini-2.5-flash',
      rolePrompt: '',
      temperature: 0.7,
      maxOutputTokens: 1024,
      contextBudget: 8192,
      timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
      visualIdentity: { color: '#0ea5e9' },
    };
    setEditingAgent(newAgent);
    setIsCreating(true);
  };

  const handleStartEdit = (agent: Agent) => {
    setEditingAgent({ ...agent });
    setIsCreating(false);
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.rolePrompt || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase font-mono">
              Agent Registry
            </span>
            <span className="text-xs text-slate-400">· {agents.length} configured</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">AI Agents & Personas</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure participant and moderator agents with frontier models (Claude, Gemini, OpenAI) or local LLMs (Ollama, LM Studio).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500/60 w-44"
          />
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </button>
        </div>
      </div>

      {/* Agents Grid List */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-slate-800 rounded-2xl p-8 bg-slate-900/20">
            <Bot className="w-10 h-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">No Agents Configured</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              Create your first agent by specifying a provider source (Claude, Gemini, Local LLM, OpenAI), name, and role.
            </p>
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold"
            >
              + Create First Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              const pType = getAgentProviderType(agent);
              const preset = PROVIDER_PRESETS[pType] || PROVIDER_PRESETS.mock;
              const style = PROVIDER_ICONS[pType] || PROVIDER_ICONS.mock;
              const IconComp = style.icon;
              const testResult = testResults[agent.id];
              const isTesting = testingId === agent.id;

              return (
                <div
                  key={agent.id}
                  className="flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 transition group"
                >
                  <div>
                    {/* Top Row: Avatar + Name + Source Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                          style={{ backgroundColor: agent.visualIdentity?.color || '#0ea5e9' }}
                        >
                          {agent.name ? agent.name.slice(0, 2).toUpperCase() : 'AG'}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white leading-tight">
                            {agent.name || 'Unnamed Agent'}
                          </h4>
                          <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                            {agent.model}
                          </span>
                        </div>
                      </div>

                      {/* Source Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border font-mono ${style.bg} ${style.color} ${style.border}`}
                      >
                        <IconComp className="w-2.5 h-2.5" />
                        <span>{preset.label}</span>
                      </span>
                    </div>

                    {/* Role Instructions snippet */}
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 line-clamp-3 mb-3 font-normal leading-relaxed">
                      {agent.rolePrompt ? (
                        agent.rolePrompt
                      ) : (
                        <span className="text-slate-500 italic">No instructions specified.</span>
                      )}
                    </div>

                    {/* Connection Test Status if run */}
                    {testResult && (
                      <div
                        className={`mb-3 p-2 rounded text-[11px] flex items-start gap-1.5 ${
                          testResult.success
                            ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        <span className="line-clamp-2">{testResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                    <button
                      onClick={() => handleTestAgent(agent)}
                      disabled={isTesting}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                      title="Test API or local server connection"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-cyan-400' : ''}`} />
                      <span>{isTesting ? 'Testing...' : 'Test'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(agent)}
                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                        title="Edit Agent"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete agent "${agent.name}"?`)) {
                            onDeleteAgent(agent.id);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 transition"
                        title="Delete Agent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Agent Modal */}
      {editingAgent && (
        <AgentModal
          agent={editingAgent}
          isNew={isCreating}
          onClose={() => setEditingAgent(null)}
          onSave={(savedAgent, creds) => {
            onSaveAgent(savedAgent, creds);
            setEditingAgent(null);
          }}
        />
      )}
    </div>
  );
};

// Modal for Creating / Editing Agent
interface AgentModalProps {
  agent: Agent;
  isNew: boolean;
  onClose: () => void;
  onSave: (agent: Agent, creds: { apiKey?: string; baseUrl?: string; providerType: SupportedProviderType }) => void;
}

const COLOR_OPTIONS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#06b6d4'];

const AgentModal: React.FC<AgentModalProps> = ({
  agent: initialAgent,
  isNew,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialAgent.name);
  const [rolePrompt, setRolePrompt] = useState(initialAgent.rolePrompt);
  const [color, setColor] = useState(initialAgent.visualIdentity?.color || '#0ea5e9');

  // Determine initial provider type
  const storedCreds = sessionCredentials.getAgentCredentials(initialAgent.id);
  const initialPType: SupportedProviderType =
    (sessionCredentials as any).agentCredentials?.get(initialAgent.id)?.providerType ||
    (initialAgent.provider?.includes('anthropic') || initialAgent.model?.includes('claude')
      ? 'anthropic'
      : initialAgent.provider?.includes('gemini') || initialAgent.model?.includes('gemini')
      ? 'gemini'
      : initialAgent.provider?.includes('openai') || initialAgent.model?.includes('gpt')
      ? 'openai'
      : initialAgent.provider?.includes('ollama') || initialAgent.model?.includes('llama')
      ? 'ollama'
      : initialAgent.provider?.includes('lmstudio')
      ? 'lmstudio'
      : 'mock');

  const [providerType, setProviderType] = useState<SupportedProviderType>(initialPType);
  const [model, setModel] = useState(initialAgent.model || PROVIDER_PRESETS[initialPType].popularModels[0] || 'default');
  const [apiKey, setApiKey] = useState(storedCreds.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(storedCreds.baseUrl || PROVIDER_PRESETS[initialPType].defaultBaseUrl || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message?: string; success?: boolean }>({
    testing: false,
  });

  const handleProviderChange = (newType: SupportedProviderType) => {
    setProviderType(newType);
    const preset = PROVIDER_PRESETS[newType];
    setModel(preset.popularModels[0] || 'default');
    if (preset.defaultBaseUrl) {
      setBaseUrl(preset.defaultBaseUrl);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ testing: true });
    try {
      const adapter = createConfiguredAdapter(`test-${Date.now()}`, providerType, {
        baseUrl,
        apiKey,
      });
      const ok = await adapter.healthCheck();
      if (ok) {
        setTestStatus({
          testing: false,
          success: true,
          message: `Connected to ${PROVIDER_PRESETS[providerType].label} successfully!`,
        });
      } else {
        setTestStatus({
          testing: false,
          success: false,
          message: 'Connection check returned false. Verify URL/credentials.',
        });
      }
    } catch (err: any) {
      setTestStatus({
        testing: false,
        success: false,
        message: err?.message || 'Connection test failed',
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please provide a name for this agent.');
      return;
    }
    if (!model.trim()) {
      alert('Please specify a model.');
      return;
    }

    const updatedAgent: Agent = {
      ...initialAgent,
      name: name.trim(),
      model: model.trim(),
      rolePrompt: (rolePrompt || '').trim(),
      visualIdentity: { color },
    };

    onSave(updatedAgent, {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      providerType,
    });
  };

  const activePreset = PROVIDER_PRESETS[providerType];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              {isNew ? 'Create New AI Agent' : `Edit Agent: ${name || 'Agent'}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Set provider source, persona instructions, and runtime credentials.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Name & Accent Color */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Agent Display Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Lead Architect, Security Auditor, UX Critic"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Color Badge</label>
              <div className="flex items-center gap-1.5 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition ${
                      color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 2. Source / Provider Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Agent Source / Provider <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: 'gemini', label: 'Google Gemini', desc: 'Frontier AI' },
                { type: 'anthropic', label: 'Anthropic Claude', desc: 'Reasoning' },
                { type: 'openai', label: 'OpenAI API', desc: 'GPT-4o, o3' },
                { type: 'ollama', label: 'Ollama (Local)', desc: 'Open-weights' },
                { type: 'lmstudio', label: 'LM Studio (Local)', desc: 'Local server' },
                { type: 'mock', label: 'Deterministic Mock', desc: 'Zero keys' },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleProviderChange(opt.type as SupportedProviderType)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    providerType === opt.type
                      ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200 ring-1 ring-cyan-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Provider Notice */}
            {providerType === 'openai' && (
              <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  ChatGPT models require an <strong>OpenAI Platform API key</strong> with credit balance. A consumer ChatGPT Plus subscription does not grant API access.
                </span>
              </div>
            )}
            {providerType === 'ollama' && (
              <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <span>Requires CORS enabled on Ollama: run with <code>OLLAMA_ORIGINS=&quot;*&quot; ollama serve</code>.</span>
              </div>
            )}
          </div>

          {/* 3. Model Identifier */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Model Name <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500">Pick preset or type custom</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Model name"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-hidden focus:border-cyan-500"
              />
              {activePreset.popularModels.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setModel(e.target.value);
                  }}
                  className="px-2 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-400 focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="">Presets...</option>
                  {activePreset.popularModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 4. Role & Persona Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Role & Persona Instructions <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    setRolePrompt(
                      'Senior System Architect. Evaluate technical designs for composability, fault tolerance, and minimal blast radius.'
                    )
                  }
                  className="text-cyan-400 hover:underline"
                >
                  Architect
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() =>
                    setRolePrompt(
                      'Security Engineer. Scrutinize system boundaries, token leaks, and ensure zero plain-text secret exposure.'
                    )
                  }
                  className="text-cyan-400 hover:underline"
                >
                  Security
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() =>
                    setRolePrompt(
                      'Discussion Moderator. Keep participants focused on the agenda, call upon relevant specialists, and synthesize key takeaways.'
                    )
                  }
                  className="text-cyan-400 hover:underline"
                >
                  Moderator
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              required
              placeholder="Describe this agent's specialty, perspective, tone, and constraints..."
              value={rolePrompt}
              onChange={(e) => setRolePrompt(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-500 leading-relaxed font-sans"
            />
          </div>

          {/* 5. Provider Connection Credentials */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Credentials & Connection</span>
              </span>
              <span className="text-[10px] text-slate-500">In-memory session only</span>
            </div>

            {/* Base URL (if local or custom) */}
            {(providerType === 'ollama' || providerType === 'lmstudio' || providerType === 'openai-compatible') && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Local Server Base URL</label>
                <input
                  type="text"
                  placeholder={activePreset.defaultBaseUrl || 'http://localhost:11434/v1'}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            )}

            {/* API Key */}
            {activePreset.requiresApiKey && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  API Key <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={activePreset.apiKeyPlaceholder || 'Enter API Key...'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {providerType === 'gemini' && (
              <p className="text-[11px] text-slate-500 italic">
                Google Gemini uses your environment key or default workspace proxy. Optionally provide a custom key above if needed.
              </p>
            )}

            {/* Test Connection Button */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus.testing}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${testStatus.testing ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{testStatus.testing ? 'Testing connection...' : 'Test Connection'}</span>
              </button>

              {testStatus.message && (
                <span
                  className={`text-[11px] ${
                    testStatus.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {testStatus.message}
                </span>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-sm"
            >
              {isNew ? 'Create Agent' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
