/**
 * Model Context Protocol (MCP) & Tools Grounding Domain Types (Phase 3)
 */

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameterSchema>;
  execute: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionContext {
  agentId: string;
  agentName: string;
  conversationId: string;
  timeoutMs?: number;
}

export interface ToolExecutionResult {
  output: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, any>;
  agentId: string;
  agentName: string;
  timestamp: number;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  output: string;
  isError: boolean;
  executionMs: number;
  timestamp: number;
}

export interface ToolExecutionRecord {
  call: ToolCall;
  result?: ToolResult;
  status: 'pending' | 'completed' | 'failed';
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  text?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}
