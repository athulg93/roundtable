/**
 * GroupsView Component
 * Tab view to create, inspect, manage, and launch multi-agent discussion groups.
 * Allows selecting participant agents, setting topics, and explicitly choosing
 * between Human Moderator and AI Agent Moderator.
 */

import React, { useState } from 'react';
import { Group, Agent, DeliberationProtocol, SpeakerSelectionPolicy } from '../core/types.ts';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Play,
  Shield,
  User,
  Sparkles,
  Bot,
  HelpCircle,
  X,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';

export interface GroupsViewProps {
  groups: Group[];
  agents: Agent[];
  activeGroupId?: string;
  onStartGroupChat: (group: Group) => void;
  onSaveGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
  onNavigateToAgents: () => void;
}

const PRESET_TOPICS = [
  {
    name: 'Distributed Architecture Review',
    goal: 'Design a resilient multi-agent orchestration architecture that supports local and frontier models with zero secrets leakage and graceful failure recovery.',
  },
  {
    name: 'Security Threat Modeling & Boundaries',
    goal: 'Identify threat vectors in untrusted third-party tool executions, prevent sandbox escapes, and enforce prompt injection boundaries.',
  },
  {
    name: 'Production Outage Post-Mortem',
    goal: 'Conduct a thorough post-mortem on a 503 provider outage, evaluate exponential retry backoff, and establish preventative circuit breakers.',
  },
];

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  agents,
  activeGroupId,
  onStartGroupChat,
  onSaveGroup,
  onDeleteGroup,
  onNavigateToAgents,
}) => {
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const agentsMap = React.useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  const handleStartCreate = () => {
    const newId = `grp-${Date.now().toString(36)}`;
    const newGroup: Group = {
      id: newId,
      name: '',
      goal: '',
      agentIds: agents.slice(0, 3).map((a) => a.id),
      moderatorId: 'user', // Default to Human Moderator
      speakerPolicy: 'round-robin',
      terminationPolicy: 'max-rounds',
      protocol: 'standard',
      maxRounds: 5,
      maxTokens: 50000,
      turnTimeoutMs: 30000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingGroup(newGroup);
    setIsCreating(true);
  };

  const handleStartEdit = (group: Group) => {
    setEditingGroup({ ...group });
    setIsCreating(false);
  };

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.goal.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase font-mono">
              Working Groups
            </span>
            <span className="text-xs text-slate-400">· {groups.length} created</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Deliberation Groups</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Assemble multi-agent teams, select Human or AI moderation, and launch collaborative discussions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500/60 w-44"
          />
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-6">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-slate-800 rounded-2xl p-8 bg-slate-900/20">
            <Users className="w-10 h-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">No Groups Created Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              Create a group to bring your agents together on a discussion topic, with Human or AI moderation.
            </p>
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold"
            >
              + Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredGroups.map((group) => {
              const isHumanMod = group.moderatorId === 'user';
              const modAgent = !isHumanMod ? agentsMap.get(group.moderatorId) : null;
              const isActive = activeGroupId === group.id;

              return (
                <div
                  key={group.id}
                  className={`flex flex-col justify-between p-5 rounded-xl border transition ${
                    isActive
                      ? 'border-cyan-500/60 bg-cyan-950/20 shadow-md ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900/80'
                  }`}
                >
                  <div>
                    {/* Top row: Group Name & Moderation Mode */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">{group.name}</h4>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Moderator Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border font-mono ${
                          isHumanMod
                            ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                            : 'bg-purple-950/50 border-purple-500/40 text-purple-300'
                        }`}
                      >
                        {isHumanMod ? (
                          <>
                            <User className="w-3 h-3 text-cyan-400" />
                            <span>Human Mod</span>
                          </>
                        ) : (
                          <>
                            <Shield className="w-3 h-3 text-purple-400" />
                            <span>Mod: {modAgent?.name || 'AI Facilitator'}</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Goal / Topic */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 mb-4 leading-relaxed">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        Topic / Goal:
                      </span>
                      {group.goal}
                    </div>

                    {/* Participant Agents */}
                    <div className="mb-4">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">
                        Participating Agents ({group.agentIds.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.agentIds.map((aid) => {
                          const agent = agentsMap.get(aid);
                          if (!agent) return null;
                          return (
                            <span
                              key={aid}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: agent.visualIdentity?.color || '#0ea5e9' }}
                              />
                              <span className="font-medium">{agent.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({agent.model})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono">
                      <span>Protocol: {group.protocol || 'standard'}</span>
                      <span>·</span>
                      <span>Max Rounds: {group.maxRounds || 5}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(group)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                        title="Edit Group"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete group "${group.name}"?`)) {
                            onDeleteGroup(group.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 transition"
                        title="Delete Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onStartGroupChat(group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isActive ? 'Resume Chat' : 'Open Chat'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Group Modal */}
      {editingGroup && (
        <GroupModal
          group={editingGroup}
          allAgents={agents}
          isNew={isCreating}
          onClose={() => setEditingGroup(null)}
          onNavigateToAgents={onNavigateToAgents}
          onSave={(savedGroup) => {
            onSaveGroup(savedGroup);
            setEditingGroup(null);
          }}
          onSaveAndStart={(savedGroup) => {
            onSaveGroup(savedGroup);
            setEditingGroup(null);
            onStartGroupChat(savedGroup);
          }}
        />
      )}
    </div>
  );
};

// Modal for Creating / Editing Group
interface GroupModalProps {
  group: Group;
  allAgents: Agent[];
  isNew: boolean;
  onClose: () => void;
  onNavigateToAgents: () => void;
  onSave: (group: Group) => void;
  onSaveAndStart: (group: Group) => void;
}

const GroupModal: React.FC<GroupModalProps> = ({
  group: initialGroup,
  allAgents,
  isNew,
  onClose,
  onNavigateToAgents,
  onSave,
  onSaveAndStart,
}) => {
  const [name, setName] = useState(initialGroup.name);
  const [goal, setGoal] = useState(initialGroup.goal);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(initialGroup.agentIds || []);
  const [moderationMode, setModerationMode] = useState<'human' | 'agent'>(
    initialGroup.moderatorId === 'user' ? 'human' : 'agent'
  );
  const [agentModeratorId, setAgentModeratorId] = useState<string>(
    initialGroup.moderatorId !== 'user' && initialGroup.moderatorId
      ? initialGroup.moderatorId
      : allAgents[0]?.id || ''
  );
  const [protocol, setProtocol] = useState<DeliberationProtocol>(initialGroup.protocol || 'standard');
  const [maxRounds, setMaxRounds] = useState(initialGroup.maxRounds || 5);

  const toggleAgent = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      if (selectedAgentIds.length <= 2) {
        alert('A group must have at least 2 participants.');
        return;
      }
      setSelectedAgentIds(selectedAgentIds.filter((id) => id !== agentId));
      if (agentModeratorId === agentId) {
        const remaining = selectedAgentIds.filter((id) => id !== agentId);
        setAgentModeratorId(remaining[0] || '');
      }
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const handleApplyPreset = (index: number) => {
    setName(PRESET_TOPICS[index].name);
    setGoal(PRESET_TOPICS[index].goal);
  };

  const buildGroup = (): Group | null => {
    if (!name.trim()) {
      alert('Please enter a group name.');
      return null;
    }
    if (!goal.trim()) {
      alert('Please specify a deliberation goal or discussion topic.');
      return null;
    }
    if (selectedAgentIds.length < 2) {
      alert('Please select at least 2 participant agents.');
      return null;
    }

    const effectiveModeratorId = moderationMode === 'human' ? 'user' : agentModeratorId;

    return {
      ...initialGroup,
      name: name.trim(),
      goal: goal.trim(),
      agentIds: selectedAgentIds,
      moderatorId: effectiveModeratorId,
      protocol,
      maxRounds,
      updatedAt: Date.now(),
    };
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const grp = buildGroup();
    if (grp) onSave(grp);
  };

  const handleSaveAndLaunch = () => {
    const grp = buildGroup();
    if (grp) onSaveAndStart(grp);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              {isNew ? 'Create Working Group' : `Edit Group: ${name || 'Group'}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select participants, set the topic, and decide who moderates.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Group Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Core Architecture Working Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Goal / Topic + Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Deliberation Topic / Goal <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                <Sparkles className="w-3 h-3" />
                <span>Presets:</span>
                {PRESET_TOPICS.map((p, idx) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(idx)}
                    className="hover:underline ml-1"
                  >
                    #{idx + 1}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              required
              placeholder="What question, problem, or decision should this group deliberate on?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-500 leading-relaxed font-sans"
            />
          </div>

          {/* Decide Moderator: Human Moderator vs Agent Moderator */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200">
                Who Moderates the Conversation? <span className="text-rose-400">*</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                The moderator orchestrates speaker order, turn progression, and summaries.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option A: Human Moderator */}
              <div
                onClick={() => setModerationMode('human')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  moderationMode === 'human'
                    ? 'bg-cyan-950/60 border-cyan-500/80 text-white ring-1 ring-cyan-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>👤 Human Moderator (You)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  You steer the deliberation. Step turns one-by-one, pause/resume, run continuously, or interject your own thoughts.
                </p>
              </div>

              {/* Option B: Agent Moderator */}
              <div
                onClick={() => setModerationMode('agent')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  moderationMode === 'agent'
                    ? 'bg-purple-950/60 border-purple-500/80 text-white ring-1 ring-purple-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>🛡️ AI Agent Moderator</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  An AI agent acts as facilitator, selecting which specialist should answer next and synthesizing consensus.
                </p>
              </div>
            </div>

            {/* If Agent Moderator chosen, select which agent */}
            {moderationMode === 'agent' && (
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                  Select Moderator Agent:
                </label>
                <select
                  value={agentModeratorId}
                  onChange={(e) => setAgentModeratorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-purple-500/40 rounded-lg text-purple-200 focus:outline-hidden focus:border-purple-400"
                >
                  {allAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.model}) — {(a.rolePrompt || '').slice(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Participant Agents Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Select Participating Agents <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToAgents();
                }}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>+ Create new agent</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {allAgents.length === 0 ? (
              <p className="text-xs text-rose-400">
                No agents available. Please create agents first in the Agents tab!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {allAgents.map((agent) => {
                  const isSelected = selectedAgentIds.includes(agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/60 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: agent.visualIdentity?.color || '#0ea5e9' }}
                        />
                        <div className="truncate">
                          <div className="text-xs font-medium truncate">{agent.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{agent.model}</div>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deliberation Rules & Protocol */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Deliberation Protocol</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as DeliberationProtocol)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden"
              >
                <option value="standard">Standard Roundtable</option>
                <option value="blind-first">Blind Deliberation (Independent First Round)</option>
                <option value="debate">Structured Debate</option>
                <option value="socratic">Socratic Questioning</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Rounds</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value) || 5)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                {isNew ? 'Create Group' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleSaveAndLaunch}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch Chat Now</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
