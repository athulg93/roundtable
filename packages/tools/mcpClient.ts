/**
 * Model Context Protocol (MCP) Client Adapter (Phase 3)
 * Implements MCP specification discovery, resource listing, and tool bridging.
 */

import { ToolDefinition, MCPResource, MCPPrompt } from './types.ts';
import { ToolRegistry } from './registry.ts';

export interface MCPServerConfig {
  id: string;
  name: string;
  endpointUrl?: string; // For HTTP/SSE MCP endpoints
  transport: 'in-memory' | 'sse' | 'stdio-mock';
  customTools?: ToolDefinition[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

export class MCPClient {
  readonly serverConfig: MCPServerConfig;
  private isConnected = false;

  constructor(serverConfig: MCPServerConfig) {
    this.serverConfig = serverConfig;
  }

  async connect(): Promise<boolean> {
    // In-memory or simulated SSE handshake
    this.isConnected = true;
    return true;
  }

  disconnect(): void {
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async listTools(): Promise<ToolDefinition[]> {
    if (!this.isConnected) await this.connect();
    return this.serverConfig.customTools || [];
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.isConnected) await this.connect();
    return this.serverConfig.resources || [
      {
        uri: 'mcp://workspace/readme',
        name: 'Project README',
        mimeType: 'text/markdown',
        text: 'Roundtable Multi-Agent Deliberation Engine Workspace Context',
      },
      {
        uri: 'mcp://workspace/architecture',
        name: 'Architecture Spec',
        mimeType: 'text/plain',
        text: 'Event-sourced deliberation system with append-only logs and shared blackboard.',
      },
    ];
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.isConnected) await this.connect();
    return this.serverConfig.prompts || [
      {
        name: 'threat_model_review',
        description: 'Examine attack surfaces for the current deliberation topic',
      },
      {
        name: 'pre_mortem_analysis',
        description: 'Identify potential single points of failure in technical architecture',
      },
    ];
  }

  /**
   * Bridges all MCP tools from this server into the Roundtable ToolRegistry.
   */
  bridgeToRegistry(registry: ToolRegistry): void {
    const tools = this.serverConfig.customTools || [];
    for (const tool of tools) {
      registry.register({
        ...tool,
        name: `mcp_${this.serverConfig.id}_${tool.name}`,
        description: `[MCP: ${this.serverConfig.name}] ${tool.description}`,
      });
    }
  }
}
