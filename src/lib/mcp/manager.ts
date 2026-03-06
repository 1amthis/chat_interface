import type { MCPServerConfig, UnifiedTool, MCPServerStatus } from '@/types';
import { MCPClient } from './client';
import type { MCPCallToolResult, MCPTool } from './types';

function toToolDefinition(serverId: string, tool: MCPTool): UnifiedTool {
  return {
    source: 'mcp',
    serverId,
    name: tool.name,
    description: tool.description || '',
    parameters: {
      type: 'object',
      properties: tool.inputSchema.properties || {},
      required: tool.inputSchema.required,
    },
  };
}

export async function getMCPStatusAndTools(
  configs: MCPServerConfig[]
): Promise<{ servers: MCPServerStatus[]; tools: UnifiedTool[] }> {
  const servers: MCPServerStatus[] = [];
  const tools: UnifiedTool[] = [];

  for (const config of configs) {
    if (!config.enabled) continue;

    const client = new MCPClient(config);
    try {
      await client.connect();

      servers.push({
        id: config.id,
        name: config.name,
        connected: true,
        toolCount: client.tools.length,
      });

      for (const tool of client.tools) {
        tools.push(toToolDefinition(config.id, tool));
      }
    } catch (error) {
      servers.push({
        id: config.id,
        name: config.name,
        connected: false,
        toolCount: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await client.disconnect();
    }
  }

  return { servers, tools };
}

export async function callMCPTool(
  configs: MCPServerConfig[],
  serverId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<MCPCallToolResult> {
  const serverConfig = configs.find((config) => config.id === serverId);
  if (!serverConfig) {
    throw new Error(`MCP server not found: ${serverId}`);
  }

  if (!serverConfig.enabled) {
    throw new Error(`MCP server is disabled: ${serverId}`);
  }

  const client = new MCPClient(serverConfig);
  try {
    await client.connect();
    return await client.callTool(toolName, params);
  } finally {
    await client.disconnect();
  }
}
