/**
 * Multi-Agent Group Chat - Core Domain Types (Phase 1 MVP)
 */

export type ConversationState = 'idle' | 'running' | 'paused' | 'waiting_for_user' | 'ended';

export type AgentRole = 'participant' | 'moderator';

export interface VisualIdentity {
  avatar?: string;
  color: string;
}

export interface TimeoutSettings {
  firstTokenMs: number;
  totalMs: number;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  provider: string; // 'mock' | 'openai-compatible' | 'anthropic' | 'gemini'
  model: string;
  rolePrompt?: string; // system prompt defining expertise & perspective (optional)
  temperature: number;
  maxOutputTokens: number;
  contextBudget: number; // total token budget for prompt + output
  timeoutSettings: TimeoutSettings;
  visualIdentity: VisualIdentity;
  modelMetadata?: Record<string, unknown>;
}

export type SpeakerSelectionPolicy = 'manual' | 'round-robin' | 'moderator-directed';
export type TerminationPolicy = 'manual' | 'max-rounds' | 'token-budget' | 'moderator-conclusion';

export interface Group {
  id: string;
  name: string;
  goal: string; // topic or problem statement to deliberate on
  agentIds: string[];
  moderatorId: string;
  speakerPolicy: SpeakerSelectionPolicy;
  terminationPolicy: TerminationPolicy;
  maxRounds?: number;
  maxTokens?: number;
  turnTimeoutMs?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  firstTokenLatencyMs?: number;
  estimatedCost?: number;
  provider: string;
  model: string;
}

export type TurnStatus = 'started' | 'completed' | 'failed' | 'skipped' | 'interrupted';

export type ProviderErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'unavailable'
  | 'context_overflow'
  | 'auth'
  | 'unknown';

export interface NormalizedProviderError {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  statusCode?: number;
  rawError?: string;
}

export type RecoveryAction = 'retry' | 'skip' | 'fallback' | 'pause';

export interface Turn {
  id: string;
  conversationId: string;
  speakerId: string;
  speakerName: string;
  role: 'agent' | 'user' | 'moderator';
  selectedModel: string;
  selectedProvider: string;
  status: TurnStatus;
  content: string;
  rawPrompt?: string;
  usage?: Usage;
  error?: NormalizedProviderError;
  recoveryAction?: RecoveryAction;
  startedAt: number;
  completedAt?: number;
  effectiveConfig?: Record<string, unknown>;
}

export interface ActionItem {
  task: string;
  owner?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface NextStepsSummary {
  decisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
}

export interface DetailedSummary {
  positions: Record<string, string>; // agentName -> key position
  disagreements: string[];
  reasoning: string;
}

export interface ConversationSummaries {
  rollingSummary?: string;
  nextSteps?: NextStepsSummary;
  detailed?: DetailedSummary;
  renderedMarkdown?: string;
}

// Durable Event Model (Schema Version 1)
export type ConversationEventType =
  | 'conversation.created'
  | 'user.message'
  | 'turn.started'
  | 'turn.completed'
  | 'turn.failed'
  | 'turn.skipped'
  | 'summary.created'
  | 'conversation.ended';

export interface BaseEvent {
  eventId: string;
  conversationId: string;
  sequence: number;
  timestamp: number;
  schemaVersion: 1;
}

export interface ConversationCreatedEvent extends BaseEvent {
  type: 'conversation.created';
  payload: {
    group: Group;
    agents: Record<string, Agent>;
  };
}

export interface UserMessageEvent extends BaseEvent {
  type: 'user.message';
  payload: {
    turnId: string;
    text: string;
    senderName?: string;
  };
}

export interface TurnStartedEvent extends BaseEvent {
  type: 'turn.started';
  payload: {
    turnId: string;
    speakerId: string;
    speakerName: string;
    role: 'agent' | 'moderator';
    model: string;
    provider: string;
    effectiveConfig: {
      temperature: number;
      maxOutputTokens: number;
      contextBudget: number;
    };
  };
}

export interface TurnCompletedEvent extends BaseEvent {
  type: 'turn.completed';
  payload: {
    turnId: string;
    speakerId: string;
    content: string;
    usage: Usage;
  };
}

export interface TurnFailedEvent extends BaseEvent {
  type: 'turn.failed';
  payload: {
    turnId: string;
    speakerId: string;
    error: NormalizedProviderError;
    recoveryAction: RecoveryAction;
  };
}

export interface TurnSkippedEvent extends BaseEvent {
  type: 'turn.skipped';
  payload: {
    turnId: string;
    speakerId: string;
    reason: string;
  };
}

export interface SummaryCreatedEvent extends BaseEvent {
  type: 'summary.created';
  payload: {
    summaryType: 'rolling' | 'next-steps' | 'detailed';
    content: string;
    structured?: NextStepsSummary | DetailedSummary;
  };
}

export interface ConversationEndedEvent extends BaseEvent {
  type: 'conversation.ended';
  payload: {
    reason: string;
    finalTurnCount: number;
  };
}

export type ConversationEvent =
  | ConversationCreatedEvent
  | UserMessageEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | TurnSkippedEvent
  | SummaryCreatedEvent
  | ConversationEndedEvent;

export interface Conversation {
  id: string;
  groupId: string;
  groupSnapshot: Group;
  agentSnapshots: Record<string, Agent>;
  state: ConversationState;
  currentSpeakerId?: string;
  roundCount: number;
  totalTurns: number;
  totalUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    estimatedCost: number;
  };
  events: ConversationEvent[];
  turns: Turn[];
  summaries: ConversationSummaries;
  terminationReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModeratorDecision {
  nextSpeaker?: string;
  concluded: boolean;
  reason: string;
}

export interface RunOptions {
  speakerPolicy?: SpeakerSelectionPolicy;
  terminationPolicy?: TerminationPolicy;
  maxRounds?: number;
  maxTokens?: number;
  hardTurnLimit?: number; // Safety ceiling, default 50
}
