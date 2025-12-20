import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp/manager';
import { executeBuiltinTool } from '@/lib/mcp/builtin-tools';
import { parseToolName, formatMCPResultForProvider } from '@/lib/mcp/tool-converter';
import type { BuiltinToolsConfig, Provider } from '@/types';

export const dynamic = 'force-dynamic';

interface CallToolRequest {
  // For directly specifying the tool
  source?: 'mcp' | 'builtin';
  serverId?: string;
  toolName: string;
  params: Record<string, unknown>;

  // For parsing a prefixed tool name
  prefixedToolName?: string;

  // Config for built-in tools
  builtinToolsConfig?: BuiltinToolsConfig;

  // Provider for formatting output
  provider?: Provider;
}

// POST /api/mcp/call - Execute an MCP or built-in tool
export async function POST(request: NextRequest) {
  try {
    const body: CallToolRequest = await request.json();
    let { source, serverId, toolName, params } = body;
    const { prefixedToolName, builtinToolsConfig, provider } = body;

    // Parse prefixed tool name if provided
    if (prefixedToolName) {
      const parsed = parseToolName(prefixedToolName);
      // Map parsed source to valid API source types
      if (parsed.source === 'mcp') {
        source = 'mcp';
        serverId = parsed.serverId;
      } else if (parsed.source === 'builtin') {
        source = 'builtin';
      } else {
        // Other sources (web_search, google_drive, other) don't use this endpoint
        source = undefined;
      }
      toolName = parsed.name;
    }

    if (!toolName) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }

    let result;

    if (source === 'mcp') {
      if (!serverId) {
        return NextResponse.json(
          { error: 'Server ID is required for MCP tools' },
          { status: 400 }
        );
      }

      result = await mcpManager.callTool(serverId, toolName, params || {});
    } else if (source === 'builtin') {
      if (!builtinToolsConfig) {
        return NextResponse.json(
          { error: 'Built-in tools config is required' },
          { status: 400 }
        );
      }

      result = await executeBuiltinTool(toolName, params || {}, builtinToolsConfig);
    } else {
      return NextResponse.json(
        { error: 'Unknown tool source. Specify source or use prefixed tool name.' },
        { status: 400 }
      );
    }

    // Format result for provider if specified
    const formattedResult = provider
      ? formatMCPResultForProvider(result, provider)
      : null;

    return NextResponse.json({
      result,
      formattedResult,
    });
  } catch (error) {
    console.error('Error calling tool:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute tool',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
