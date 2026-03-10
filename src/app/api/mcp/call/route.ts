import { NextRequest, NextResponse } from 'next/server';
import { callMCPTool } from '@/lib/mcp/manager';
import { executeBuiltinTool } from '@/lib/mcp/builtin-tools';
import { parseToolName, formatMCPResultForProvider } from '@/lib/mcp/tool-converter';
import { validateCSRF, builtinToolsConfigSchema, mcpServerConfigArraySchema } from '@/lib/mcp/server-config';
import type { BuiltinToolsConfig, Provider, MCPServerConfig } from '@/types';

export const dynamic = 'force-dynamic';

interface CallToolRequest {
  // For directly specifying the tool
  source?: 'mcp' | 'builtin';
  serverId?: string;
  mcpServers?: MCPServerConfig[];
  toolName: string;
  params: Record<string, unknown>;

  // For parsing a prefixed tool name
  prefixedToolName?: string;

  // Config for built-in tools
  builtinToolsConfig?: BuiltinToolsConfig;
  projectWorkspaceRoot?: string;
  projectSkillsEnabled?: boolean;

  // Provider for formatting output
  provider?: Provider;
}

// POST /api/mcp/call - Execute an MCP or built-in tool
export async function POST(request: NextRequest) {
  // CSRF protection: only allow requests from localhost/app host
  if (!validateCSRF(request)) {
    return NextResponse.json(
      { error: 'CSRF validation failed: request must originate from the application' },
      { status: 403 }
    );
  }

  try {
    const body: CallToolRequest = await request.json();
    let { source, serverId, toolName } = body;
    const { params, mcpServers } = body;
    const {
      prefixedToolName,
      builtinToolsConfig,
      provider,
      projectWorkspaceRoot,
      projectSkillsEnabled,
    } = body;

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

      if (!mcpServers) {
        return NextResponse.json(
          { error: 'MCP server configuration is required for MCP tools' },
          { status: 400 }
        );
      }

      const serverValidation = mcpServerConfigArraySchema.safeParse(mcpServers);
      if (!serverValidation.success) {
        return NextResponse.json(
          { error: 'Invalid MCP server configuration', details: serverValidation.error.format() },
          { status: 400 }
        );
      }

      result = await callMCPTool(serverValidation.data, serverId, toolName, params || {});
    } else if (source === 'builtin') {
      // Validate builtinToolsConfig with zod to prevent malicious configs
      const configValidation = builtinToolsConfigSchema.safeParse(builtinToolsConfig ?? {});
      if (!configValidation.success) {
        return NextResponse.json(
          { error: 'Invalid built-in tools config', details: configValidation.error.format() },
          { status: 400 }
        );
      }

      result = await executeBuiltinTool(toolName, params || {}, configValidation.data, {
        projectWorkspaceRoot,
        projectSkillsEnabled,
      });
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
