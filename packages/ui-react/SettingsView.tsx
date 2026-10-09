/**
 * SettingsView Component
 * Dedicated settings view holding all secondary configurations:
 * - Provider API credentials (held safely in session memory)
 * - Template Gallery trigger
 * - Tool registry & MCP configuration
 * - Developer Integration & Embed status
 * - Data management (seed demo data, clear local storage)
 */

import React, { useState } from 'react';
import { SupportedProviderType, PROVIDER_PRESETS } from '../providers/presets.ts';
import { sessionCredentials } from './sessionCredentials.ts';
import { defaultToolRegistry } from '../tools/registry.ts';
import { ToolDefinition } from '../tools/types.ts';
import {
  Settings,
  Key,
  Shield,
  Sparkles,
  Wrench,
  Code,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export interface SettingsViewProps {
  onOpenGallery: () => void;
  onOpenDevGuide: () => void;
  onResetAllData: () => void;
  onSeedDemoData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenGallery,
  onOpenDevGuide,
  onResetAllData,
  onSeedDemoData,
}) => {
  // Provider API keys state
  const geminiDefault = sessionCredentials.getProviderDefault('gemini');
  const anthropicDefault = sessionCredentials.getProviderDefault('anthropic');
  const openaiDefault = sessionCredentials.getProviderDefault('openai');
  const ollamaDefault = sessionCredentials.getProviderDefault('ollama');

  const [geminiKey, setGeminiKey] = useState(geminiDefault.apiKey || '');
  const [anthropicKey, setAnthropicKey] = useState(anthropicDefault.apiKey || '');
  const [openaiKey, setOpenaiKey] = useState(openaiDefault.apiKey || '');
  const [ollamaUrl, setOllamaUrl] = useState(ollamaDefault.baseUrl || 'http://localhost:11434/v1');

  const [showKeys, setShowKeys] = useState({
    gemini: false,
    anthropic: false,
    openai: false,
  });

  const [savedBanner, setSavedBanner] = useState(false);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    sessionCredentials.setProviderDefault('gemini', { apiKey: geminiKey.trim() });
    sessionCredentials.setProviderDefault('anthropic', { apiKey: anthropicKey.trim() });
    sessionCredentials.setProviderDefault('openai', { apiKey: openaiKey.trim() });
    sessionCredentials.setProviderDefault('ollama', { baseUrl: ollamaUrl.trim() });
    sessionCredentials.setProviderDefault('lmstudio', { baseUrl: ollamaUrl.trim() });

    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const registeredTools: ToolDefinition[] = defaultToolRegistry.list();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono">
              System Settings
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Application Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage provider credentials, tool execution, template presets, and developer tools.
          </p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">
        {/* Success Banner */}
        {savedBanner && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Credentials updated in active session memory.</span>
          </div>
        )}

        {/* 1. Global Provider Credentials */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-950/50 border border-cyan-800/50 text-cyan-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Default Provider Credentials</h3>
                <p className="text-xs text-slate-400">
                  Global keys inherited by new agents. Kept strictly in memory for this session.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-lg">
              <Shield className="w-3.5 h-3.5" />
              <span>Zero-Storage Guarantee</span>
            </div>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4 pt-2">
            {/* Google Gemini */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Google Gemini API Key</label>
                <span className="text-[10px] text-slate-500">Uses workspace environment by default</span>
              </div>
              <div className="relative">
                <input
                  type={showKeys.gemini ? 'text' : 'password'}
                  placeholder="AIzaSy... (optional if workspace env key is present)"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys({ ...showKeys, gemini: !showKeys.gemini })}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Anthropic Claude */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Anthropic Claude API Key
              </label>
              <div className="relative">
                <input
                  type={showKeys.anthropic ? 'text' : 'password'}
                  placeholder="sk-ant-api03-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys({ ...showKeys, anthropic: !showKeys.anthropic })}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showKeys.anthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* OpenAI API */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">OpenAI API Key</label>
                <span className="text-[10px] text-slate-500">OpenAI Platform API</span>
              </div>
              <div className="relative">
                <input
                  type={showKeys.openai ? 'text' : 'password'}
                  placeholder="sk-proj-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showKeys.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>Requires OpenAI Platform API credentials. ChatGPT Plus subscriptions do not provide API access.</span>
              </p>
            </div>

            {/* Ollama / Local Server URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Local LLM Base URL (Ollama / LM Studio)
              </label>
              <input
                type="text"
                placeholder="http://localhost:11434/v1"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
              >
                Save Session Keys
              </button>
            </div>
          </form>
        </div>

        {/* 2. Quick Actions & Templates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Deliberation Gallery</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Explore curated group packs: Distributed Architecture, Security Red Team, and Debate Protocols.
              </p>
            </div>
            <button
              onClick={onOpenGallery}
              className="w-full py-2 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs font-semibold transition"
            >
              Browse Template Gallery
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-cyan-400">
                <Code className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Developer Integration</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Learn how to embed the Roundtable core into external web applications, node services, and VS Code extensions.
              </p>
            </div>
            <button
              onClick={onOpenDevGuide}
              className="w-full py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition"
            >
              View API & Embed Guide
            </button>
          </div>
        </div>

        {/* 3. Tools Registry Status */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400">
              <Wrench className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white">Registered Tools ({registeredTools.length})</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">MVP Safe Execution Mode</span>
          </div>
          <p className="text-xs text-slate-400">
            Agents have access to tool declarations without executing unauthorized destructive actions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {registeredTools.map((tool) => (
              <div
                key={tool.name}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex flex-col"
              >
                <div className="flex items-center justify-between font-mono font-semibold text-slate-200">
                  <span>{tool.name}</span>
                  <span className="text-[10px] text-emerald-400 font-sans">Active</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{tool.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Data Management */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-slate-300">
            <RotateCcw className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white">Data Management</h3>
          </div>
          <p className="text-xs text-slate-400">
            Seed sample groups & agents or reset the local workspace back to fresh factory state.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                if (confirm('Seed recommended demo groups and specialist agents?')) {
                  onSeedDemoData();
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Seed Demo Data
            </button>
            <button
              onClick={() => {
                if (confirm('Clear all stored groups, agents, and conversation history? This cannot be undone.')) {
                  onResetAllData();
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold transition"
            >
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
