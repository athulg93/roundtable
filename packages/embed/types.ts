/**
 * VS Code Webview & IDE Embed Host Protocol Types (Phase 2 & Phase 3 Dependability)
 * Strongly typed bidirectional message contract for webview, iframe, and worker embeds.
 */

export interface MessageEnvelope {
  messageId?: string;
  authToken?: string;
  timestamp?: number;
}

export type HostToRoundtableMessage = (
  | { type: 'ROUNDTABLE_INIT'; payload: { workspacePath?: string; activeFile?: string; activeSelection?: string; gitBranch?: string } }
  | { type: 'ROUNDTABLE_INTERJECT'; payload: { text: string; senderName?: string } }
  | { type: 'ROUNDTABLE_STEP'; payload?: { agentId?: string } }
  | { type: 'ROUNDTABLE_RUN'; payload?: { maxRounds?: number } }
  | { type: 'ROUNDTABLE_PAUSE' }
  | { type: 'ROUNDTABLE_RESUME' }
  | { type: 'ROUNDTABLE_STOP'; payload?: { reason?: string } }
  | { type: 'ROUNDTABLE_PING'; payload?: { timestamp?: number } }
  | { type: 'ROUNDTABLE_APPLY_TEMPLATE'; payload: { templateId: string } }
) & MessageEnvelope;

export type RoundtableToHostMessage = (
  | { type: 'ROUNDTABLE_READY'; payload?: { version: string; capabilities: string[] } }
  | { type: 'ROUNDTABLE_STATE_SYNC'; payload: { state: string; roundCount: number; totalTurns: number; conversationId: string } }
  | { type: 'ROUNDTABLE_INSERT_CODE'; payload: { code: string; language?: string } }
  | { type: 'ROUNDTABLE_EXPORT_SUMMARY'; payload: { filename: string; content: string } }
  | { type: 'ROUNDTABLE_ACK'; payload: { messageId?: string; command: string; success: boolean; message?: string } }
  | { type: 'ROUNDTABLE_ERROR'; payload: { messageId?: string; command?: string; error: string; code?: string } }
  | { type: 'ROUNDTABLE_PONG'; payload: { messageId?: string; timestamp: number } }
) & MessageEnvelope;

export interface EmbedTransport {
  postMessage(message: RoundtableToHostMessage): void;
  onMessage(handler: (message: unknown, origin?: string) => void): () => void;
}

export interface MessageValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: HostToRoundtableMessage;
}
