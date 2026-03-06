import { NextRequest, NextResponse } from 'next/server';
import { getMCPStatusAndTools } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';
import { validateCSRF, mcpServerConfigArraySchema, builtinToolsConfigSchema } from '@/lib/mcp/server-config';
import type { UnifiedTool } from '@/types';

export const dynamic = 'force-dynamic';

// GET /api/mcp - Get MCP status and available tools
export async function GET() {
  return NextResponse.json({
    servers: [],
    tools: [],
  });
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
    const tools: UnifiedTool[] = [];
    let status: { id: string; name: string; connected: boolean; toolCount: number; error?: string }[] = [];

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

      const mcpCatalog = await getMCPStatusAndTools(serverValidation.data);
      status = mcpCatalog.servers;
      tools.push(...mcpCatalog.tools);
    }

    // Get built-in tools (validate config if provided)
    if (builtinTools) {
      const builtinValidation = builtinToolsConfigSchema.safeParse(builtinTools);
      if (!builtinValidation.success) {
        return NextResponse.json(
          {
            error: 'Invalid built-in tools config',
            details: builtinValidation.error.format(),
          },
          { status: 400 }
        );
      }

      const builtin = getBuiltinTools(builtinValidation.data);
      tools.push(...builtin);
    }

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
