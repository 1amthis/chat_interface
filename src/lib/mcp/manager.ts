import type { MCPServerConfig, UnifiedTool, MCPServerStatus } from '@/types';
import { MCPClient } from './client';
import type { MCPCallToolResult } from './types';

class MCPManager {
  private static instance: MCPManager | null = null;
  private clients: Map<string, MCPClient> = new Map();
  private configHash: string = '';

  private constructor() {}

  static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  private hashConfig(configs: MCPServerConfig[]): string {
    return JSON.stringify(
      configs.map((c) => ({
        id: c.id,
        enabled: c.enabled,
        transport: c.transport,
        command: c.command,
        args: c.args,
        url: c.url,
        headers: c.headers,
        env: c.env,
      }))
    );
  }

  async updateConfig(configs: MCPServerConfig[]): Promise<void> {
    const newHash = this.hashConfig(configs);

    // If config hasn't changed, skip
    if (newHash === this.configHash) {
      return;
    }

    this.configHash = newHash;

    // Build set of enabled server IDs
    const enabledIds = new Set(
      configs.filter((c) => c.enabled).map((c) => c.id)
    );

    // Disconnect servers that are no longer enabled
    for (const [id, client] of this.clients.entries()) {
      if (!enabledIds.has(id)) {
        await client.disconnect();
        this.clients.delete(id);
      }
    }

    // Connect new servers
    for (const config of configs) {
      if (!config.enabled) continue;

      const existing = this.clients.get(config.id);
      if (existing) {
        // Check if config changed for this server
        const existingState = existing.connectionState;
        if (existingState.connected) {
          continue; // Already connected with same config
        }
      }

      // Create and connect new client
      const client = new MCPClient(config);
      try {
        await client.connect();
        this.clients.set(config.id, client);
      } catch (error) {
        console.error(`Failed to connect to MCP server ${config.name}:`, error);
        // Still add to track error state
        this.clients.set(config.id, client);
      }
    }
  }

  async getAvailableTools(): Promise<UnifiedTool[]> {
    const tools: UnifiedTool[] = [];

    for (const [serverId, client] of this.clients.entries()) {
      if (!client.isConnected) continue;

      for (const tool of client.tools) {
        tools.push({
          source: 'mcp',
          serverId,
          name: tool.name,
          description: tool.description || '',
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties || {},
            required: tool.inputSchema.required,
          },
        });
      }
    }

    return tools;
  }

  async callTool(
    serverId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<MCPCallToolResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    if (!client.isConnected) {
      throw new Error(`MCP server not connected: ${serverId}`);
    }

    return client.callTool(toolName, params);
  }

  async getStatus(): Promise<MCPServerStatus[]> {
    const statuses: MCPServerStatus[] = [];

    for (const [id, client] of this.clients.entries()) {
      const state = client.connectionState;
      statuses.push({
        id,
        name: client.name,
        connected: state.connected,
        toolCount: state.tools.length,
        error: state.error,
      });
    }

    return statuses;
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, client] of this.clients.entries()) {
      const healthy = await client.healthCheck();
      results.set(id, healthy);
    }

    return results;
  }

  async reconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    await client.disconnect();
    await client.connect();
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.configHash = '';
  }

  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  isServerConnected(serverId: string): boolean {
    const client = this.clients.get(serverId);
    return client?.isConnected ?? false;
  }
}

export const mcpManager = MCPManager.getInstance();
