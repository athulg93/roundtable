/**
 * VS Code Webview & IDE Embed Host Protocol Types (Phase 3)
 */

import { Conversation } from '../core/types.ts';

export type HostToRoundtableMessage =
  | { type: 'ROUNDTABLE_INIT'; payload: { workspacePath?: string; activeFile?: string; activeSelection?: string; gitBranch?: string } }
  | { type: 'ROUNDTABLE_INTERJECT'; payload: { text: string; senderName?: string } }
  | { type: 'ROUNDTABLE_STEP'; payload?: { agentId?: string } }
  | { type: 'ROUNDTABLE_RUN'; payload?: { maxRounds?: number } }
  | { type: 'ROUNDTABLE_PAUSE' }
  | { type: 'ROUNDTABLE_RESUME' }
  | { type: 'ROUNDTABLE_APPLY_TEMPLATE'; payload: { templateId: string } };

export type RoundtableToHostMessage =
  | { type: 'ROUNDTABLE_READY' }
  | { type: 'ROUNDTABLE_STATE_SYNC'; payload: { state: string; roundCount: number; totalTurns: number; conversationId: string } }
  | { type: 'ROUNDTABLE_INSERT_CODE'; payload: { code: string; language?: string } }
  | { type: 'ROUNDTABLE_EXPORT_SUMMARY'; payload: { filename: string; content: string } };
