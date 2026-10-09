/**
 * Roundtable Core Domain Types (Phase 1 MVP + Phase 2 Reasoning Engine)
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
  provider: string; // 'mock' | 'openai-compatible' | 'anthropic' | 'gemini' | custom
  model: string;
  rolePrompt?: string; // system prompt defining expertise & perspective (optional)
  temperature: number;
  maxOutputTokens: number;
  contextBudget: number; // total token budget for prompt + output
  timeoutSettings: TimeoutSettings;
  visualIdentity: VisualIdentity;
  modelMetadata?: Record<string, unknown>;
  createdAt?: number;
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
  protocol?: DeliberationProtocol;
  tierScheduling?: boolean;
  contextBudget?: number;
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
  role: 'agent' | 'user' | 'moderator' | 'participant';
  selectedModel: string;
  selectedProvider: string;
  model?: string;
  provider?: string;
  status: TurnStatus;
  content: string;
  rawPrompt?: string;
  usage?: Usage;
  error?: NormalizedProviderError;
  recoveryAction?: RecoveryAction;
  startedAt: number;
  completedAt?: number;
  createdAt?: number;
  toolCalls?: Array<{ toolName: string; args: Record<string, any>; output: string; isError?: boolean; executionMs?: number }>;
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

// --- Phase 2: Shared Blackboard ---
export interface BlackboardItem {
  id: string;
  category: 'decision' | 'hypothesis' | 'assumption' | 'open_question';
  text: string;
  authorId: string;
  authorName: string;
  status: 'active' | 'resolved' | 'rejected';
  resolvedReason?: string;
  timestamp: number;
}

export interface BlackboardState {
  items: Record<string, BlackboardItem>;
  updatedAt: number;
}

// --- Phase 2: Dissent Log ---
export interface DissentItem {
  id: string;
  agentId: string;
  agentName: string;
  topic: string;
  objection: string;
  timestamp: number;
}

// --- Phase 2: Branching ---
export interface BranchNode {
  conversationId: string;
  branchName: string;
  parentConversationId?: string;
  forkSequence?: number;
  forkTurnId?: string;
  createdAt: number;
}

// --- Phase 2: Protocols ---
export type DeliberationProtocol =
  | 'standard'
  | 'blind-first'
  | 'debate'
  | 'red-team'
  | 'pre-mortem';

// Durable Event Model (Schema Version 2)
export type ConversationEventType =
  | 'conversation.created'
  | 'user.message'
  | 'turn.started'
  | 'turn.completed'
  | 'turn.failed'
  | 'turn.skipped'
  | 'summary.created'
  | 'blackboard.item_added'
  | 'blackboard.item_resolved'
  | 'blind_round.completed'
  | 'conversation.forked'
  | 'dissent.logged'
  | 'stall.detected'
  | 'tool.executed'
  | 'conversation.ended';

export interface BaseEvent {
  eventId: string;
  conversationId: string;
  sequence: number;
  timestamp: number;
  schemaVersion: number;
}

export interface ConversationCreatedEvent extends BaseEvent {
  type: 'conversation.created';
  payload: {
    group: Group;
    agents: Record<string, Agent>;
    protocol?: DeliberationProtocol;
    branchName?: string;
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
    role: AgentRole | 'agent';
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
    usage?: Usage;
  };
}

export interface TurnFailedEvent extends BaseEvent {
  type: 'turn.failed';
  payload: {
    turnId: string;
    speakerId: string;
    error: NormalizedProviderError;
    recoveryAction: 'retry' | 'skip' | 'pause';
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

export interface BlackboardItemAddedEvent extends BaseEvent {
  type: 'blackboard.item_added';
  payload: {
    item: BlackboardItem;
  };
}

export interface BlackboardItemResolvedEvent extends BaseEvent {
  type: 'blackboard.item_resolved';
  payload: {
    itemId: string;
    status: 'resolved' | 'rejected';
    reason?: string;
  };
}

export interface BlindRoundCompletedEvent extends BaseEvent {
  type: 'blind_round.completed';
  payload: {
    roundNumber: number;
    stances: Record<string, { content: string; speakerName: string; usage?: Usage }>;
  };
}

export interface ConversationForkedEvent extends BaseEvent {
  type: 'conversation.forked';
  payload: {
    parentConversationId: string;
    forkTurnSequence: number;
    forkTurnId?: string;
    newBranchName: string;
  };
}

export interface DissentLoggedEvent extends BaseEvent {
  type: 'dissent.logged';
  payload: {
    dissent: DissentItem;
  };
}

export interface StallDetectedEvent extends BaseEvent {
  type: 'stall.detected';
  payload: {
    roundNumber: number;
    reason: string;
    suggestedIntervention: string;
  };
}

export interface ToolExecutedEvent extends BaseEvent {
  type: 'tool.executed';
  payload: {
    turnId: string;
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    output: string;
    isError: boolean;
    executionMs: number;
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
  | BlackboardItemAddedEvent
  | BlackboardItemResolvedEvent
  | BlindRoundCompletedEvent
  | ConversationForkedEvent
  | DissentLoggedEvent
  | StallDetectedEvent
  | ToolExecutedEvent
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
  totalTokens?: number;
  blackboard: BlackboardState;
  dissentLog: DissentItem[];
  branch: BranchNode;
  protocol: DeliberationProtocol;
  blindRoundStances?: Record<string, { content: string; speakerName: string }>;
  terminationReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModeratorDecision {
  nextSpeaker?: string;
  concluded: boolean;
  reason: string;
  suggestedBlackboardItem?: {
    category: 'decision' | 'hypothesis' | 'assumption' | 'open_question';
    text: string;
  };
}

export interface RunOptions {
  speakerPolicy?: SpeakerSelectionPolicy;
  terminationPolicy?: TerminationPolicy;
  protocol?: DeliberationProtocol;
  maxRounds?: number;
  maxTokens?: number;
  hardTurnLimit?: number; // Safety ceiling, default 50
  tierScheduling?: boolean; // Hybrid local/frontier model scheduling
}
