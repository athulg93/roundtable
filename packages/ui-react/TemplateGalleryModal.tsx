/**
 * Deliberation Template Gallery Modal (Phase 3)
 * Interactive preset library allowing instant instantiation of curated
 * multi-agent topologies (Debate, Red-Team, Pre-Mortem, Delphi).
 */

import React, { useState } from 'react';
import { DeliberationTemplate, TemplateCategory } from '../gallery/types.ts';
import { defaultGalleryStorage } from '../gallery/galleryStorage.ts';
import { Agent, Group } from '../core/types.ts';
import { Bot, Layers, Download, Upload, Check, Shield } from 'lucide-react';

interface TemplateGalleryModalProps {
  onClose: () => void;
  onApplyTemplate: (group: Group, agents: Record<string, Agent>) => void;
}

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  onClose,
  onApplyTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [templates, setTemplates] = useState<DeliberationTemplate[]>(() =>
    defaultGalleryStorage.listAllTemplates()
  );
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DeliberationTemplate>(templates[0]);

  const categories: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All Presets' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'security', label: 'Security & Red-Team' },
    { id: 'reliability', label: 'SRE & Pre-Mortem' },
    { id: 'strategy', label: 'Tech Stack & Strategy' },
  ];

  const filteredTemplates = templates.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory
  );

  const handleApply = (tpl: DeliberationTemplate) => {
    const { group, agents } = defaultGalleryStorage.instantiateTemplate(tpl);
    onApplyTemplate(group, agents);
    onClose();
  };

  const handleExportAll = () => {
    const json = defaultGalleryStorage.exportBundle();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roundtable-templates-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    try {
      const imported = defaultGalleryStorage.importBundle(importText);
      setTemplates(defaultGalleryStorage.listAllTemplates());
      setShowImportModal(false);
      setImportText('');
      alert(`Successfully imported ${imported.length} custom template(s)!`);
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Preset Topologies Library
            </div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 mt-0.5">
              <span>Deliberation Templates & Team Presets</span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                ({templates.length} curated)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAll}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 rounded flex items-center gap-1.5 transition"
              title="Export all templates as JSON bundle"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 rounded flex items-center gap-1.5 transition"
              title="Import templates from JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-900/40 flex items-center gap-2 overflow-x-auto text-xs">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded transition whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-slate-800 text-cyan-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Two-Column Body: Template List + Template Details */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Template Grid / List */}
          <div className="w-1/2 border-r border-slate-800 overflow-y-auto p-4 space-y-2.5">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl)}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition ${
                  selectedTemplate?.id === tpl.id
                    ? 'border-cyan-500/80 bg-cyan-950/20'
                    : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-100">{tpl.title}</h3>
                  <span className="text-[10px] font-mono text-cyan-400 capitalize">
                    {tpl.suggestedProtocol.replace('-', ' ')}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {tpl.description}
                </p>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-3 h-3 text-slate-400" />
                    <span>{tpl.agents.length} agents</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {tpl.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-slate-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Selected Template Inspector */}
          {selectedTemplate && (
            <div className="w-1/2 overflow-y-auto p-6 space-y-5 bg-slate-950/40">
              <div>
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                  {selectedTemplate.category} · {selectedTemplate.suggestedProtocol} protocol
                </div>
                <h3 className="text-base font-bold text-slate-100 mt-1">
                  {selectedTemplate.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {selectedTemplate.description}
                </p>
              </div>

              {/* Goal Statement */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 space-y-1">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Deliberation Goal / Prompt
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedTemplate.goal}
                </p>
              </div>

              {/* Agents Roster */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Configured Roster ({selectedTemplate.agents.length})</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Max {selectedTemplate.maxRounds} rounds
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedTemplate.agents.map((ag, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-slate-800 bg-slate-900/40 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: ag.visualIdentity?.color || '#0284c7' }}
                          />
                          <span className="font-medium text-slate-200">{ag.name}</span>
                          {ag.role === 'moderator' && (
                            <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                              <Shield className="w-3 h-3" /> Moderator
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-500">{ag.model}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        "{ag.rolePrompt?.slice(0, 160)}..."
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleApply(selectedTemplate)}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Instantiate "{selectedTemplate.title}"</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100">Import Template Bundle</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 text-sm">
                ✕
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className="space-y-3">
              <textarea
                rows={6}
                required
                placeholder="Paste template bundle JSON here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full p-2.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200 outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded transition"
                >
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
