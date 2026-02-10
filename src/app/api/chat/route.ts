import { NextRequest } from 'next/server';
import { streamChat, ChatMessage, ToolExecutionResult } from '@/lib/providers';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, UnifiedTool } from '@/types';
import { mcpManager } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';

export const dynamic = 'force-dynamic';

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
            ragEnabled
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
