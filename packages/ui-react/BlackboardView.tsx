/**
 * Shared Structured Blackboard View (Phase 2 - P2.1)
 * High-density shared working memory canvas with Decisions, Hypotheses, Assumptions, and Open Questions.
 */

import React, { useState } from 'react';
import { BlackboardItem, BlackboardState } from '../core/types.ts';

interface BlackboardViewProps {
  blackboard: BlackboardState;
  onAddItem?: (
    category: 'decision' | 'hypothesis' | 'assumption' | 'open_question',
    text: string
  ) => void;
  onResolveItem?: (itemId: string, status: 'resolved' | 'rejected', reason?: string) => void;
}

const CATEGORY_CONFIG: Record<
  'decision' | 'hypothesis' | 'assumption' | 'open_question',
  { label: string; icon: string; badgeClass: string; borderClass: string }
> = {
  decision: {
    label: 'Decisions',
    icon: '✅',
    badgeClass: 'text-emerald-400 border-emerald-800/60 bg-emerald-950/40',
    borderClass: 'border-emerald-500/30',
  },
  hypothesis: {
    label: 'Hypotheses',
    icon: '💡',
    badgeClass: 'text-amber-400 border-amber-800/60 bg-amber-950/40',
    borderClass: 'border-amber-500/30',
  },
  assumption: {
    label: 'Assumptions',
    icon: '⚠️',
    badgeClass: 'text-orange-400 border-orange-800/60 bg-orange-950/40',
    borderClass: 'border-orange-500/30',
  },
  open_question: {
    label: 'Open Questions',
    icon: '❓',
    badgeClass: 'text-cyan-400 border-cyan-800/60 bg-cyan-950/40',
    borderClass: 'border-cyan-500/30',
  },
};

export const BlackboardView: React.FC<BlackboardViewProps> = ({
  blackboard,
  onAddItem,
  onResolveItem,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState<
    'decision' | 'hypothesis' | 'assumption' | 'open_question'
  >('decision');
  const [newText, setNewText] = useState('');
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveReason, setResolveReason] = useState('');

  const items = Object.values(blackboard?.items || {});
  const filteredItems = items.filter((item) => {
    if (filter === 'active') return item.status === 'active';
    if (filter === 'resolved') return item.status === 'resolved' || item.status === 'rejected';
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !onAddItem) return;
    onAddItem(newCategory, newText.trim());
    setNewText('');
    setShowAddModal(false);
  };

  const handleResolve = (itemId: string, status: 'resolved' | 'rejected') => {
    if (onResolveItem) {
      onResolveItem(itemId, status, resolveReason || undefined);
    }
    setResolveTarget(null);
    setResolveReason('');
  };

  const categories: Array<'decision' | 'hypothesis' | 'assumption' | 'open_question'> = [
    'decision',
    'hypothesis',
    'assumption',
    'open_question',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-900/60">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Shared Working Memory
          </div>
          <div className="text-sm font-medium text-slate-100 flex items-center gap-2 mt-0.5">
            <span>Structured Blackboard</span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              ({items.length} items · {items.filter((i) => i.status === 'active').length} active)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <div className="inline-flex rounded border border-slate-800 bg-slate-900 p-0.5 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded transition ${
                filter === 'all'
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-2 py-0.5 rounded transition ${
                filter === 'active'
                  ? 'bg-emerald-900/60 text-emerald-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-2 py-0.5 rounded transition ${
                filter === 'resolved'
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolved
            </button>
          </div>

          {onAddItem && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition flex items-center gap-1"
            >
              <span>+ Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Blackboard Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
            <div className="text-2xl mb-2">📋</div>
            <div className="text-sm font-medium text-slate-400">Blackboard is empty</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Agents automatically record decisions, hypotheses, assumptions, and open questions
              during deliberation, or you can add items manually.
            </p>
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = filteredItems.filter((i) => i.category === cat);
            const conf = CATEGORY_CONFIG[cat];
            if (catItems.length === 0 && filter !== 'all') return null;

            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400 border-b border-slate-800/80 pb-1">
                  <span className="flex items-center gap-1.5">
                    <span>{conf.icon}</span>
                    <span className="uppercase tracking-wider">{conf.label}</span>
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">{catItems.length}</span>
                </div>

                {catItems.length === 0 ? (
                  <div className="text-xs text-slate-600 italic py-2">No {conf.label.toLowerCase()}</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded border bg-slate-900/70 transition ${
                          item.status === 'active'
                            ? conf.borderClass
                            : 'border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs leading-relaxed text-slate-200 flex-1">{item.text}</p>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] uppercase font-mono rounded border ${
                              item.status === 'active'
                                ? conf.badgeClass
                                : item.status === 'resolved'
                                ? 'text-emerald-400 border-emerald-900 bg-emerald-950/20'
                                : 'text-slate-400 border-slate-800 bg-slate-900'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {item.resolvedReason && (
                          <div className="mt-2 text-[11px] text-slate-400 border-l-2 border-emerald-600/60 pl-2">
                            Reason: {item.resolvedReason}
                          </div>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">{item.authorName}</span>
                            <span>·</span>
                            <span className="font-mono text-[10px]">
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {item.status === 'active' && onResolveItem && (
                            <div className="flex items-center gap-1.5">
                              {resolveTarget === item.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="Resolution reason..."
                                    value={resolveReason}
                                    onChange={(e) => setResolveReason(e.target.value)}
                                    className="px-1.5 py-0.5 text-[11px] bg-slate-950 border border-slate-700 rounded text-slate-200 outline-none w-32"
                                  />
                                  <button
                                    onClick={() => handleResolve(item.id, 'resolved')}
                                    className="px-1.5 py-0.5 text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white rounded"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleResolve(item.id, 'rejected')}
                                    className="px-1.5 py-0.5 text-[10px] bg-red-900 hover:bg-red-800 text-white rounded"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => setResolveTarget(null)}
                                    className="px-1 py-0.5 text-[10px] text-slate-400"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setResolveTarget(item.id)}
                                  className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
                                >
                                  Resolve...
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100">Add to Shared Blackboard</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCategory(c)}
                      className={`p-2 rounded text-xs text-left border flex items-center gap-2 transition ${
                        newCategory === c
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>{CATEGORY_CONFIG[c].icon}</span>
                      <span>{CATEGORY_CONFIG[c].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Content</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter observation, validated decision, hypothesis, or open question..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
                >
                  Add to Blackboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
