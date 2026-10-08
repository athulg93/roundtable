/**
 * TurnControls Component (P1.10)
 * Provides execution buttons (Start, Step, Run, Pause, Resume, Stop),
 * speaker picker, user interjection composer, and real-time usage metrics.
 */

import React, { useState } from 'react';
import { Conversation, RunOptions } from '../core/types.ts';
import {
  Play,
  Pause,
  Square,
  StepForward,
  Send,
  FileText,
  Activity,
  Layers,
  Zap,
} from 'lucide-react';

export interface TurnControlsProps {
  conversation: Conversation;
  isRunning: boolean;
  isPaused: boolean;
  isEnded: boolean;
  onStart: () => void;
  onStep: (agentId?: string, options?: RunOptions) => void;
  onRun: (options?: RunOptions) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onInterject: (text: string) => void;
  onSummarize: () => void;
}

export const TurnControls: React.FC<TurnControlsProps> = ({
  conversation,
  isRunning,
  isPaused,
  isEnded,
  onStart,
  onStep,
  onRun,
  onPause,
  onResume,
  onStop,
  onInterject,
  onSummarize,
}) => {
  const [interjectText, setInterjectText] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');

  const participants = Object.values(conversation.agentSnapshots).filter(
    (a) => a.role === 'participant'
  );

  const handleInterject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interjectText.trim()) return;
    onInterject(interjectText.trim());
    setInterjectText('');
  };

  const handleStep = () => {
    onStep(selectedSpeakerId || undefined);
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950 p-4 space-y-3">
      {/* Telemetry & State Status Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          {/* State Badge */}
          <span
            className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold uppercase tracking-wider ${
              conversation.state === 'running'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                : conversation.state === 'paused'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : conversation.state === 'ended'
                ? 'bg-slate-700/40 text-slate-400 border border-slate-700'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            ● {conversation.state}
          </span>

          <span className="flex items-center gap-1 font-mono">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Round {conversation.roundCount}
          </span>

          <span className="flex items-center gap-1 font-mono">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            {conversation.totalTurns} Turns
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Tokens: {conversation.totalUsage.totalTokens.toLocaleString()} ({conversation.totalUsage.inputTokens}in / {conversation.totalUsage.outputTokens}out)
          </span>
          <span>Latency: {conversation.totalUsage.latencyMs}ms</span>
          <span>Est. Cost: ${conversation.totalUsage.estimatedCost.toFixed(5)}</span>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {conversation.state === 'idle' && (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Session
          </button>
        )}

        {!isRunning && !isEnded && (
          <button
            onClick={() => onRun()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Auto
          </button>
        )}

        {!isRunning && !isEnded && (
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <select
              value={selectedSpeakerId}
              onChange={(e) => setSelectedSpeakerId(e.target.value)}
              className="bg-transparent text-slate-300 text-xs px-2 py-1.5 rounded outline-none cursor-pointer"
            >
              <option value="">Policy Selected Speaker</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  Manual: {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleStep}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors"
            >
              <StepForward className="w-3.5 h-3.5" />
              Step Turn
            </button>
          </div>
        )}

        {isRunning && (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Resume
          </button>
        )}

        {!isEnded && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop / Abort
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onSummarize}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            Summarize
          </button>
        </div>
      </div>

      {/* User Interjection Composer */}
      <form onSubmit={handleInterject} className="flex gap-2">
        <input
          type="text"
          value={interjectText}
          onChange={(e) => setInterjectText(e.target.value)}
          placeholder="Interject as User into conversation context (steer, question, or clarify)..."
          disabled={isEnded}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!interjectText.trim() || isEnded}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs transition-colors shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          Interject
        </button>
      </form>
    </div>
  );
};
