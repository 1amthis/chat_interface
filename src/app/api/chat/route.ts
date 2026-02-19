import { NextRequest } from 'next/server';
import { streamChat, ChatMessage, ToolExecutionResult } from '@/lib/providers';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, UnifiedTool, ContextBreakdown, ContextBreakdownSection } from '@/types';
import { mcpManager } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';
import { estimateTokens } from '@/lib/token-estimation';
import { getModelMetadata } from '@/lib/model-metadata';

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
    }

    // Always load builtin tools regardless of mcpEnabled (SQLite, filesystem, etc. are independent)
    if (settings.builtinTools) {
      const builtinTools = getBuiltinTools(settings.builtinTools);
      mcpTools.push(...builtinTools);
    }

    // Build context breakdown for the client
    const modelMeta = getModelMetadata(settings.model);
    const contextWindowSize = modelMeta?.contextWindow || 128_000;

    const sections: ContextBreakdownSection[] = [];
    const sectionColors = {
      system: '#3b82f6',   // blue
      tools: '#8b5cf6',    // purple
      messages: '#22c55e', // green
      toolResults: '#f97316', // orange
    };

    // System prompt
    const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
    if (systemTokens > 0) {
      sections.push({
        label: 'System Prompt',
        estimatedTokens: systemTokens,
        percentage: 0, // computed below
        color: sectionColors.system,
      });
    }

    // Tool definitions
    const allTools = [...mcpTools];
    // Count built-in search/drive/memory/rag/artifact tools that get added by providers
    let builtinToolCount = 0;
    if (webSearchEnabled) builtinToolCount++;
    if (googleDriveEnabled) builtinToolCount++;
    if (memorySearchEnabled) builtinToolCount++;
    if (ragEnabled) builtinToolCount++;
    if (artifactsEnabled) builtinToolCount += 3; // create, update, read
    const toolDefsText = JSON.stringify(allTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })));
    const toolTokens = estimateTokens(toolDefsText) + (builtinToolCount * 150); // ~150 tokens per built-in tool
    if (toolTokens > 0 && (allTools.length > 0 || builtinToolCount > 0)) {
      sections.push({
        label: 'Tool Definitions',
        estimatedTokens: toolTokens,
        percentage: 0,
        color: sectionColors.tools,
        details: [
          ...(allTools.length > 0 ? [{ label: `MCP/Builtin tools (${allTools.length})`, estimatedTokens: estimateTokens(toolDefsText) }] : []),
          ...(builtinToolCount > 0 ? [{ label: `Search/Artifact tools (${builtinToolCount})`, estimatedTokens: builtinToolCount * 150 }] : []),
        ],
      });
    }

    // Conversation messages
    const messageDetails: { label: string; estimatedTokens: number }[] = [];
    let totalMessageTokens = 0;
    for (const msg of messages) {
      const contentTokens = estimateTokens(msg.content || '');
      const attachmentTokens = msg.attachments
        ? msg.attachments.reduce((sum: number, a: { type: string; data?: string }) => {
            // Images count ~85 tokens for low-detail, text attachments by content length
            if (a.type === 'image') return sum + 85;
            if (a.data) return sum + estimateTokens(a.data);
            return sum;
          }, 0)
        : 0;
      const msgTokens = contentTokens + attachmentTokens;
      totalMessageTokens += msgTokens;
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      const preview = (msg.content || '').slice(0, 40).replace(/\n/g, ' ');
      messageDetails.push({
        label: `${roleLabel}: ${preview}${(msg.content || '').length > 40 ? '...' : ''}`,
        estimatedTokens: msgTokens,
      });
    }
    if (totalMessageTokens > 0) {
      sections.push({
        label: 'Conversation Messages',
        estimatedTokens: totalMessageTokens,
        percentage: 0,
        color: sectionColors.messages,
        details: messageDetails,
      });
    }

    // Tool execution results
    let toolResultTokens = 0;
    const toolResultDetails: { label: string; estimatedTokens: number }[] = [];
    if (toolExecutions && toolExecutions.length > 0) {
      for (const exec of toolExecutions) {
        const resultStr = typeof exec.result === 'string' ? exec.result : JSON.stringify(exec.result);
        const tokens = estimateTokens(resultStr);
        toolResultTokens += tokens;
        toolResultDetails.push({
          label: `${exec.toolName} result`,
          estimatedTokens: tokens,
        });
      }
      sections.push({
        label: 'Tool Results',
        estimatedTokens: toolResultTokens,
        percentage: 0,
        color: sectionColors.toolResults,
        details: toolResultDetails,
      });
    }

    const totalEstimatedTokens = systemTokens + toolTokens + totalMessageTokens + toolResultTokens;

    // Compute percentages
    for (const section of sections) {
      section.percentage = contextWindowSize > 0 ? (section.estimatedTokens / contextWindowSize) * 100 : 0;
    }

    const contextBreakdown: ContextBreakdown = {
      sections,
      totalEstimatedTokens,
      contextWindowSize,
      percentUsed: contextWindowSize > 0 ? (totalEstimatedTokens / contextWindowSize) * 100 : 0,
      model: settings.model,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit context breakdown as the first event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ context_breakdown: contextBreakdown })}\n\n`
          ));

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
