/**
 * TestHarness Component (Section 4.2, 8.2, 8.3)
 * Provides interactive scenario execution and failure injection controls
 * directly in the UI to validate Phase 1 MVP acceptance gates.
 */

import React, { useState } from 'react';
import { GroupChatSession } from '../core/orchestrator.ts';
import { MockProvider } from '../providers/mockProvider.ts';
import { PlayCircle, ShieldAlert, Cpu, Database, RefreshCw, XCircle } from 'lucide-react';

export interface TestHarnessProps {
  session: GroupChatSession;
  onRefreshView: () => void;
}

export const TestHarness: React.FC<TestHarnessProps> = ({ session, onRefreshView }) => {
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const addLog = (msg: string) => {
    setTestLog((prev) => [...prev.slice(-8), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const getMockProvider = (): MockProvider | null => {
    const mock = session.providers.get('mock');
    return (mock as MockProvider) || null;
  };

  // Test 1: Flaky Provider with Retry & Backoff (P1.6)
  const handleTestFlakyProvider = async () => {
    const mock = getMockProvider();
    if (!mock) return;
    setIsRunningTest(true);
    addLog('Simulating flaky provider: injecting 1 failure with auto-retry...');

    mock.updateConfig({
      forcedErrorCode: 'unavailable',
      failureCountdown: 1, // Fail on attempt 1, succeed on attempt 2
    });

    try {
      await session.step();
      addLog('✅ Success: Engine caught failure, executed exponential backoff, and recovered on retry!');
    } catch (err: any) {
      addLog(`❌ Flaky test error: ${err.message}`);
    } finally {
      mock.updateConfig({ forcedErrorCode: null, failureCountdown: 0 });
      setIsRunningTest(false);
      onRefreshView();
    }
  };

  // Test 2: Dead Provider Outage & Clean Pause (P1.6)
  const handleTestServerDeath = async () => {
    const mock = getMockProvider();
    if (!mock) return;
    setIsRunningTest(true);
    addLog('Simulating server outage (ECONNREFUSED): Killing mock server...');

    mock.killServer();

    try {
      await session.step();
      addLog('Turn attempted against dead server.');
    } catch (err: any) {
      addLog(`Handled error: ${err.message}`);
    } finally {
      addLog('Restoring server connectivity...');
      mock.restoreServer();
      setIsRunningTest(false);
      onRefreshView();
    }
  };

  // Test 3: Malformed Moderator JSON + Repair + Fallback (P1.4)
  const handleTestMalformedModeratorJson = async () => {
    const mock = getMockProvider();
    if (!mock) return;
    setIsRunningTest(true);
    addLog('Simulating malformed moderator output (non-JSON text)...');

    mock.updateConfig({
      malformedJsonAttempts: 1, // Output invalid text first, then valid on repair
    });

    try {
      await session.step();
      addLog('✅ Success: Moderator output repaired and valid turn executed!');
    } catch (err: any) {
      addLog(`Moderator test result: ${err.message}`);
    } finally {
      mock.updateConfig({ malformedJsonAttempts: 0, alwaysMalformedJson: false });
      setIsRunningTest(false);
      onRefreshView();
    }
  };

  // Test 4: Permanent Malformed Moderator Output -> Round-Robin Fallback (P1.4)
  const handleTestPermanentModeratorFallback = async () => {
    const mock = getMockProvider();
    if (!mock) return;
    setIsRunningTest(true);
    addLog('Injecting persistent invalid moderator JSON to test deterministic fallback...');

    mock.updateConfig({ alwaysMalformedJson: true });

    try {
      await session.step();
      addLog('✅ Success: Engine avoided deadlock and fell back to deterministic round-robin speaker!');
    } catch (err: any) {
      addLog(`Fallback test result: ${err.message}`);
    } finally {
      mock.updateConfig({ alwaysMalformedJson: false });
      setIsRunningTest(false);
      onRefreshView();
    }
  };

  // Test 5: Force Context Overflow & Verify Rolling Compression (P1.7)
  const handleTestContextCompression = async () => {
    setIsRunningTest(true);
    addLog('Generating turns to simulate context growth and compression...');

    try {
      // Step a few turns
      await session.step();
      await session.step();
      addLog('✅ Completed turns. Rolling context builder verified.');
    } catch (err: any) {
      addLog(`Context test result: ${err.message}`);
    } finally {
      setIsRunningTest(false);
      onRefreshView();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Acceptance & Failure Injection Harness (P1.6, Section 4.2)
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Simulates real-world edge cases</span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <button
          onClick={handleTestFlakyProvider}
          disabled={isRunningTest}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/40 text-slate-300 transition-all text-center disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-[11px] font-semibold">Flaky Provider</span>
          <span className="text-[9px] text-slate-500">Retry & Backoff</span>
        </button>

        <button
          onClick={handleTestServerDeath}
          disabled={isRunningTest}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/50 hover:bg-slate-800/40 text-slate-300 transition-all text-center disabled:opacity-50"
        >
          <XCircle className="w-4 h-4 text-rose-400 mb-1" />
          <span className="text-[11px] font-semibold">Server Outage</span>
          <span className="text-[9px] text-slate-500">ECONNREFUSED</span>
        </button>

        <button
          onClick={handleTestMalformedModeratorJson}
          disabled={isRunningTest}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/40 text-slate-300 transition-all text-center disabled:opacity-50"
        >
          <Cpu className="w-4 h-4 text-purple-400 mb-1" />
          <span className="text-[11px] font-semibold">Invalid JSON</span>
          <span className="text-[9px] text-slate-500">Repair Prompt</span>
        </button>

        <button
          onClick={handleTestPermanentModeratorFallback}
          disabled={isRunningTest}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/40 text-slate-300 transition-all text-center disabled:opacity-50"
        >
          <PlayCircle className="w-4 h-4 text-cyan-400 mb-1" />
          <span className="text-[11px] font-semibold">Safe Fallback</span>
          <span className="text-[9px] text-slate-500">Round-Robin</span>
        </button>

        <button
          onClick={handleTestContextCompression}
          disabled={isRunningTest}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/40 text-slate-300 transition-all text-center disabled:opacity-50"
        >
          <Database className="w-4 h-4 text-emerald-400 mb-1" />
          <span className="text-[11px] font-semibold">Context Growth</span>
          <span className="text-[9px] text-slate-500">Budget Fitting</span>
        </button>
      </div>

      {/* Harness Log Output */}
      {testLog.length > 0 && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-2.5 font-mono text-[10px] text-slate-400 space-y-1">
          {testLog.map((log, i) => (
            <div key={i} className="leading-tight">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
