/**
 * VS Code Webview & IDE Embed Host Adapter (Phase 2 & Phase 3 Dependability)
 * Secure bidirectional communication with strict origin validation,
 * sanitized payload schema guards, nonces, and bounded responses.
 */

import {
  HostToRoundtableMessage,
  RoundtableToHostMessage,
  EmbedTransport,
  MessageValidationResult,
} from './types.ts';
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

export interface VSCodeHostOptions {
  allowedOrigins?: string[];
  targetOrigin?: string;
  allowWildcardOrigin?: boolean;
  authToken?: string;
  transport?: EmbedTransport;
}

export function validateIncomingHostMessage(raw: unknown): MessageValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Message must be a non-null object' };
  }

  const msg = raw as Record<string, any>;
  if (typeof msg.type !== 'string' || !msg.type.startsWith('ROUNDTABLE_')) {
    return { valid: false, error: 'Message type must be a valid ROUNDTABLE_* command' };
  }

  const messageId = typeof msg.messageId === 'string' ? msg.messageId.slice(0, 100) : undefined;
  const authToken = typeof msg.authToken === 'string' ? msg.authToken : undefined;
  const timestamp = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now();

  switch (msg.type) {
    case 'ROUNDTABLE_INTERJECT': {
      if (!msg.payload || typeof msg.payload.text !== 'string' || msg.payload.text.trim().length === 0) {
        return { valid: false, error: 'ROUNDTABLE_INTERJECT requires non-empty string payload.text' };
      }
      const text = msg.payload.text.slice(0, 50000);
      const senderName = typeof msg.payload.senderName === 'string' ? msg.payload.senderName.slice(0, 100) : 'Host Editor';
      return {
        valid: true,
        sanitized: { type: 'ROUNDTABLE_INTERJECT', payload: { text, senderName }, messageId, authToken, timestamp },
      };
    }

    case 'ROUNDTABLE_STEP': {
      const agentId = typeof msg.payload?.agentId === 'string' ? msg.payload.agentId.slice(0, 100) : undefined;
      return {
        valid: true,
        sanitized: { type: 'ROUNDTABLE_STEP', payload: agentId ? { agentId } : undefined, messageId, authToken, timestamp },
      };
    }

    case 'ROUNDTABLE_RUN': {
      let maxRounds: number | undefined;
      if (typeof msg.payload?.maxRounds === 'number' && !isNaN(msg.payload.maxRounds)) {
        maxRounds = Math.max(1, Math.min(100, Math.floor(msg.payload.maxRounds)));
      }
      return {
        valid: true,
        sanitized: { type: 'ROUNDTABLE_RUN', payload: maxRounds !== undefined ? { maxRounds } : undefined, messageId, authToken, timestamp },
      };
    }

    case 'ROUNDTABLE_PAUSE':
      return { valid: true, sanitized: { type: 'ROUNDTABLE_PAUSE', messageId, authToken, timestamp } };

    case 'ROUNDTABLE_RESUME':
      return { valid: true, sanitized: { type: 'ROUNDTABLE_RESUME', messageId, authToken, timestamp } };

    case 'ROUNDTABLE_STOP': {
      const reason = typeof msg.payload?.reason === 'string' ? msg.payload.reason.slice(0, 500) : 'Stopped by embed host';
      return {
        valid: true,
        sanitized: { type: 'ROUNDTABLE_STOP', payload: { reason }, messageId, authToken, timestamp },
      };
    }

    case 'ROUNDTABLE_PING':
      return {
        valid: true,
        sanitized: { type: 'ROUNDTABLE_PING', payload: { timestamp: msg.payload?.timestamp || Date.now() }, messageId, authToken, timestamp },
      };

    case 'ROUNDTABLE_INIT': {
      const payload = {
        workspacePath: typeof msg.payload?.workspacePath === 'string' ? msg.payload.workspacePath.slice(0, 1000) : undefined,
        activeFile: typeof msg.payload?.activeFile === 'string' ? msg.payload.activeFile.slice(0, 1000) : undefined,
        activeSelection: typeof msg.payload?.activeSelection === 'string' ? msg.payload.activeSelection.slice(0, 50000) : undefined,
        gitBranch: typeof msg.payload?.gitBranch === 'string' ? msg.payload.gitBranch.slice(0, 200) : undefined,
      };
      return {
        valid: true,
        sanitized: { type: 'ROUNDTABLE_INIT', payload, messageId, authToken, timestamp },
      };
    }

    case 'ROUNDTABLE_APPLY_TEMPLATE': {
      if (!msg.payload || typeof msg.payload.templateId !== 'string') {
        return { valid: false, error: 'ROUNDTABLE_APPLY_TEMPLATE requires string payload.templateId' };
      }
      return {
        valid: true,
        sanitized: {
          type: 'ROUNDTABLE_APPLY_TEMPLATE',
          payload: { templateId: msg.payload.templateId.slice(0, 100) },
          messageId,
          authToken,
          timestamp,
        },
      };
    }

    default:
      return { valid: false, error: `Unrecognized ROUNDTABLE command: ${msg.type}` };
  }
}

export class VSCodeHostAdapter {
  private vscodeApi?: { postMessage: (msg: any) => void };
  private session?: GroupChatSession;
  private messageListener?: (event: MessageEvent) => void;
  private unsubStateChange?: () => void;
  private unsubTransport?: () => void;
  private allowedOrigins?: string[];
  private targetOrigin: string;
  private allowWildcardOrigin: boolean;
  private authToken?: string;
  private transport?: EmbedTransport;

  constructor(options: VSCodeHostOptions = {}) {
    this.allowedOrigins = options.allowedOrigins ? [...options.allowedOrigins] : undefined;
    this.allowWildcardOrigin = options.allowWildcardOrigin ?? false;
    this.authToken = options.authToken;
    this.transport = options.transport;

    // Secure target origin calculation
    if (options.targetOrigin) {
      this.targetOrigin = options.targetOrigin;
    } else if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      this.targetOrigin = window.location.origin;
    } else {
      this.targetOrigin = this.allowWildcardOrigin ? '*' : '';
    }

    if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
      try {
        this.vscodeApi = window.acquireVsCodeApi();
      } catch {
        // Already acquired in parent context
      }
    }
  }

  setAllowedOrigins(origins: string[]): void {
    this.allowedOrigins = [...origins];
  }

  setTargetOrigin(origin: string): void {
    this.targetOrigin = origin;
  }

  setAuthToken(token?: string): void {
    this.authToken = token;
  }

  get isEmbedded(): boolean {
    if (typeof window === 'undefined') return Boolean(this.transport);
    const urlParams = new URLSearchParams(window.location.search);
    return Boolean(
      this.transport ||
      this.vscodeApi ||
      urlParams.get('embed') === 'true' ||
      window.parent !== window
    );
  }

  attachSession(session: GroupChatSession, options: VSCodeHostOptions = {}): () => void {
    this.session = session;
    if (options.allowedOrigins) {
      this.allowedOrigins = [...options.allowedOrigins];
    }
    if (options.targetOrigin) {
      this.targetOrigin = options.targetOrigin;
    }
    if (options.authToken) {
      this.authToken = options.authToken;
    }
    if (options.transport) {
      this.transport = options.transport;
    }

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

    // Custom transport message bridge
    if (this.transport) {
      this.unsubTransport = this.transport.onMessage((msg, origin) => {
        this.processIncomingMessage(msg, origin);
      });
    }

    // Listen for incoming messages from postMessage host with strict origin & schema validation
    this.messageListener = (event: MessageEvent) => {
      this.processIncomingMessage(event.data, event.origin);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.messageListener);
      this.sendToHost({
        type: 'ROUNDTABLE_READY',
        payload: {
          version: '1.1.0',
          capabilities: ['streaming', 'interjection', 'moderation', 'summary-export', 'ack-protocol'],
        },
      });
    }

    return () => this.detach();
  }

  detach(): void {
    if (this.unsubStateChange) {
      this.unsubStateChange();
      this.unsubStateChange = undefined;
    }
    if (this.unsubTransport) {
      this.unsubTransport();
      this.unsubTransport = undefined;
    }
    if (this.messageListener && typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = undefined;
    }
    this.session = undefined;
  }

  sendToHost(message: RoundtableToHostMessage): void {
    if (this.transport) {
      this.transport.postMessage(message);
      return;
    }

    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
      return;
    }

    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      const destinationOrigin = this.targetOrigin || (this.allowWildcardOrigin ? '*' : window.location.origin);
      if (destinationOrigin) {
        window.parent.postMessage(message, destinationOrigin);
      } else {
        console.warn('[VSCodeHostAdapter] Cannot postMessage: targetOrigin is not configured.');
      }
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

  private processIncomingMessage(raw: unknown, origin?: string): void {
    // 1. Strict Origin Validation Boundary
    if (this.allowedOrigins && this.allowedOrigins.length > 0) {
      if (!origin || !this.allowedOrigins.includes(origin)) {
        console.warn(`[VSCodeHostAdapter] Rejected postMessage from untrusted origin: ${origin}`);
        this.sendToHost({
          type: 'ROUNDTABLE_ERROR',
          payload: { error: 'Untrusted origin', code: 'UNTRUSTED_ORIGIN' },
        });
        return;
      }
    }

    // 2. Strict Payload Schema Validation Boundary
    const validation = validateIncomingHostMessage(raw);
    if (!validation.valid || !validation.sanitized) {
      console.warn(`[VSCodeHostAdapter] Invalid message payload: ${validation.error}`);
      this.sendToHost({
        type: 'ROUNDTABLE_ERROR',
        payload: {
          messageId: (raw as any)?.messageId,
          command: (raw as any)?.type,
          error: validation.error || 'Invalid message payload',
          code: 'INVALID_PAYLOAD',
        },
      });
      return;
    }

    const msg = validation.sanitized;

    // 3. Auth Token / Nonce Boundary
    if (this.authToken && msg.authToken !== this.authToken) {
      console.warn('[VSCodeHostAdapter] Rejected message: invalid or missing authToken');
      this.sendToHost({
        type: 'ROUNDTABLE_ERROR',
        payload: {
          messageId: msg.messageId,
          command: msg.type,
          error: 'Unauthorized control message',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    // 4. Dispatch Command
    this.handleHostMessage(msg);
  }

  private handleHostMessage(msg: HostToRoundtableMessage): void {
    if (!this.session) return;

    try {
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

        case 'ROUNDTABLE_STOP':
          this.session.stop(msg.payload?.reason || 'Stopped by embed host');
          break;

        case 'ROUNDTABLE_PING':
          this.sendToHost({
            type: 'ROUNDTABLE_PONG',
            payload: { messageId: msg.messageId, timestamp: Date.now() },
          });
          return;

        case 'ROUNDTABLE_INIT':
          if (msg.payload?.activeSelection) {
            this.session.interject(
              `[Grounded Code Context from ${msg.payload.activeFile || 'editor'}]:\n\`\`\`\n${msg.payload.activeSelection}\n\`\`\``,
              'Host Editor'
            );
          }
          break;

        case 'ROUNDTABLE_APPLY_TEMPLATE':
          // Reserved for template apply handlers
          break;
      }

      // Send ACK if messageId was provided
      if (msg.messageId) {
        this.sendToHost({
          type: 'ROUNDTABLE_ACK',
          payload: { messageId: msg.messageId, command: msg.type, success: true },
        });
      }
    } catch (err: any) {
      this.sendToHost({
        type: 'ROUNDTABLE_ERROR',
        payload: {
          messageId: msg.messageId,
          command: msg.type,
          error: err?.message || 'Execution error',
          code: 'COMMAND_FAILED',
        },
      });
    }
  }
}

export const defaultVSCodeHost = new VSCodeHostAdapter();
