/**
 * GroupChat Component (Phase 1 MVP + Phase 2 Reasoning Engine)
 * Two-pane deliberation cockpit with shared blackboard, interactive branch tree,
 * dissent log, parallel blind deliberation, and event log replay.
 */

import React, { useState } from 'react';
import { Group, Agent } from '../core/types.ts';
import { GroupChatSession, createGroupChat } from '../core/orchestrator.ts';
import { useGroupChat } from './useGroupChat.ts';
import { MessageList } from './MessageList.tsx';
import { TurnControls } from './TurnControls.tsx';
import { SummaryView } from './SummaryView.tsx';
import { GroupSetup } from './GroupSetup.tsx';
import { BlackboardView } from './BlackboardView.tsx';
import { BranchTreeVisualizer } from './BranchTreeVisualizer.tsx';
import { DissentLogView } from './DissentLogView.tsx';
import { EventLogView } from './EventLogView.tsx';
import { TestHarness } from './TestHarness.tsx';
import { ToolsView } from './ToolsView.tsx';
import { TemplateGalleryModal } from './TemplateGalleryModal.tsx';
import { defaultVSCodeHost } from '../embed/vscodeHost.ts';
import { LocalStorageAdapter } from '../storage/localStorage.ts';
import { defaultProviderRegistry } from '../providers/registry.ts';
import {
  Layers,
  ShieldAlert,
  Settings,
  GitBranch,
  ClipboardList,
  Scale,
  EyeOff,
  Sparkles,
  Wrench,
} from 'lucide-react';

export interface GroupChatProps {
  initialSession?: GroupChatSession;
}

export const GroupChat: React.FC<GroupChatProps> = ({ initialSession }) => {
  const [session, setSession] = useState<GroupChatSession | null>(initialSession || null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<
    'blackboard' | 'branches' | 'dissent' | 'tools' | 'events' | 'harness'
  >('blackboard');
  const [, setTick] = useState(0);

  const storage = new LocalStorageAdapter();

  const handleCreateSession = (
    group: Group,
    agents: Record<string, Agent>,
    customAdapters?: Record<string, import('../providers/types.ts').ProviderAdapter>
  ) => {
    if (customAdapters) {
      for (const [, adapter] of Object.entries(customAdapters)) {
        defaultProviderRegistry.register(adapter);
      }
    }

    // Persist group & agents
    storage.saveGroup(group).catch(console.error);
    for (const a of Object.values(agents)) {
      storage.saveAgent(a).catch(console.error);
    }

    const newSession = createGroupChat({
      group,
      agents,
      storage,
      providerRegistry: defaultProviderRegistry,
    });
    setSession(newSession);
  };

  const handleReset = () => {
    if (confirm('Start a new session? Current session is saved in local history.')) {
      setSession(null);
    }
  };

  const handleSwitchSession = (newSession: GroupChatSession) => {
    setSession(newSession);
  };

  if (!session) {
    return <GroupSetup onStartSession={handleCreateSession} />;
  }

  return (
    <GroupChatCockpit
      session={session}
      onReset={handleReset}
      onSwitchSession={handleSwitchSession}
      showSummaryModal={showSummaryModal}
      setShowSummaryModal={setShowSummaryModal}
      showGalleryModal={showGalleryModal}
      setShowGalleryModal={setShowGalleryModal}
      activeRightTab={activeRightTab}
      setActiveRightTab={setActiveRightTab}
      onForceRefresh={() => setTick((t) => t + 1)}
    />
  );
};

interface GroupChatCockpitProps {
  session: GroupChatSession;
  onReset: () => void;
  onSwitchSession: (session: GroupChatSession) => void;
  showSummaryModal: boolean;
  setShowSummaryModal: (show: boolean) => void;
  showGalleryModal: boolean;
  setShowGalleryModal: (show: boolean) => void;
  activeRightTab: 'blackboard' | 'branches' | 'dissent' | 'tools' | 'events' | 'harness';
  setActiveRightTab: (tab: 'blackboard' | 'branches' | 'dissent' | 'tools' | 'events' | 'harness') => void;
  onForceRefresh: () => void;
}

const GroupChatCockpit: React.FC<GroupChatCockpitProps> = ({
  session,
  onReset,
  onSwitchSession,
  showSummaryModal,
  setShowSummaryModal,
  showGalleryModal,
  setShowGalleryModal,
  activeRightTab,
  setActiveRightTab,
  onForceRefresh,
}) => {
  const chat = useGroupChat(session);
  const [blindRunning, setBlindRunning] = useState(false);

  // Attach VS Code / embed host bridge
  React.useEffect(() => {
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Deliberation Top Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono tracking-wider">
              ROUNDTABLE
            </span>
            <h1 className="text-sm font-bold tracking-tight text-white truncate max-w-xs">
              {chat.conversation.groupSnapshot.name}
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400 border-l border-slate-800 pl-3">
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
              Protocol:{' '}
              <span className="text-cyan-300 font-mono font-medium capitalize">
                {protocol.replace('-', ' ')}
              </span>
            </span>
            <span>·</span>
            <span>
              Branch:{' '}
              <span className="text-indigo-300 font-mono font-medium">{branchName}</span>
            </span>
            <span>·</span>
            <span>
              Turns: <span className="text-slate-200 font-mono tabular-nums">{chat.conversation.totalTurns}</span>
            </span>
          </div>
        </div>

        {/* Right workspace tab switcher */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveRightTab('blackboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
              activeRightTab === 'blackboard'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Blackboard</span>
            {blackboardItems.length > 0 && (
              <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-emerald-900/60 text-emerald-200">
                {blackboardItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveRightTab('branches')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
              activeRightTab === 'branches'
                ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Branch Tree</span>
          </button>

          <button
            onClick={() => setActiveRightTab('dissent')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
              activeRightTab === 'dissent'
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Dissent</span>
            {dissentCount > 0 && (
              <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-amber-900/60 text-amber-200">
                {dissentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveRightTab('events')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
              activeRightTab === 'events'
                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Events</span>
          </button>

          <button
            onClick={() => setActiveRightTab('harness')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
              activeRightTab === 'harness'
                ? 'bg-purple-950/60 border-purple-500/60 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Harness</span>
          </button>

          <button
            onClick={() => setActiveRightTab('tools')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition ${
              activeRightTab === 'tools'
                ? 'bg-blue-950/60 border-blue-500/60 text-blue-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Tools</span>
          </button>

          <button
            onClick={() => setShowGalleryModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-medium transition ml-1"
            title="Open Deliberation Template Gallery"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Gallery</span>
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition ml-0.5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Setup</span>
          </button>
        </div>
      </header>

      {/* Main Two-Pane Deliberation Cockpit */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Pane: Deliberation Transcript & Controls */}
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
            onForkBranch={() => setActiveRightTab('branches')}
          />
        </div>

        {/* Right Pane: Deliberation Workspace (Blackboard / Branch Tree / Dissent / Events) */}
        <div className="w-[440px] xl:w-[480px] hidden lg:flex flex-col min-h-0 bg-slate-950">
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
                // If switching to an existing branch
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

          {activeRightTab === 'harness' && (
            <div className="flex-1 overflow-hidden p-3 bg-slate-950 flex flex-col">
              <TestHarness session={session} onRefreshView={onForceRefresh} />
            </div>
          )}
        </div>
      </div>

      {/* Summaries & Export Modal */}
      {showSummaryModal && (
        <SummaryView
          conversation={chat.conversation}
          onClose={() => setShowSummaryModal(false)}
        />
      )}

      {/* Deliberation Template Gallery Modal */}
      {showGalleryModal && (
        <TemplateGalleryModal
          onClose={() => setShowGalleryModal(false)}
          onApplyTemplate={(grp, ags) => {
            const newSession = createGroupChat({
              group: grp,
              agents: ags,
              providerRegistry: session.providers,
              storage: session.storage,
            });
            onSwitchSession(newSession);
          }}
        />
      )}
    </div>
  );
};
