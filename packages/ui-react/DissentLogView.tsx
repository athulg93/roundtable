/**
 * Dissent Log View (Phase 2 - P2.5)
 * Permanently archives minority viewpoints, objections, and reservations
 * to prevent majority groupthink and premature convergence.
 */

import React, { useState } from 'react';
import { Conversation, DissentItem } from '../core/types.ts';

interface DissentLogViewProps {
  conversation: Conversation;
  onLogDissent?: (objection: string, topic?: string) => void;
}

export const DissentLogView: React.FC<DissentLogViewProps> = ({
  conversation,
  onLogDissent,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [objection, setObjection] = useState('');
  const [topic, setTopic] = useState('');

  const dissentItems = conversation.dissentLog || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objection.trim() || !onLogDissent) return;
    onLogDissent(objection.trim(), topic.trim() || conversation.groupSnapshot.goal);
    setObjection('');
    setTopic('');
    setShowModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-900/60">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Epistemic Protection
          </div>
          <div className="text-sm font-medium text-slate-100 flex items-center gap-2 mt-0.5">
            <span>Dissent Log & Minority Opinions</span>
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300">
              {dissentItems.length} recorded
            </span>
          </div>
        </div>

        {onLogDissent && (
          <button
            onClick={() => setShowModal(true)}
            className="px-2.5 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded transition flex items-center gap-1"
          >
            <span>+ Log Reservation</span>
          </button>
        )}
      </div>

      <div className="p-3 bg-amber-950/20 border-b border-amber-900/40 text-[11px] text-amber-300/80 leading-relaxed">
        <strong>Guaranteed Minority Archival:</strong> Deliberation engines often succumb to
        premature consensus. The Dissent Log permanently records dissenting arguments so alternative
        viewpoints remain visible in final summaries.
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {dissentItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
            <div className="text-2xl mb-2">⚖️</div>
            <div className="text-sm font-medium text-slate-400">No active dissent recorded</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Any agent using <code>[Dissent]: ...</code> or <code>[Objection]: ...</code> syntax
              will automatically have their reservation preserved here.
            </p>
          </div>
        ) : (
          dissentItems.map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3.5 rounded border border-amber-900/50 bg-slate-900/70 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-amber-300">{item.agentName}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400 italic text-[11px]">{item.topic}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="text-xs text-slate-200 leading-relaxed bg-slate-950/50 p-2.5 rounded border border-slate-800/80">
                <span className="text-amber-400 font-semibold mr-1.5">[Formal Objection]</span>
                {item.objection}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Dissent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>⚠️</span> Log Dissenting Reservation
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Topic</label>
                <input
                  type="text"
                  placeholder={conversation.groupSnapshot.goal}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Objection / Risk</label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the core objection, unaddressed edge case, or reason for disagreement..."
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded transition"
                >
                  Save to Dissent Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
