/**
 * Interactive Branch Tree Visualizer (Phase 2 - P2.3 & Confirmed Decision 2)
 * Renders conversation branch lineage, fork points, and interactive what-if exploration.
 */

import React, { useState } from 'react';
import { Conversation, Turn } from '../core/types.ts';
import { BranchInfo, defaultBranchRegistry } from '../reasoning/branching.ts';

interface BranchTreeVisualizerProps {
  conversation: Conversation;
  onForkTurn?: (turnId: string, branchName: string) => void;
  onSwitchBranch?: (conversationId: string) => void;
}

export const BranchTreeVisualizer: React.FC<BranchTreeVisualizerProps> = ({
  conversation,
  onForkTurn,
  onSwitchBranch,
}) => {
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [showForkModal, setShowForkModal] = useState(false);

  const branches = defaultBranchRegistry.list();
  const currentBranch = conversation.branch;
  const turns = conversation.turns.filter((t) => t.status === 'completed');

  const handleOpenFork = (turnId: string) => {
    setSelectedTurnId(turnId);
    const turnIndex = turns.findIndex((t) => t.id === turnId) + 1;
    setNewBranchName(`what-if-turn-${turnIndex}`);
    setShowForkModal(true);
  };

  const handleForkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurnId || !onForkTurn) return;
    onForkTurn(selectedTurnId, newBranchName.trim() || `branch-${Date.now().toString(36).slice(-4)}`);
    setShowForkModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-900/60">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            What-If Exploration
          </div>
          <div className="text-sm font-medium text-slate-100 flex items-center gap-2 mt-0.5">
            <span>Interactive Branch Tree</span>
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
              {currentBranch?.branchName || 'main'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono tabular-nums">{turns.length} turns</span>
          {branches.length > 0 && (
            <>
              <span>·</span>
              <span className="font-mono tabular-nums">{branches.length} branches</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Branch Graph / Lineage Visualizer */}
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Branch Lineage</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Forked streams derive deterministically from parents
            </span>
          </div>

          <div className="relative pl-4 space-y-3 border-l-2 border-indigo-500/40 my-2">
            {/* Root / Main Branch */}
            <div className="relative">
              <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-950" />
              <div className="p-2.5 rounded border border-slate-800 bg-slate-900 text-xs flex items-center justify-between">
                <div>
                  <span className="font-mono text-indigo-400 font-medium">main</span>
                  <span className="text-slate-500 ml-2">Root session</span>
                </div>
                {currentBranch?.branchName === 'main' && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-indigo-900/50 border border-indigo-700 text-indigo-300 rounded font-mono">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Child Branches */}
            {branches.map((b) => (
              <div key={b.conversationId} className="relative pl-3">
                <div className="absolute -left-[21px] top-2.5 w-2 h-2 rounded-full bg-cyan-400 ring-4 ring-slate-950" />
                <div
                  className={`p-2.5 rounded border text-xs flex items-center justify-between transition ${
                    conversation.id === b.conversationId
                      ? 'border-cyan-500/60 bg-cyan-950/20'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <span className="font-mono text-cyan-300 font-medium">{b.name}</span>
                    <span className="text-slate-500 ml-2 font-mono text-[11px]">
                      (Forked at turn {b.forkTurnSequence || '?'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {conversation.id === b.conversationId ? (
                      <span className="px-1.5 py-0.5 text-[10px] bg-cyan-900/50 border border-cyan-700 text-cyan-300 rounded font-mono">
                        ACTIVE
                      </span>
                    ) : (
                      onSwitchBranch && (
                        <button
                          onClick={() => onSwitchBranch(b.conversationId)}
                          className="px-2 py-0.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition"
                        >
                          Switch
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Turn-by-Turn Fork Picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Explore Counterfactuals (Fork on Turn)
            </h4>
            <span className="text-xs text-slate-500">Click any turn to branch</span>
          </div>

          {turns.length === 0 ? (
            <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg text-xs">
              No completed turns to fork yet. Run a step to generate conversational turns.
            </div>
          ) : (
            <div className="space-y-2">
              {turns.map((turn, idx) => (
                <div
                  key={turn.id}
                  className="p-3 rounded border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="font-mono text-xs text-slate-500 tabular-nums w-6 text-right shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="font-medium text-slate-200">{turn.speakerName}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono text-[10px] text-slate-500">{turn.selectedModel}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
                        {turn.content.slice(0, 100)}...
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenFork(turn.id)}
                    className="shrink-0 px-2.5 py-1 text-xs font-medium bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded transition flex items-center gap-1"
                  >
                    <span>🌿 Fork Here</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fork Modal */}
      {showForkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>🌿</span> Fork Deliberation Branch
              </h3>
              <button
                onClick={() => setShowForkModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleForkSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">
                Spawns a new independent session retaining all context up to Turn #{' '}
                {turns.findIndex((t) => t.id === selectedTurnId) + 1}. Future turns on this branch will
                not affect the parent branch.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. what-if-grpc, adversarial-test"
                  className="w-full p-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForkModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
                >
                  Create & Switch Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
