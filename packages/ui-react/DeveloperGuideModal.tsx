/**
 * DeveloperGuideModal Component
 * Interactive documentation and code snippets demonstrating how to embed Roundtable
 * as a pluggable library into external React and Node.js projects.
 */

import React, { useState } from 'react';
import { Code, Copy, Check, X, Terminal, Cpu, Database, Layout } from 'lucide-react';

export const DeveloperGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'react' | 'headless' | 'provider' | 'storage'>('react');
  const [copied, setCopied] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const REACT_SNIPPET = `// 1. Install or import Roundtable in your React app
import { GroupChat } from 'roundtable';

export default function MyDeliberationPage() {
  return (
    <div className="w-full h-screen">
      {/* Drop the full Roundtable component anywhere in your app */}
      <GroupChat />
    </div>
  );
}

// 2. OR use the headless React hook for custom UI:
import { useGroupChat, createDeliberationSession, createAgent } from 'roundtable';

const session = createDeliberationSession({
  topic: 'Optimize microservice caching layer',
  agents: [
    createAgent({ name: 'Architect', model: 'gpt-4o', provider: 'openai' }),
    createAgent({ name: 'SRE', model: 'llama3.2', provider: 'ollama' }), // optional role
  ]
});

function CustomChatUI() {
  const { conversation, step, run, stop, interject } = useGroupChat(session);
  return (
    <div>
      <button onClick={() => run()}>Run Auto</button>
      <button onClick={() => step()}>Step Turn</button>
      {/* Render conversation turns */}
    </div>
  );
}`;

  const HEADLESS_SNIPPET = `// Run Roundtable in pure Node.js / CLI backend (zero UI dependencies)
import {
  createDeliberationSession,
  createAgent,
  createConfiguredAdapter,
  defaultProviderRegistry,
} from 'roundtable';

// Configure agents with optional role definitions
const agents = [
  createAgent({
    name: 'Security Lead',
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    rolePrompt: 'Focus on zero-trust boundaries', // Optional!
  }),
  createAgent({
    name: 'Local Specialist',
    model: 'mistral:7b',
    provider: 'ollama', // No rolePrompt needed - defaults automatically
  }),
  createAgent({
    name: 'Moderator',
    model: 'gemini-2.5-flash',
    provider: 'gemini',
    role: 'moderator',
  }),
];

// Initialize deliberation session
const session = createDeliberationSession({
  topic: 'Migrate legacy monolith to distributed event streams',
  agents,
});

// Subscribe to real-time events
session.on('token', ({ turnId, chunk }) => {
  process.stdout.write(chunk);
});

session.on('turn.completed', (event) => {
  console.log(\`\\nTurn completed by: \${event.payload.speakerId}\`);
});

// Run deliberation automatically
await session.run({ maxRounds: 3 });

// Extract decisions and action items
const summary = await session.summarize();
console.log('Decisions:', summary.nextSteps.decisions);
console.log('Action items:', summary.nextSteps.actionItems);`;

  const CUSTOM_PROVIDER_SNIPPET = `// Create and register a custom LLM provider adapter
import { ProviderAdapter, defaultProviderRegistry } from 'roundtable';

class CustomLLMAdapter implements ProviderAdapter {
  readonly id = 'my-custom-llm';
  readonly name = 'My Internal GPU Cluster';
  readonly capabilities = {
    streaming: true,
    supportsSystemPrompt: true,
    defaultContextWindow: 32768,
  };

  async *generate(request, signal) {
    const response = await fetch('https://my-internal-api.company.com/generate', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    });
    // Yield tokens
    yield { text: 'Analytical recommendation from internal model...' };
    yield {
      text: '',
      isFinal: true,
      usage: { inputTokens: 150, outputTokens: 60, latencyMs: 250, provider: this.name, model: request.model },
    };
  }

  async listModels() {
    return [{ id: 'internal-v1', name: 'Internal 70B', contextWindow: 32768, supportsStreaming: true }];
  }

  async healthCheck() {
    return true;
  }
}

// Register globally or pass to session
defaultProviderRegistry.register(new CustomLLMAdapter());`;

  const STORAGE_SNIPPET = `// Plug in custom persistence (PostgreSQL, SQLite, Redis, DynamoDB)
import { StorageAdapter, createGroupChat } from 'roundtable';

class PostgresStorageAdapter implements StorageAdapter {
  async appendEvent(event) {
    await db.query('INSERT INTO deliberation_events (id, conv_id, payload) VALUES ($1, $2, $3)',
      [event.eventId, event.conversationId, JSON.stringify(event)]);
  }

  async loadEvents(conversationId) {
    const res = await db.query('SELECT payload FROM deliberation_events WHERE conv_id = $1 ORDER BY seq ASC', [conversationId]);
    return res.rows.map(r => JSON.parse(r.payload));
  }

  async saveConversation(conv) { /* update database */ }
  async loadConversation(id) { /* retrieve from database */ }
  async listConversations() { /* list */ }
  async saveGroup(g) { /* save */ }
  async getGroup(id) { /* get */ }
  async listGroups() { /* list */ }
  async saveAgent(a) { /* save */ }
  async getAgent(id) { /* get */ }
  async listAgents() { /* list */ }
}

// Pass to session
const session = createGroupChat({
  group,
  agents,
  storage: new PostgresStorageAdapter(),
});`;

  const snippets = {
    react: REACT_SNIPPET,
    headless: HEADLESS_SNIPPET,
    provider: CUSTOM_PROVIDER_SNIPPET,
    storage: STORAGE_SNIPPET,
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Roundtable Pluggable Integration Guide
              </h2>
              <p className="text-xs text-slate-400">
                Export and embed Roundtable as a library in any React app, Node.js backend, or microservice.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('react')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'react' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            React Embed
          </button>

          <button
            onClick={() => setActiveTab('headless')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'headless' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Headless Node.js
          </button>

          <button
            onClick={() => setActiveTab('provider')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'provider' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Custom Provider Adapter
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'storage' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Custom Storage Adapter
          </button>

          <div className="ml-auto">
            <button
              onClick={() => copyCode(snippets[activeTab])}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Snippet'}
            </button>
          </div>
        </div>

        {/* Snippet Code Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs text-slate-200">
          <pre className="p-4 bg-slate-900/90 rounded-xl border border-slate-800/80 overflow-x-auto leading-relaxed text-cyan-200/90">
            {snippets[activeTab]}
          </pre>
        </div>
      </div>
    </div>
  );
};
