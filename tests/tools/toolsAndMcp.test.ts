import { describe, it, expect } from 'vitest';
import { ToolRegistry, defaultToolRegistry, extractToolCalls } from '../../packages/tools/registry.ts';
import { MCPClient } from '../../packages/tools/mcpClient.ts';

describe('Tools Execution Registry & MCP Grounding (Phase 3)', () => {
  it('registers and executes custom tools with argument validation', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'ping_service',
      description: 'Pings a network endpoint',
      parameters: {
        host: { type: 'string', description: 'Target hostname', required: true },
        port: { type: 'number', description: 'Target port', required: false },
      },
      execute: async ({ host, port }) => {
        return { output: `Host ${host}:${port || 80} is online.` };
      },
    });

    expect(registry.has('ping_service')).toBe(true);

    // Missing required param
    const failRes = await registry.execute('ping_service', {}, {
      agentId: 'ag-1',
      agentName: 'Alice',
      conversationId: 'c-1',
    });
    expect(failRes.isError).toBe(true);
    expect(failRes.output).toContain('Missing required parameter');

    // Valid execution
    const okRes = await registry.execute('ping_service', { host: 'api.example.com', port: 443 }, {
      agentId: 'ag-1',
      agentName: 'Alice',
      conversationId: 'c-1',
    });
    expect(okRes.isError).toBe(false);
    expect(okRes.output).toBe('Host api.example.com:443 is online.');
    expect(okRes.executionMs).toBeGreaterThanOrEqual(0);
  });

  it('runs built-in calculate_expression, standards_lookup, and syntax_check tools', async () => {
    const calc = await defaultToolRegistry.execute('calculate_expression', {
      expression: '(1000 * 0.05) + (200 * 0.1)',
    }, { agentId: 'user', agentName: 'User', conversationId: 'c-1' });
    expect(calc.isError).toBe(false);
    expect(calc.output).toContain('Result: 70');

    const spec = await defaultToolRegistry.execute('standards_lookup', {
      topic: 'raft',
    }, { agentId: 'user', agentName: 'User', conversationId: 'c-1' });
    expect(spec.isError).toBe(false);
    expect(spec.output).toContain('Raft Consensus Algorithm');

    const syn = await defaultToolRegistry.execute('syntax_check', {
      code: '{"valid": true, "count": 42}',
      language: 'json',
    }, { agentId: 'user', agentName: 'User', conversationId: 'c-1' });
    expect(syn.isError).toBe(false);
    expect(syn.output).toContain('Valid JSON');
  });

  it('extracts structured tool calls from agent text', () => {
    const text = `
    Based on our partition requirements, I will verify the cluster math.
    [ToolCall: calculate_expression {"expression": "50000 / 100"}]
    And look up the Paxos baseline:
    [Action: standards_lookup {"topic": "paxos"}]
    `;

    const calls = extractToolCalls(text, 'ag-architect', 'Architect');
    expect(calls).toHaveLength(2);
    expect(calls[0].toolName).toBe('calculate_expression');
    expect(calls[0].args.expression).toBe('50000 / 100');
    expect(calls[1].toolName).toBe('standards_lookup');
    expect(calls[1].args.topic).toBe('paxos');
  });

  it('connects to MCP client, lists resources/prompts, and bridges tools', async () => {
    const mcp = new MCPClient({
      id: 'cluster_mcp',
      name: 'Cluster Inspector MCP',
      transport: 'in-memory',
      customTools: [
        {
          name: 'get_node_status',
          description: 'Gets status of Kubernetes cluster node',
          parameters: { nodeId: { type: 'string', description: 'Node ID', required: true } },
          execute: async ({ nodeId }) => ({ output: `Node ${nodeId}: Ready` }),
        },
      ],
      resources: [
        { uri: 'mcp://cluster/nodes', name: 'Cluster Nodes', mimeType: 'text/plain', text: 'node-1, node-2' },
      ],
      prompts: [
        { name: 'audit_cluster', description: 'Review cluster resilience' },
      ],
    });

    await mcp.connect();
    expect(mcp.connected).toBe(true);

    const tools = await mcp.listTools();
    expect(tools).toHaveLength(1);

    const resources = await mcp.listResources();
    expect(resources[0].uri).toBe('mcp://cluster/nodes');

    const registry = new ToolRegistry();
    mcp.bridgeToRegistry(registry);
    expect(registry.has('mcp_cluster_mcp_get_node_status')).toBe(true);
  });
});
