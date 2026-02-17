import { NextRequest } from 'next/server';
import { streamChat, ChatMessage, ToolExecutionResult } from '@/lib/providers';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, UnifiedTool } from '@/types';
import { mcpManager } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';

export const dynamic = 'force-dynamic';

/**
 * Extract a detailed error message from provider SDK errors.
 * The OpenAI SDK (used by OpenAI, Mistral, Cerebras) throws APIError
 * with status, error body, code, param, and type fields.
 */
function extractErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';

  const parts: string[] = [];

  // OpenAI SDK APIError has these extra fields
  const apiErr = error as {
    status?: number;
    error?: unknown;
    code?: string | null;
    param?: string | null;
    type?: string;
    requestID?: string | null;
  };

  if (apiErr.status) {
    parts.push(`[${apiErr.status}]`);
  }

  // Try to get a meaningful message from the error body
  if (apiErr.error && typeof apiErr.error === 'object') {
    const body = apiErr.error as Record<string, unknown>;
    const msg = body.message || body.detail || body.error;
    if (typeof msg === 'string') {
      parts.push(msg);
    } else if (msg && typeof msg === 'object') {
      const nested = (msg as Record<string, unknown>).message;
      if (typeof nested === 'string') {
        parts.push(nested);
      } else {
        parts.push(JSON.stringify(msg));
      }
    } else {
      // Stringify the whole body for debugging
      parts.push(JSON.stringify(apiErr.error));
    }
  } else if (error.message) {
    parts.push(error.message);
  }

  if (apiErr.code) parts.push(`(code: ${apiErr.code})`);
  if (apiErr.param) parts.push(`(param: ${apiErr.param})`);
  if (apiErr.type) parts.push(`(type: ${apiErr.type})`);

  return parts.join(' ') || error.message || 'Unknown error';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      settings,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      memorySearchEnabled,
      ragEnabled,
      toolExecutions,
      artifactsEnabled,
    } = body as {
      messages: ChatMessage[];
      settings: ChatSettings;
      systemPrompt?: string;
      webSearchEnabled?: boolean;
      searchResults?: WebSearchResponse;
      googleDriveEnabled?: boolean;
      driveSearchResults?: GoogleDriveSearchResponse;
      memorySearchEnabled?: boolean;
      ragEnabled?: boolean;
      toolExecutions?: ToolExecutionResult[];
      artifactsEnabled?: boolean;
    };

    // Collect MCP and built-in tools if enabled
    let mcpTools: UnifiedTool[] = [];

    if (settings.mcpEnabled) {
      // Update MCP configuration if servers are configured
      if (settings.mcpServers && settings.mcpServers.length > 0) {
        await mcpManager.updateConfig(settings.mcpServers);
      }

      // Get available MCP tools
      const serverTools = await mcpManager.getAvailableTools();
      mcpTools.push(...serverTools);

      // Get built-in tools
      if (settings.builtinTools) {
        const builtinTools = getBuiltinTools(settings.builtinTools);
        mcpTools.push(...builtinTools);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat(
            messages,
            settings,
            systemPrompt,
            webSearchEnabled,
            searchResults,
            googleDriveEnabled,
            driveSearchResults,
            memorySearchEnabled,
            mcpTools.length > 0 ? mcpTools : undefined,
            toolExecutions,
            ragEnabled,
            artifactsEnabled
          )) {
            if (chunk.type === 'content') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
            } else if (chunk.type === 'reasoning') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reasoning: chunk.reasoning })}\n\n`));
            } else if (chunk.type === 'usage') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: chunk.usage })}\n\n`));
            } else if (chunk.type === 'tool_call') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                tool_call: {
                  id: chunk.toolCallId,
                  name: chunk.toolName,
                  originalName: chunk.originalToolName, // Prefixed name for Anthropic API
                  params: chunk.toolParams,
                  source: chunk.toolSource,
                  serverId: chunk.toolServerId,
                  thinkingSignature: chunk.toolThinkingSignature,
                },
              })}\n\n`));
            } else if (chunk.type === 'tool_calls') {
              // Multiple parallel tool calls
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                tool_calls: chunk.toolCalls,
              })}\n\n`));
            } else if (chunk.type === 'search_status') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ search_status: chunk.status })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const errorMessage = extractErrorMessage(error);
          console.error('[chat/route] Stream error:', errorMessage, error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[chat/route] Request error:', errorMessage, error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
