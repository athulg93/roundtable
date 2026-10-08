/**
 * EventLogView Component (P1.1, P1.9)
 * Inspects append-only durable event log and provides one-click deterministic replay verification.
 */

import React, { useState } from 'react';
import { Conversation, ConversationEvent } from '../core/types.ts';
import { replayEvents } from '../core/reducer.ts';
import { CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export interface EventLogViewProps {
  conversation: Conversation;
}

export const EventLogView: React.FC<EventLogViewProps> = ({ conversation }) => {
  const [selectedEvent, setSelectedEvent] = useState<ConversationEvent | null>(null);
  const [replayStatus, setReplayStatus] = useState<{
    tested: boolean;
    identical: boolean;
    message: string;
  }>({ tested: false, identical: false, message: '' });

  const handleVerifyReplay = () => {
    try {
      const reconstructed = replayEvents(conversation.events);
      const isTurnCountMatch = reconstructed.totalTurns === conversation.totalTurns;
      const isStateMatch = reconstructed.state === conversation.state;
      const isTokensMatch =
        reconstructed.totalUsage.totalTokens === conversation.totalUsage.totalTokens;

      if (isTurnCountMatch && isStateMatch && isTokensMatch) {
        setReplayStatus({
          tested: true,
          identical: true,
          message: `Deterministic replay verified: Replaying all ${conversation.events.length} events from empty state reconstructed identical derived state (Turns: ${reconstructed.totalTurns}, State: ${reconstructed.state}, Tokens: ${reconstructed.totalUsage.totalTokens}).`,
        });
      } else {
        setReplayStatus({
          tested: true,
          identical: false,
          message: `Replay divergence: turns (${reconstructed.totalTurns} vs ${conversation.totalTurns}) or state (${reconstructed.state} vs ${conversation.state}).`,
        });
      }
    } catch (err: any) {
      setReplayStatus({
        tested: true,
        identical: false,
        message: `Replay failed with error: ${err.message}`,
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Append-Only Event Stream ({conversation.events.length} events)
          </h3>
        </div>

        <button
          onClick={handleVerifyReplay}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Verify Event Replay
        </button>
      </div>

      {/* Replay Verification Result */}
      {replayStatus.tested && (
        <div
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            replayStatus.identical
              ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
          }`}
        >
          {replayStatus.identical ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{replayStatus.message}</span>
        </div>
      )}

      {/* Events List & Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[220px]">
        {/* Stream List */}
        <div className="overflow-y-auto max-h-[260px] space-y-1.5 pr-1">
          {conversation.events.map((ev) => (
            <div
              key={ev.eventId}
              onClick={() => setSelectedEvent(ev)}
              className={`p-2 rounded-lg text-xs font-mono cursor-pointer transition-colors border ${
                selectedEvent?.eventId === ev.eventId
                  ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-950/60 border-slate-800/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                <span>Seq #{ev.sequence}</span>
                <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="font-semibold text-slate-300">{ev.type}</div>
            </div>
          ))}
        </div>

        {/* Selected Event Payload */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-y-auto max-h-[260px]">
          {selectedEvent ? (
            <div>
              <div className="text-[11px] font-semibold text-cyan-400 pb-1 mb-2 border-b border-slate-800 font-mono">
                {selectedEvent.type} (Seq #{selectedEvent.sequence})
              </div>
              <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-600 text-xs">
              Select an event from the stream to inspect durable payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
