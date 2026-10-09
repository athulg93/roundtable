/**
 * MessageList Component (P1.10)
 * Renders conversation turns with distinct speaker identities, live streaming,
 * failure recovery notices, and usage metadata.
 */

import React, { useEffect, useRef } from 'react';
import { Conversation, Turn } from '../core/types.ts';
import { Bot, User, Shield, AlertTriangle, CornerDownRight, CheckCircle2, Clock, Wrench, Volume2 } from 'lucide-react';
import { defaultVoiceEngine } from './speechSynthesis.ts';

export interface MessageListProps {
  conversation: Conversation;
  streamingTurnId: string | null;
  streamingContent: string;
  moderatorNote: string | null;
}

export const MessageList: React.FC<MessageListProps> = ({
  conversation,
  streamingTurnId,
  streamingContent,
  moderatorNote,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.turns.length, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Discussion Goal / Pinned Topic Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm text-slate-200">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          <span>Topic / Deliberation Goal</span>
          <span className="text-cyan-400">
            {Object.keys(conversation.agentSnapshots).length} Agents Active
          </span>
        </div>
        <p className="text-sm font-medium text-slate-100">{conversation.groupSnapshot.goal}</p>
      </div>

      {/* Rolling Summary Banner if exists */}
      {conversation.summaries.rollingSummary && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 text-amber-200 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
            <Clock className="w-4 h-4" />
            <span>Rolling Context Summary (Older turns condensed to preserve context budget)</span>
          </div>
          <p className="text-amber-100/90 leading-relaxed font-mono text-[11px]">
            {conversation.summaries.rollingSummary}
          </p>
        </div>
      )}

      {/* Empty State */}
      {conversation.turns.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-40 text-cyan-400" />
          <p className="text-base font-medium text-slate-300">Conversation Initialized</p>
          <p className="text-xs text-slate-500 mt-1">
            Click <strong>Start</strong> or <strong>Step</strong> to begin the multi-agent deliberation.
          </p>
        </div>
      )}

      {/* Turn History */}
      {conversation.turns.map((turn, index) => {
        const agent = conversation.agentSnapshots[turn.speakerId];
        const isStreaming = turn.id === streamingTurnId;
        const textContent = isStreaming ? streamingContent || turn.content : turn.content;
        const color = agent?.visualIdentity.color || '#3b82f6';
        const isModerator = turn.role === 'moderator';
        const isUser = turn.role === 'user';

        return (
          <div
            key={turn.id}
            className={`rounded-xl border p-4 transition-all ${
              isUser
                ? 'bg-blue-950/40 border-blue-800/60 ml-8'
                : isModerator
                ? 'bg-purple-950/30 border-purple-800/50 mr-4'
                : 'bg-slate-900/90 border-slate-800 mr-8'
            }`}
          >
            {/* Turn Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                {/* Avatar Icon */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {isUser ? (
                    <User className="w-4 h-4" />
                  ) : isModerator ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-200">
                      {turn.speakerName}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isUser
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : isModerator
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isUser ? 'HUMAN' : isModerator ? 'MODERATOR' : 'AGENT'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Turn #{index + 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Model, Audio & Usage Badges */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {textContent && (
                  <button
                    onClick={() => defaultVoiceEngine.speak(textContent, agent)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                    title={`Read aloud turn as ${turn.speakerName}`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isUser && (
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-400 font-mono text-[10px]">
                    {turn.selectedModel}
                  </span>
                )}
                {turn.usage && (
                  <span className="text-[10px] text-slate-500">
                    {turn.usage.inputTokens}in / {turn.usage.outputTokens}out ({turn.usage.latencyMs}ms)
                  </span>
                )}
              </div>
            </div>

            {/* Turn Content */}
            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {textContent || (
                isStreaming ? (
                  <span className="inline-flex items-center gap-1.5 text-cyan-400 text-xs italic">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
                    Generating stream...
                  </span>
                ) : turn.status === 'started' ? (
                  <span className="text-slate-500 text-xs italic">Preparing turn...</span>
                ) : null
              )}
            </div>

            {/* Grounded Tool Executions */}
            {turn.toolCalls && turn.toolCalls.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-cyan-400" />
                  <span>Grounded Tool Executions ({turn.toolCalls.length})</span>
                </span>
                <div className="space-y-1.5">
                  {turn.toolCalls.map((tc, tcIdx) => (
                    <div
                      key={tcIdx}
                      className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between text-[11px] text-cyan-300">
                        <span>[Tool: {tc.toolName}]</span>
                        {tc.executionMs !== undefined && (
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            {tc.executionMs}ms
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                        {tc.output}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error or Skipped Status Notice */}
            {turn.status === 'failed' && turn.error && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div>
                  <span className="font-semibold uppercase tracking-wider text-[10px] block">
                    Turn Error ({turn.error.code})
                  </span>
                  <span>{turn.error.message}</span>
                  {turn.recoveryAction && (
                    <span className="block mt-1 text-[11px] text-red-400">
                      Recovery Action applied: <strong>{turn.recoveryAction.toUpperCase()}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {turn.status === 'skipped' && (
              <div className="mt-2 text-xs text-amber-400/80 italic flex items-center gap-1">
                <CornerDownRight className="w-3.5 h-3.5" />
                Turn skipped or interrupted.
              </div>
            )}
          </div>
        );
      })}

      {/* Real-time Moderator Note Notice */}
      {moderatorNote && (
        <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-2.5 text-xs text-purple-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Moderator Guidance:</strong> {moderatorNote}
          </span>
        </div>
      )}

      {/* Terminal Conversation Ended Notice */}
      {conversation.state === 'ended' && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Deliberation Concluded:</strong>{' '}
            {conversation.terminationReason || 'Conversation reached terminal state.'}
          </span>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};
