/**
 * GroupChat Component (Phase 1 MVP + Deliberation Engine)
 * Simplified, intuitive UI layout:
 * - Top-level tabs: Groups, Agents, Chat (Deliberation Room), Settings
 * - Groups tab: create/manage groups, select participant agents, decide Human vs Agent moderation
 * - Agents tab: create/monitor agents across Claude, Gemini, Local LLM (Ollama/LM Studio), OpenAI, and Mocks
 * - Deliberation room: clean transcript, turn controls, pause/resume, interjections, collapsible drawer
 * - Settings: holds everything else (in-memory credentials, template gallery, dev guide, reset)
 */

import React, { useState, useEffect } from 'react';
import { Group, Agent } from '../core/types.ts';
import { GroupChatSession, createGroupChat } from '../core/orchestrator.ts';
import { useGroupChat } from './useGroupChat.ts';
import { MessageList } from './MessageList.tsx';
import { TurnControls } from './TurnControls.tsx';
import { SummaryView } from './SummaryView.tsx';
import { GroupsView } from './GroupsView.tsx';
import { AgentsView } from './AgentsView.tsx';
import { SettingsView } from './SettingsView.tsx';
import { BlackboardView } from './BlackboardView.tsx';
import { BranchTreeVisualizer } from './BranchTreeVisualizer.tsx';
import { DissentLogView } from './DissentLogView.tsx';
import { EventLogView } from './EventLogView.tsx';
import { TestHarness } from './TestHarness.tsx';
import { ToolsView } from './ToolsView.tsx';
import { TemplateGalleryModal } from './TemplateGalleryModal.tsx';
import { DeveloperGuideModal } from './DeveloperGuideModal.tsx';
import { defaultVSCodeHost } from '../embed/vscodeHost.ts';
import { LocalStorageAdapter } from '../storage/localStorage.ts';
import { defaultProviderRegistry } from '../providers/registry.ts';
import { createConfiguredAdapter } from '../providers/factory.ts';
import { sessionCredentials } from './sessionCredentials.ts';
import {
  Users,
  Bot,
  MessageSquare,
  Settings,
  Layers,
  ShieldAlert,
  GitBranch,
  ClipboardList,
  Scale,
  EyeOff,
  Sparkles,
  Wrench,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RotateCcw,
} from 'lucide-react';

export interface GroupChatProps {
  initialSession?: GroupChatSession;
}

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-architect',
    name: 'System Architect',
    role: 'participant',
    provider: 'provider-agent-architect',
    model: 'gemini-2.5-flash',
    rolePrompt: 'Senior Distributed Systems Architect. Prioritize composability, clean abstractions, single-writer queues, and backward-compatible schemas.',
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
    model: 'mock-pro',
    rolePrompt: 'Site Reliability Engineer. Champion timeout boundaries, exponential backoff, circuit breaking when servers die, and automatic context compression.',
    temperature: 0.6,
    maxOutputTokens: 1024,
    contextBudget: 12000,
    timeoutSettings: { firstTokenMs: 10000, totalMs: 30000 },
    visualIdentity: { color: '#10b981' },
  },
  {
    id: 'agent-moderator',
    name: 'Discussion Facilitator',
    role: 'moderator',
    provider: 'provider-agent-moderator',
    model: 'gemini-2.5-flash',
    rolePrompt: 'Discussion Moderator. Keep the group aligned on the goal, invite relevant experts to speak next, prevent deadlocks, and synthesize conclusions.',
    temperature: 0.2,
    maxOutputTokens: 500,
    contextBudget: 8192,
    timeoutSettings: { firstTokenMs: 8000, totalMs: 20000 },
    visualIdentity: { color: '#a855f7' },
  },
];

const DEFAULT_GROUP: Group = {
  id: 'grp-default',
  name: 'Core Architecture Working Group',
  goal: 'Design a resilient multi-agent orchestration architecture that supports local and frontier models with zero secrets leakage and graceful failure recovery.',
  agentIds: ['agent-architect', 'agent-security', 'agent-reliability', 'agent-moderator'],
  moderatorId: 'user', // Default to Human moderator
  speakerPolicy: 'round-robin',
  terminationPolicy: 'max-rounds',
  protocol: 'standard',
  maxRounds: 5,
  maxTokens: 50000,
  turnTimeoutMs: 30000,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const GroupChat: React.FC<GroupChatProps> = ({ initialSession }) => {
  const [activeTab, setActiveTab] = useState<'groups' | 'agents' | 'chat' | 'settings'>('groups');
  const [session, setSession] = useState<GroupChatSession | null>(initialSession || null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>(
    initialSession?.conversation.groupId || undefined
  );

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showDevGuideModal, setShowDevGuideModal] = useState(false);
  const [, setTick] = useState(0);

  const storage = React.useMemo(() => new LocalStorageAdapter(), []);

  // Initial load of groups and agents from storage
  useEffect(() => {
    const loadData = async () => {
      let loadedGroups = await storage.listGroups();
      let loadedAgents = await storage.listAgents();

      if (loadedAgents.length === 0) {
        // Seed initial agents
        for (const a of DEFAULT_AGENTS) {
          await storage.saveAgent(a);
        }
        loadedAgents = DEFAULT_AGENTS;
      }

      if (loadedGroups.length === 0) {
        // Seed initial group
        await storage.saveGroup(DEFAULT_GROUP);
        loadedGroups = [DEFAULT_GROUP];
      }

      setAgents(loadedAgents);
      setGroups(loadedGroups);
    };

    loadData().catch(console.error);
  }, [storage]);

  // Handle saving an agent
  const handleSaveAgent = async (
    agent: Agent,
    creds?: { apiKey?: string; baseUrl?: string; providerType?: any }
  ) => {
    if (creds) {
      sessionCredentials.setAgentCredentials(agent.id, creds);
    }
    await storage.saveAgent(agent);
    const updated = await storage.listAgents();
    setAgents(updated);
  };

  // Handle deleting an agent
  const handleDeleteAgent = async (agentId: string) => {
    sessionCredentials.removeAgentCredentials(agentId);
    await storage.deleteAgent(agentId);
    const updated = await storage.listAgents();
    setAgents(updated);
  };

  // Handle saving a group
  const handleSaveGroup = async (group: Group) => {
    await storage.saveGroup(group);
    const updated = await storage.listGroups();
    setGroups(updated);
  };

  // Handle deleting a group
  const handleDeleteGroup = async (groupId: string) => {
    await storage.deleteGroup(groupId);
    const updated = await storage.listGroups();
    setGroups(updated);
    if (activeGroupId === groupId) {
      setActiveGroupId(undefined);
      setSession(null);
    }
  };

  // Launch deliberation session for a group
  const handleStartGroupChat = (group: Group) => {
    const groupAgents: Record<string, Agent> = {};
    const effectiveModId = group.moderatorId;

    for (const agentId of group.agentIds) {
      const found = agents.find((a) => a.id === agentId);
      if (found) {
        const creds = sessionCredentials.getAgentCredentials(found.id);
        let providerType = (sessionCredentials as any).agentCredentials?.get(found.id)?.providerType;
        if (!providerType) {
          if (found.provider?.includes('anthropic') || found.model?.toLowerCase().includes('claude')) providerType = 'anthropic';
          else if (found.provider?.includes('gemini') || found.model?.toLowerCase().includes('gemini')) providerType = 'gemini';
          else if (found.provider?.includes('openai') || found.model?.toLowerCase().includes('gpt')) providerType = 'openai';
          else if (found.provider?.includes('ollama') || found.model?.toLowerCase().includes('llama')) providerType = 'ollama';
          else if (found.provider?.includes('lmstudio')) providerType = 'lmstudio';
          else providerType = 'mock';
        }

        const adapterId = `provider-${found.id}`;
        const adapter = createConfiguredAdapter(adapterId, providerType, {
          baseUrl: creds.baseUrl,
          apiKey: creds.apiKey,
          name: `${found.name} (${providerType})`,
        });
        defaultProviderRegistry.register(adapter);

        groupAgents[found.id] = {
          ...found,
          provider: adapterId,
          role: effectiveModId === found.id ? 'moderator' : 'participant',
        };
      }
    }

    // Include agent moderator if not already in groupAgents
    if (effectiveModId !== 'user' && !groupAgents[effectiveModId]) {
      const modFound = agents.find((a) => a.id === effectiveModId);
      if (modFound) {
        const adapterId = `provider-${modFound.id}`;
        const adapter = createConfiguredAdapter(adapterId, 'gemini', {
          name: `${modFound.name} (facilitator)`,
        });
        defaultProviderRegistry.register(adapter);
        groupAgents[modFound.id] = {
          ...modFound,
          provider: adapterId,
          role: 'moderator',
        };
      }
    }

    const newSession = createGroupChat({
      group,
      agents: groupAgents,
      storage,
      providerRegistry: defaultProviderRegistry,
    });

    setSession(newSession);
    setActiveGroupId(group.id);
    setActiveTab('chat');
  };

  const handleSeedDemoData = async () => {
    for (const a of DEFAULT_AGENTS) {
      await storage.saveAgent(a);
    }
    await storage.saveGroup(DEFAULT_GROUP);
    setAgents(await storage.listAgents());
    setGroups(await storage.listGroups());
  };

  const handleResetAllData = async () => {
    sessionCredentials.clearAll();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    setSession(null);
    setActiveGroupId(undefined);
    await handleSeedDemoData();
    setActiveTab('groups');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Main Navigation Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xs select-none shrink-0 z-20">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono tracking-wider">
              ROUNDTABLE
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 font-medium">
              Multi-Agent Orchestration
            </span>
          </div>
        </div>

        {/* Primary Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {/* Groups Tab */}
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'groups'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Groups</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'groups' ? 'bg-cyan-900/30 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {groups.length}
            </span>
          </button>

          {/* Agents Tab */}
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'agents'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Agents</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'agents' ? 'bg-cyan-900/30 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {agents.length}
            </span>
          </button>

          {/* Deliberation / Chat Tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'chat'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                : session
                ? 'text-cyan-300 hover:text-cyan-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
            {session && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
            )}
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </nav>

        {/* Right Quick Status */}
        <div className="flex items-center gap-2">
          {session ? (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-slate-400 truncate max-w-[150px]">
                {session.conversation.groupSnapshot.name}
              </span>
              <button
                onClick={() => {
                  if (confirm('Exit current deliberation session?')) {
                    setSession(null);
                    setActiveGroupId(undefined);
                    setActiveTab('groups');
                  }
                }}
                className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Exit
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGalleryModal(true)}
              className="hidden sm:flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Templates</span>
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === 'groups' && (
          <GroupsView
            groups={groups}
            agents={agents}
            activeGroupId={activeGroupId}
            onStartGroupChat={handleStartGroupChat}
            onSaveGroup={handleSaveGroup}
            onDeleteGroup={handleDeleteGroup}
            onNavigateToAgents={() => setActiveTab('agents')}
          />
        )}

        {activeTab === 'agents' && (
          <AgentsView
            agents={agents}
            onSaveAgent={handleSaveAgent}
            onDeleteAgent={handleDeleteAgent}
          />
        )}

        {activeTab === 'chat' && (
          session ? (
            <GroupChatCockpit
              session={session}
              onExit={() => {
                setActiveTab('groups');
              }}
              onReset={() => {
                if (confirm('Reset conversation turns and restart?')) {
                  const currentGroup = groups.find((g) => g.id === activeGroupId) || session.conversation.groupSnapshot;
                  handleStartGroupChat(currentGroup);
                }
              }}
              onSwitchSession={(newSession) => setSession(newSession)}
              showSummaryModal={showSummaryModal}
              setShowSummaryModal={setShowSummaryModal}
              showGalleryModal={showGalleryModal}
              setShowGalleryModal={setShowGalleryModal}
              onForceRefresh={() => setTick((t) => t + 1)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No Active Deliberation</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-6">
                Select a working group from the Groups tab to begin, or create a new group with custom agents and moderation.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('groups')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  <span>Go to Groups</span>
                </button>
                <button
                  onClick={() => setShowGalleryModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Browse Templates</span>
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'settings' && (
          <SettingsView
            onOpenGallery={() => setShowGalleryModal(true)}
            onOpenDevGuide={() => setShowDevGuideModal(true)}
            onResetAllData={handleResetAllData}
            onSeedDemoData={handleSeedDemoData}
          />
        )}
      </main>

      {/* Global Modals */}
      {showGalleryModal && (
        <TemplateGalleryModal
          onClose={() => setShowGalleryModal(false)}
          onApplyTemplate={async (grp, ags) => {
            setShowGalleryModal(false);
            // Save imported group and agents to storage
            for (const a of Object.values(ags)) {
              await storage.saveAgent(a);
            }
            await storage.saveGroup(grp);
            setAgents(await storage.listAgents());
            setGroups(await storage.listGroups());
            handleStartGroupChat(grp);
          }}
        />
      )}

      {showDevGuideModal && (
        <DeveloperGuideModal onClose={() => setShowDevGuideModal(false)} />
      )}
    </div>
  );
};

// Deliberation Room Cockpit
interface GroupChatCockpitProps {
  session: GroupChatSession;
  onExit: () => void;
  onReset: () => void;
  onSwitchSession: (session: GroupChatSession) => void;
  showSummaryModal: boolean;
  setShowSummaryModal: (show: boolean) => void;
  showGalleryModal: boolean;
  setShowGalleryModal: (show: boolean) => void;
  onForceRefresh: () => void;
}

const GroupChatCockpit: React.FC<GroupChatCockpitProps> = ({
  session,
  onExit,
  onReset,
  onSwitchSession,
  showSummaryModal,
  setShowSummaryModal,
  showGalleryModal,
  setShowGalleryModal,
  onForceRefresh,
}) => {
  const chat = useGroupChat(session);
  const [blindRunning, setBlindRunning] = useState(false);
  const [showRightWorkspace, setShowRightWorkspace] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<
    'blackboard' | 'branches' | 'dissent' | 'tools' | 'events' | 'harness'
  >('blackboard');

  // Attach VS Code / embed host bridge
  useEffect(() => {
    const detach = defaultVSCodeHost.attachSession(session);
    return () => detach();
  }, [session]);

  const handleSummarize = async () => {
    await chat.summarize();
    setShowSummaryModal(true);
  };

  const handleTriggerBlindRound = async () => {
    try {
      setBlindRunning(true);
      await chat.executeBlindRound();
    } catch (err: any) {
      alert(`Blind round error: ${err.message}`);
    } finally {
      setBlindRunning(false);
      onForceRefresh();
    }
  };

  const handleForkOnTurn = (turnId: string, branchName: string) => {
    const childSession = chat.forkBranch({ forkTurnId: turnId, newBranchName: branchName });
    onSwitchSession(childSession);
  };

  const protocol = chat.conversation.protocol || chat.conversation.groupSnapshot.protocol || 'standard';
  const branchName = chat.conversation.branch?.branchName || 'main';
  const blackboardItems = Object.values(chat.conversation.blackboard?.items || {});
  const dissentCount = chat.conversation.dissentLog?.length || 0;
  const isHumanMod = chat.conversation.groupSnapshot.moderatorId === 'user';
  const modAgent = !isHumanMod ? chat.conversation.agentSnapshots[chat.conversation.groupSnapshot.moderatorId] : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-hidden">
      {/* Deliberation Sub-Header */}
      <div className="flex items-center justify-between px-5 py-2 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white truncate max-w-sm">
              {chat.conversation.groupSnapshot.name}
            </h2>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 border-l border-slate-800 pl-3">
            <span>
              Moderator:{' '}
              {isHumanMod ? (
                <span className="text-cyan-300 font-mono font-medium">👤 You (Human)</span>
              ) : (
                <span className="text-purple-300 font-mono font-medium">🛡️ {modAgent?.name || 'AI Facilitator'}</span>
              )}
            </span>
            <span>·</span>
            <span>
              Turns: <span className="text-slate-200 font-mono">{chat.conversation.totalTurns}</span>
            </span>
          </div>
        </div>

        {/* Controls on the right */}
        <div className="flex items-center gap-1.5">
          {/* Toggle Advanced Workspace (Blackboard / Branches / Events) */}
          <button
            onClick={() => setShowRightWorkspace(!showRightWorkspace)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              showRightWorkspace
                ? 'bg-slate-800 border-slate-700 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Blackboard & Reasoning Tools"
          >
            {showRightWorkspace ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hide Sidebar</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Advanced Tools</span>
              </>
            )}
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            title="Restart Deliberation"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Restart</span>
          </button>
        </div>
      </div>

      {/* Main Deliberation Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left / Center: Message Transcript & Turn Controls */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-slate-800/80 bg-slate-950">
          {blindRunning && (
            <div className="p-2.5 bg-indigo-950/60 border-b border-indigo-800/80 text-xs text-indigo-200 flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-indigo-400" />
                <span>Executing parallel blind round: models generating without peer bias...</span>
              </span>
              <span className="font-mono text-[11px]">Epistemic Isolation</span>
            </div>
          )}

          <MessageList
            conversation={chat.conversation}
            streamingTurnId={chat.streamingTurnId}
            streamingContent={chat.streamingContent}
            moderatorNote={chat.moderatorNote}
          />

          <TurnControls
            conversation={chat.conversation}
            isRunning={chat.isRunning}
            isPaused={chat.isPaused}
            isEnded={chat.isEnded}
            onStart={chat.start}
            onStep={chat.step}
            onRun={chat.run}
            onPause={chat.pause}
            onResume={chat.resume}
            onStop={() => chat.stop('Stopped by user')}
            onInterject={chat.interject}
            onSummarize={handleSummarize}
            onBlindRound={handleTriggerBlindRound}
            onForkBranch={() => {
              setShowRightWorkspace(true);
              setActiveRightTab('branches');
            }}
          />
        </div>

        {/* Collapsible Right Pane for Advanced Reasoning Tools */}
        {showRightWorkspace && (
          <div className="w-[420px] xl:w-[460px] flex flex-col min-h-0 bg-slate-950 border-l border-slate-800">
            {/* Sidebar Tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-slate-800 bg-slate-900/60 overflow-x-auto text-xs">
              <button
                onClick={() => setActiveRightTab('blackboard')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                  activeRightTab === 'blackboard'
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Blackboard</span>
                {blackboardItems.length > 0 && (
                  <span className="px-1 text-[10px] font-mono bg-emerald-900/60 text-emerald-200 rounded">
                    {blackboardItems.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveRightTab('branches')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                  activeRightTab === 'branches'
                    ? 'bg-indigo-950/60 border border-indigo-500/50 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Branches</span>
              </button>

              <button
                onClick={() => setActiveRightTab('dissent')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                  activeRightTab === 'dissent'
                    ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Dissent</span>
                {dissentCount > 0 && (
                  <span className="px-1 text-[10px] font-mono bg-amber-900/60 text-amber-200 rounded">
                    {dissentCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveRightTab('events')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                  activeRightTab === 'events'
                    ? 'bg-cyan-950/60 border border-cyan-500/50 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Events</span>
              </button>

              <button
                onClick={() => setActiveRightTab('tools')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
                  activeRightTab === 'tools'
                    ? 'bg-blue-950/60 border border-blue-500/50 text-blue-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Tools</span>
              </button>
            </div>

            {/* Sidebar Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {activeRightTab === 'blackboard' && (
                <BlackboardView
                  blackboard={chat.conversation.blackboard || { items: {}, updatedAt: 0 }}
                  onAddItem={chat.addBlackboardItem}
                  onResolveItem={chat.resolveBlackboardItem}
                />
              )}

              {activeRightTab === 'branches' && (
                <BranchTreeVisualizer
                  conversation={chat.conversation}
                  onForkTurn={handleForkOnTurn}
                  onSwitchBranch={(convId) => {
                    const target = session.storage.loadConversation(convId);
                    target.then((c) => {
                      if (c) {
                        const switched = createGroupChat({
                          group: c.groupSnapshot,
                          agents: c.agentSnapshots,
                          initialEvents: c.events,
                          providerRegistry: session.providers,
                          storage: session.storage,
                        });
                        onSwitchSession(switched);
                      }
                    });
                  }}
                />
              )}

              {activeRightTab === 'dissent' && (
                <DissentLogView
                  conversation={chat.conversation}
                  onLogDissent={chat.logDissent}
                />
              )}

              {activeRightTab === 'events' && (
                <div className="flex-1 overflow-hidden p-3 bg-slate-950 flex flex-col">
                  <EventLogView conversation={chat.conversation} />
                </div>
              )}

              {activeRightTab === 'tools' && (
                <ToolsView onRunTool={chat.executeTool} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary Modal */}
      {showSummaryModal && (
        <SummaryView
          conversation={chat.conversation}
          onClose={() => setShowSummaryModal(false)}
        />
      )}
    </div>
  );
};
