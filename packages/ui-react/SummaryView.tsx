/**
 * SummaryView Component (P1.8, P1.9)
 * Renders next-steps and detailed summaries, plus JSON & Markdown exports.
 */

import React, { useState } from 'react';
import { Conversation } from '../core/types.ts';
import { ExportService } from '../storage/exportService.ts';
import { Check, Copy, Download, ShieldCheck, X, FileText, CheckCircle2 } from 'lucide-react';

export interface SummaryViewProps {
  conversation: Conversation;
  onClose: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ conversation, onClose }) => {
  const [activeTab, setActiveTab] = useState<'next-steps' | 'detailed' | 'export-json' | 'export-md'>('next-steps');
  const [copied, setCopied] = useState(false);

  const jsonExport = ExportService.exportToJson(conversation);
  const mdExport = ExportService.exportToMarkdown(conversation);
  const nextSteps = conversation.summaries.nextSteps;
  const detailed = conversation.summaries.detailed;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Deliberation Summaries & Export
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('next-steps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'next-steps'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            📋 Next-Steps & Actions
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'detailed'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            🔍 Detailed Deliberation
          </button>
          <button
            onClick={() => setActiveTab('export-json')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'export-json'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {`{ }`} Export JSON
          </button>
          <button
            onClick={() => setActiveTab('export-md')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'export-md'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            ⬇️ Export Markdown
          </button>

          {/* Security badge */}
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/40">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero Secrets in Export (P1.9 Verified)</span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-200 text-sm space-y-6">
          {activeTab === 'next-steps' && (
            <div className="space-y-6">
              {!nextSteps ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No Next-Steps summary generated yet.</p>
                  <p className="text-xs mt-1">Click the &quot;Summarize&quot; button in the main controls to generate one.</p>
                </div>
              ) : (
                <>
                  {/* Decisions */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                      Key Decisions Made
                    </h3>
                    <div className="space-y-2">
                      {nextSteps.decisions.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-slate-200">{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action items */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
                      Assigned Action Items
                    </h3>
                    <div className="space-y-2">
                      {nextSteps.actionItems.map((a, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                          <span className="text-slate-200 font-medium">{a.task}</span>
                          <div className="flex items-center gap-2 text-xs">
                            {a.owner && (
                              <span className="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full font-mono text-[11px]">
                                @{a.owner}
                              </span>
                            )}
                            {a.priority && (
                              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                {a.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Open Questions */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                      Open Questions & Remaining Risks
                    </h3>
                    <div className="space-y-2">
                      {nextSteps.openQuestions.map((q, i) => (
                        <div key={i} className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-amber-200/90 text-xs">
                          ❓ {q}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'detailed' && (
            <div className="space-y-6">
              {!detailed ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No Detailed summary generated yet.</p>
                </div>
              ) : (
                <>
                  {/* Participant Positions */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
                      Participant Stances & Positions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(detailed.positions).map(([agent, pos]) => (
                        <div key={agent} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                          <h4 className="font-semibold text-xs text-purple-300 mb-1">{agent}</h4>
                          <p className="text-xs text-slate-300 leading-relaxed">{pos}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Disagreements */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2">
                      Points of Dissent & Disagreement
                    </h3>
                    <div className="space-y-2">
                      {detailed.disagreements.map((d, i) => (
                        <div key={i} className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg text-xs text-rose-200">
                          ⚠️ {d}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Synthesis */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Deliberation Synthesis & Reasoning
                    </h3>
                    <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300">
                      {detailed.reasoning}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'export-json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Sanitized Event Log & State Snapshot ({jsonExport.length} bytes)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(jsonExport)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy JSON
                  </button>
                  <button
                    onClick={() => handleDownload(jsonExport, `conversation-${conversation.id}.json`, 'application/json')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                </div>
              </div>
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-200 overflow-x-auto max-h-[50vh]">
                {jsonExport}
              </pre>
            </div>
          )}

          {activeTab === 'export-md' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Full Markdown Deliberation Transcript
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(mdExport)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Markdown
                  </button>
                  <button
                    onClick={() => handleDownload(mdExport, `transcript-${conversation.id}.md`, 'text/markdown')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Markdown
                  </button>
                </div>
              </div>
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-[50vh]">
                {mdExport}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
