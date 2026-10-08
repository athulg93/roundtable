/**
 * GroupChat Component (P1.10)
 * Reusable React component embedding the complete Multi-Agent Group Chat system.
 */

import React, { useState } from 'react';
import { Group, Agent } from '../core/types.ts';
import { GroupChatSession, createGroupChat } from '../core/orchestrator.ts';
import { useGroupChat } from './useGroupChat.ts';
import { MessageList } from './MessageList.tsx';
import { TurnControls } from './TurnControls.tsx';
import { SummaryView } from './SummaryView.tsx';
import { GroupSetup } from './GroupSetup.tsx';
import { EventLogView } from './EventLogView.tsx';
import { TestHarness } from './TestHarness.tsx';
import { LocalStorageAdapter } from '../storage/localStorage.ts';
import { defaultProviderRegistry } from '../providers/registry.ts';
import { Layers, ShieldAlert, Settings, MessageSquare } from 'lucide-react';

export interface GroupChatProps {
  initialSession?: GroupChatSession;
}

export const GroupChat: React.FC<GroupChatProps> = ({ initialSession }) => {
  const [session, setSession] = useState<GroupChatSession | null>(initialSession || null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'none' | 'events' | 'harness'>('harness');
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

  if (!session) {
    return <GroupSetup onStartSession={handleCreateSession} />;
  }

  return (
    <GroupChatInner
      session={session}
      onReset={handleReset}
      showSummaryModal={showSummaryModal}
      setShowSummaryModal={setShowSummaryModal}
      activeBottomTab={activeBottomTab}
      setActiveBottomTab={setActiveBottomTab}
      onForceRefresh={() => setTick((t) => t + 1)}
    />
  );
};

const GroupChatInner: React.FC<{
  session: GroupChatSession;
  onReset: () => void;
  showSummaryModal: boolean;
  setShowSummaryModal: (show: boolean) => void;
  activeBottomTab: 'none' | 'events' | 'harness';
  setActiveBottomTab: (tab: 'none' | 'events' | 'harness') => void;
  onForceRefresh: () => void;
}> = ({
  session,
  onReset,
  showSummaryModal,
  setShowSummaryModal,
  activeBottomTab,
  setActiveBottomTab,
  onForceRefresh,
}) => {
  const chat = useGroupChat(session);

  const handleSummarize = async () => {
    await chat.summarize();
    setShowSummaryModal(true);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono tracking-wider">
              ROUNDTABLE
            </span>
            <h1 className="text-sm font-bold tracking-tight text-white">
              {chat.conversation.groupSnapshot.name}
            </h1>
          </div>
          <span className="text-[11px] text-slate-400 border-l border-slate-700 pl-3 hidden sm:inline">
            Policy: <span className="text-cyan-300 font-mono">{chat.conversation.groupSnapshot.speakerPolicy}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Tab triggers */}
          <button
            onClick={() => setActiveBottomTab(activeBottomTab === 'events' ? 'none' : 'events')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              activeBottomTab === 'events'
                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Event Stream
          </button>

          <button
            onClick={() => setActiveBottomTab(activeBottomTab === 'harness' ? 'none' : 'harness')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              activeBottomTab === 'harness'
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Acceptance Harness
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            New Group
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Message List */}
        <MessageList
          conversation={chat.conversation}
          streamingTurnId={chat.streamingTurnId}
          streamingContent={chat.streamingContent}
          moderatorNote={chat.moderatorNote}
        />

        {/* Collapsible Inspection Panel (Event Log / Test Harness) */}
        {activeBottomTab === 'events' && (
          <div className="border-t border-slate-800 max-h-[300px] overflow-hidden p-3 bg-slate-950">
            <EventLogView conversation={chat.conversation} />
          </div>
        )}

        {activeBottomTab === 'harness' && (
          <div className="border-t border-slate-800 max-h-[280px] overflow-hidden p-3 bg-slate-950">
            <TestHarness session={session} onRefreshView={onForceRefresh} />
          </div>
        )}

        {/* Bottom Turn Controls */}
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
        />
      </div>

      {/* Summaries & Export Modal */}
      {showSummaryModal && (
        <SummaryView
          conversation={chat.conversation}
          onClose={() => setShowSummaryModal(false)}
        />
      )}
    </div>
  );
};
