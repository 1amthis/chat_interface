import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';
import type { MCPServerConfig, BuiltinToolsConfig, UnifiedTool } from '@/types';

export const dynamic = 'force-dynamic';

// GET /api/mcp - Get MCP status and available tools
export async function GET() {
  try {
    const status = await mcpManager.getStatus();
    const mcpTools = await mcpManager.getAvailableTools();

    return NextResponse.json({
      servers: status,
      tools: mcpTools,
    });
  } catch (error) {
    console.error('Error getting MCP status:', error);
    return NextResponse.json(
      { error: 'Failed to get MCP status' },
      { status: 500 }
    );
  }
}

// POST /api/mcp - Update MCP configuration and get tools
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mcpServers,
      builtinTools,
    }: {
      mcpServers?: MCPServerConfig[];
      builtinTools?: BuiltinToolsConfig;
    } = body;

    // Update MCP server configuration
    if (mcpServers && Array.isArray(mcpServers)) {
      await mcpManager.updateConfig(mcpServers);
    }

    // Get all available tools
    const tools: UnifiedTool[] = [];

    // Get MCP tools
    const mcpTools = await mcpManager.getAvailableTools();
    tools.push(...mcpTools);

    // Get built-in tools
    if (builtinTools) {
      const builtin = getBuiltinTools(builtinTools);
      tools.push(...builtin);
    }

    // Get server status
    const status = await mcpManager.getStatus();

    return NextResponse.json({
      servers: status,
      tools,
    });
  } catch (error) {
    console.error('Error updating MCP config:', error);
    return NextResponse.json(
      { error: 'Failed to update MCP configuration' },
      { status: 500 }
    );
  }
}
