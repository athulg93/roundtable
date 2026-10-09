/**
 * Tools & Model Context Protocol (MCP) Workspace View (Phase 3)
 * Displays available grounded tools, MCP resource definitions,
 * and allows direct interactive test execution.
 */

import React, { useState } from 'react';
import { defaultToolRegistry } from '../tools/registry.ts';
import { defaultVSCodeHost } from '../embed/vscodeHost.ts';
import { Wrench, Play, CheckCircle2, AlertCircle, Terminal, FileCode } from 'lucide-react';

interface ToolsViewProps {
  onRunTool?: (toolName: string, args: Record<string, any>) => Promise<any>;
}

export const ToolsView: React.FC<ToolsViewProps> = ({ onRunTool }) => {
  const tools = defaultToolRegistry.list();
  const [selectedToolName, setSelectedToolName] = useState<string>(tools[0]?.name || '');
  const [argsJson, setArgsJson] = useState<string>('{\n  "expression": "(1000 * 0.00015) + (200 * 0.0006)"\n}');
  const [output, setOutput] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);

  const selectedTool = defaultToolRegistry.get(selectedToolName);

  const handleToolSelect = (toolName: string) => {
    setSelectedToolName(toolName);
    const tool = defaultToolRegistry.get(toolName);
    if (!tool) return;

    // Create template args
    const initialArgs: Record<string, any> = {};
    for (const [k, v] of Object.entries(tool.parameters)) {
      if (k === 'expression') initialArgs[k] = '(50000 / 1000) * 0.015';
      else if (k === 'topic') initialArgs[k] = 'raft';
      else if (k === 'filePath') initialArgs[k] = 'packages/core/orchestrator.ts';
      else if (k === 'code') initialArgs[k] = '{"service": "auth", "port": 8080}';
      else initialArgs[k] = v.type === 'number' ? 0 : v.type === 'boolean' ? true : 'example';
    }
    setArgsJson(JSON.stringify(initialArgs, null, 2));
    setOutput(null);
  };

  const handleExecute = async () => {
    if (!selectedTool) return;
    setRunning(true);
    try {
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = JSON.parse(argsJson);
      } catch (err: any) {
        setOutput(`Invalid JSON arguments: ${err.message}`);
        setIsError(true);
        setRunning(false);
        return;
      }

      if (onRunTool) {
        const res = await onRunTool(selectedTool.name, parsedArgs);
        setOutput(res.output || JSON.stringify(res, null, 2));
        setIsError(res.isError || false);
      } else {
        const res = await defaultToolRegistry.execute(selectedTool.name, parsedArgs, {
          agentId: 'user',
          agentName: 'User Tester',
          conversationId: 'direct-test',
        });
        setOutput(res.output);
        setIsError(res.isError);
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
      setIsError(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-900/60">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace Grounding & MCP
          </div>
          <div className="text-sm font-medium text-slate-100 flex items-center gap-2 mt-0.5">
            <span>Tools & Execution Engine</span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              ({tools.length} available)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {defaultVSCodeHost.isEmbedded && (
            <span className="px-2 py-0.5 bg-blue-950/60 border border-blue-800 text-blue-300 font-mono text-[10px] rounded">
              IDE Host Connected
            </span>
          )}
          <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-mono text-[10px] rounded">
            MCP Protocol v1
          </span>
        </div>
      </div>

      <div className="p-3 bg-slate-900/40 border-b border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
        Agents autonomously invoke these tools during deliberation using{' '}
        <code className="text-cyan-300">[ToolCall: toolName &#123;...&#125;]</code>. Tool executions are recorded as durable events in the append-only stream.
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: Tools List */}
        <div className="w-2/5 border-r border-slate-800/80 overflow-y-auto p-3 space-y-2">
          {tools.map((t) => (
            <button
              key={t.name}
              onClick={() => handleToolSelect(t.name)}
              className={`w-full p-2.5 rounded text-left border transition ${
                selectedToolName === t.name
                  ? 'border-cyan-500/80 bg-cyan-950/20 text-slate-100'
                  : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono font-medium">
                <span className="truncate">{t.name}</span>
                <Wrench className="w-3 h-3 text-cyan-400 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-1">{t.description}</p>
            </button>
          ))}
        </div>

        {/* Right: Selected Tool Tester & Params */}
        {selectedTool && (
          <div className="w-3/5 overflow-y-auto p-4 space-y-4 flex flex-col">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-semibold text-cyan-300">
                  {selectedTool.name}
                </h4>
                <button
                  onClick={handleExecute}
                  disabled={running}
                  className="px-2.5 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded font-medium transition flex items-center gap-1 shadow-sm"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{running ? 'Executing...' : 'Run Tool'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {selectedTool.description}
              </p>
            </div>

            {/* Parameters Schema */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Parameters Schema
              </span>
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 text-[11px] space-y-1">
                {Object.entries(selectedTool.parameters).map(([param, conf]) => (
                  <div key={param} className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-cyan-400">{param}</span>
                      <span className="text-slate-500 ml-1.5 font-mono">({conf.type})</span>
                      {conf.required && <span className="text-red-400 ml-1">*required</span>}
                    </div>
                    <span className="text-slate-400 text-[10px] max-w-xs text-right truncate">
                      {conf.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Args JSON Editor */}
            <div className="space-y-1.5 flex-1 flex flex-col">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Arguments Payload (JSON)
              </span>
              <textarea
                rows={4}
                value={argsJson}
                onChange={(e) => setArgsJson(e.target.value)}
                className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>

            {/* Execution Result */}
            {output !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase">
                  {isError ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Execution Failed
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Output Result
                    </span>
                  )}
                </div>
                <div
                  className={`p-3 rounded border font-mono text-xs leading-relaxed overflow-x-auto ${
                    isError
                      ? 'bg-red-950/20 border-red-900 text-red-300'
                      : 'bg-slate-900 border-slate-800 text-emerald-300'
                  }`}
                >
                  <pre className="whitespace-pre-wrap">{output}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
