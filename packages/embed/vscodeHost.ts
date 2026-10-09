/**
 * VS Code Webview & IDE Embed Host Adapter (Phase 3)
 * Handles bidirectional postMessage communication with VS Code or parent iframe host.
 */

import { HostToRoundtableMessage, RoundtableToHostMessage } from './types.ts';
import { GroupChatSession } from '../core/orchestrator.ts';

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (msg: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
  }
}

export class VSCodeHostAdapter {
  private vscodeApi?: { postMessage: (msg: any) => void };
  private session?: GroupChatSession;
  private messageListener?: (event: MessageEvent) => void;
  private unsubStateChange?: () => void;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
      try {
        this.vscodeApi = window.acquireVsCodeApi();
      } catch {
        // May already be acquired in parent context
      }
    }
  }

  get isEmbedded(): boolean {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return Boolean(this.vscodeApi || urlParams.get('embed') === 'true' || window.parent !== window);
  }

  attachSession(session: GroupChatSession): () => void {
    this.session = session;

    // Send state updates to host
    this.unsubStateChange = session.on('stateChange', (conv) => {
      this.sendToHost({
        type: 'ROUNDTABLE_STATE_SYNC',
        payload: {
          state: conv.state,
          roundCount: conv.roundCount,
          totalTurns: conv.totalTurns,
          conversationId: conv.id,
        },
      });
    });

    // Listen for incoming messages from host
    this.messageListener = (event: MessageEvent) => {
      const msg = event.data as HostToRoundtableMessage;
      if (!msg || !msg.type || !msg.type.startsWith('ROUNDTABLE_')) return;

      this.handleHostMessage(msg);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.messageListener);
      this.sendToHost({ type: 'ROUNDTABLE_READY' });
    }

    return () => this.detach();
  }

  detach(): void {
    if (this.unsubStateChange) {
      this.unsubStateChange();
      this.unsubStateChange = undefined;
    }
    if (this.messageListener && typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = undefined;
    }
    this.session = undefined;
  }

  sendToHost(message: RoundtableToHostMessage): void {
    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
    } else if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  }

  insertCodeToActiveEditor(code: string, language?: string): void {
    this.sendToHost({
      type: 'ROUNDTABLE_INSERT_CODE',
      payload: { code, language },
    });
  }

  exportSummaryToWorkspace(filename: string, content: string): void {
    this.sendToHost({
      type: 'ROUNDTABLE_EXPORT_SUMMARY',
      payload: { filename, content },
    });
  }

  private handleHostMessage(msg: HostToRoundtableMessage): void {
    if (!this.session) return;

    switch (msg.type) {
      case 'ROUNDTABLE_INTERJECT':
        if (msg.payload?.text) {
          this.session.interject(msg.payload.text, msg.payload.senderName || 'Host Editor');
        }
        break;

      case 'ROUNDTABLE_STEP':
        this.session.step(msg.payload?.agentId);
        break;

      case 'ROUNDTABLE_RUN':
        this.session.run({ maxRounds: msg.payload?.maxRounds });
        break;

      case 'ROUNDTABLE_PAUSE':
        this.session.pause();
        break;

      case 'ROUNDTABLE_RESUME':
        this.session.resume();
        break;

      case 'ROUNDTABLE_INIT':
        if (msg.payload?.activeSelection) {
          this.session.interject(
            `[Grounded Code Context from ${msg.payload.activeFile || 'editor'}]:\n\`\`\`\n${msg.payload.activeSelection}\n\`\`\``,
            'Host Editor'
          );
        }
        break;
    }
  }
}

export const defaultVSCodeHost = new VSCodeHostAdapter();
