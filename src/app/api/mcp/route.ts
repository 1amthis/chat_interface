import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';
import { validateCSRF, mcpServerConfigArraySchema, builtinToolsConfigSchema } from '@/lib/mcp/server-config';
import type { UnifiedTool } from '@/types';

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
  // CSRF protection
  if (!validateCSRF(request)) {
    return NextResponse.json(
      { error: 'CSRF validation failed: request must originate from the application' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { mcpServers, builtinTools } = body;

    // Validate MCP server configuration with zod
    if (mcpServers !== undefined) {
      const serverValidation = mcpServerConfigArraySchema.safeParse(mcpServers);
      if (!serverValidation.success) {
        return NextResponse.json(
          {
            error: 'Invalid MCP server configuration',
            details: serverValidation.error.format(),
          },
          { status: 400 }
        );
      }

      await mcpManager.updateConfig(serverValidation.data);
    }

    // Get all available tools
    const tools: UnifiedTool[] = [];

    // Get MCP tools
    const mcpTools = await mcpManager.getAvailableTools();
    tools.push(...mcpTools);

    // Get built-in tools (validate config if provided)
    if (builtinTools) {
      const builtinValidation = builtinToolsConfigSchema.safeParse(builtinTools);
      if (builtinValidation.success) {
        const builtin = getBuiltinTools(builtinValidation.data);
        tools.push(...builtin);
      }
      // If validation fails, silently skip builtin tools rather than failing the whole request
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
