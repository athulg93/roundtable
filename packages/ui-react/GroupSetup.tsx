/**
 * GroupSetup Component (P1.10)
 * Group and Agent Configuration view with multi-model assignments,
 * moderator selection, policies, and presets.
 */

import React, { useState } from 'react';
import { Agent, Group, SpeakerSelectionPolicy, TerminationPolicy } from '../core/types.ts';
import { Bot, Shield, Plus, Trash2, Sparkles, Sliders } from 'lucide-react';

export interface GroupSetupProps {
  onStartSession: (group: Group, agents: Record<string, Agent>) => void;
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

const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-architect',
    name: 'System Architect',
    role: 'participant',
    provider: 'mock',
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
    provider: 'mock',
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
    provider: 'gemini',
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
    provider: 'mock',
    model: 'mock-pro',
    rolePrompt: 'Discussion Moderator. Keep the group aligned on the goal, invite relevant experts to speak next, prevent deadlocks, and synthesize conclusions.',
    temperature: 0.2,
    maxOutputTokens: 500,
    contextBudget: 8192,
    timeoutSettings: { firstTokenMs: 8000, totalMs: 20000 },
    visualIdentity: { color: '#a855f7' },
  },
];

export const GroupSetup: React.FC<GroupSetupProps> = ({ onStartSession }) => {
  const [groupName, setGroupName] = useState('Core Architecture Working Group');
  const [goal, setGoal] = useState(PRESET_TOPICS[0].goal);
  const [speakerPolicy, setSpeakerPolicy] = useState<SpeakerSelectionPolicy>('moderator-directed');
  const [terminationPolicy, setTerminationPolicy] = useState<TerminationPolicy>('moderator-conclusion');
  const [maxRounds, setMaxRounds] = useState(5);
  const [maxTokens, setMaxTokens] = useState(50000);
  const [moderatorId, setModeratorId] = useState('agent-moderator');
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);

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
      provider: 'mock',
      model: 'mock-fast',
      rolePrompt: 'Domain expert contributing critical domain insights to achieve the discussion goal.',
      temperature: 0.7,
      maxOutputTokens: 1024,
      contextBudget: 8192,
      timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
      visualIdentity: { color: '#eab308' },
    };
    setAgents([...agents, newAgent]);
  };

  const handleRemoveAgent = (id: string) => {
    if (agents.length <= 2) {
      alert('A group must have at least 2 participants.');
      return;
    }
    const filtered = agents.filter((a) => a.id !== id);
    setAgents(filtered);
    if (moderatorId === id) {
      setModeratorId(filtered[0]?.id || '');
    }
  };

  const handleUpdateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(agents.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !goal.trim()) {
      alert('Please provide a group name and discussion goal.');
      return;
    }

    const agentsMap: Record<string, Agent> = {};
    for (const a of agents) {
      // Mark the selected moderator agent
      agentsMap[a.id] = {
        ...a,
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
      maxRounds,
      maxTokens,
      turnTimeoutMs: 30000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onStartSession(group, agentsMap);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Intro Header */}
      <div className="flex items-start justify-between bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase tracking-wider">
              Phase 1 MVP Specification
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Roundtable — Multi-Agent Deliberation Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure participant agents, assign a model-driven moderator, select orchestration policies, and run reasoned deliberation.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-col gap-1.5 items-end">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Topic Presets
          </span>
          <div className="flex items-center gap-1.5">
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
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.provider} / {a.model})
                  </option>
                ))}
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
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" /> Multi-Agent Participants ({agents.length})
            </h2>
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

              return (
                <div
                  key={agent.id}
                  className={`bg-slate-950 border rounded-xl p-4 space-y-3 relative transition-all ${
                    isMod ? 'border-purple-500/50 shadow-xs shadow-purple-500/10' : 'border-slate-800'
                  }`}
                >
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

                  {/* Provider & Model Selectors */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Provider</label>
                      <select
                        value={agent.provider}
                        onChange={(e) => handleUpdateAgent(agent.id, { provider: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                      >
                        <option value="mock">Deterministic Mock</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="openai-compatible">OpenAI-Compatible (Ollama/LM Studio)</option>
                        <option value="anthropic">Anthropic Claude</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Model</label>
                      <input
                        type="text"
                        value={agent.model}
                        onChange={(e) => handleUpdateAgent(agent.id, { model: e.target.value })}
                        placeholder="e.g. mock-pro, gemini-2.5-flash"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Role Persona */}
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Role Persona & Perspective</label>
                    <textarea
                      rows={2}
                      value={agent.rolePrompt}
                      onChange={(e) => handleUpdateAgent(agent.id, { rolePrompt: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-[11px] text-slate-300 leading-relaxed focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Budget & Output Parameters */}
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
    </div>
  );
};
