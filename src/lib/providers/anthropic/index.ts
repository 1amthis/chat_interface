/**
 * Anthropic provider implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, StreamChunk, ToolExecutionResult } from '../types';
import { UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';
import { toAnthropicTools, parseToolName } from '@/lib/mcp/tool-converter';
import { hasToolBeenExecuted } from '../base';
import { anthropicWebSearchTool, anthropicGoogleDriveTool } from '../tools/definitions';
import { toAnthropicContent } from './content';

/**
 * Stream chat using Anthropic Messages API
 */
export async function* streamAnthropic(
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
  systemPrompt?: string,
  webSearchEnabled?: boolean,
  searchResults?: WebSearchResponse,
  googleDriveEnabled?: boolean,
  driveSearchResults?: GoogleDriveSearchResponse,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[],
  thinkingEnabled?: boolean,
  thinkingBudgetTokens?: number
): AsyncGenerator<StreamChunk> {
  if (!apiKey) throw new Error('Anthropic API key is required');

  const client = new Anthropic({
    apiKey,
    defaultHeaders: {
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
  });

  // System prompt only - search results are now handled as proper tool results
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => {
    if (msg.role === 'assistant') {
      // If message has content blocks (from paused streaming), reconstruct them
      if (msg.contentBlocks && msg.contentBlocks.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];

        for (const block of msg.contentBlocks) {
          if (block.type === 'text' && block.text) {
            contentBlocks.push({ type: 'text', text: block.text } satisfies Anthropic.TextBlockParam);
          } else if (block.type === 'reasoning' && block.reasoning) {
            // Note: We can't reconstruct thinking blocks without the signature
            // Just add as text for now
            contentBlocks.push({ type: 'text', text: block.reasoning } satisfies Anthropic.TextBlockParam);
          }
          // Note: tool_call blocks are not sent back to the API in regular messages
          // They should be in toolExecutions instead
        }

        // If we have content blocks, use them; otherwise fall back to content string
        if (contentBlocks.length > 0) {
          return { role: 'assistant', content: contentBlocks };
        }
      }

      // Fall back to simple string content
      // If content is empty, this is likely an incomplete message - skip it or use minimal text
      return { role: 'assistant', content: msg.content || '...' };
    }
    return { role: 'user', content: toAnthropicContent(msg) };
  });

  let replayThinkingBlockForToolTurn: Anthropic.ContentBlockParam | undefined;

  // If there are tool executions, add them as proper tool use/result messages
  // This follows Anthropic's tool use protocol
  if (toolExecutions && toolExecutions.length > 0) {
    const thinkingFromToolTurn = toolExecutions.find(
      (te) => typeof te.anthropicThinkingSignature === 'string' && typeof te.anthropicThinking === 'string'
    );
    replayThinkingBlockForToolTurn =
      thinkingEnabled && thinkingFromToolTurn?.anthropicThinkingSignature
        ? ({
            type: 'thinking',
            signature: thinkingFromToolTurn.anthropicThinkingSignature,
            thinking: thinkingFromToolTurn.anthropicThinking ?? '',
          } satisfies Anthropic.ThinkingBlockParam)
        : undefined;

    // Add assistant message with tool_use content blocks
    // Use originalToolName (prefixed) when available, as Anthropic requires the exact tool name it sent
    const toolUseBlocks: Anthropic.ToolUseBlockParam[] = toolExecutions.map((te) => ({
      type: 'tool_use' as const,
      id: te.toolCallId,
      name: te.originalToolName || te.toolName,
      input: te.toolParams,
    }));

    anthropicMessages.push({
      role: 'assistant',
      content: replayThinkingBlockForToolTurn ? [replayThinkingBlockForToolTurn, ...toolUseBlocks] : toolUseBlocks,
    });

    // Add user message with tool_result content blocks
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = toolExecutions.map(te => ({
      type: 'tool_result' as const,
      tool_use_id: te.toolCallId,
      content: te.result,
      is_error: te.isError,
    }));

    anthropicMessages.push({
      role: 'user',
      content: toolResultBlocks,
    });
  }

  // Create request options
  const requestOptions: Anthropic.MessageStreamParams = {
    model,
    max_tokens: 8192, // Increased for complex tool use workflows
    system: systemPrompt || undefined,
    messages: anthropicMessages,
  };

  // If we are replaying a tool-use assistant turn, we can only keep thinking enabled
  // if the signed thinking block was provided (Anthropic requires it before tool_use).
  const canEnableThinking =
    !!thinkingEnabled && (!(toolExecutions && toolExecutions.length > 0) || !!replayThinkingBlockForToolTurn);

  if (canEnableThinking) {
    const maxTokens = requestOptions.max_tokens;
    if (maxTokens > 1024) {
      const rawBudget = Number.isFinite(thinkingBudgetTokens) ? Math.floor(thinkingBudgetTokens as number) : 1024;
      const budget = Math.max(1024, Math.min(rawBudget, maxTokens - 1));

      requestOptions.thinking = {
        type: 'enabled',
        budget_tokens: budget,
      };
    }
  }

  // Build tools array based on enabled features
  // Don't include tools that have already been executed in this turn to prevent infinite loops
  const tools: Anthropic.Tool[] = [];
  if (webSearchEnabled && !searchResults && !hasToolBeenExecuted('web_search', toolExecutions)) {
    tools.push(anthropicWebSearchTool);
  }
  if (googleDriveEnabled && !driveSearchResults && !hasToolBeenExecuted('google_drive_search', toolExecutions)) {
    tools.push(anthropicGoogleDriveTool);
  }
  // Add MCP tools
  if (mcpTools && mcpTools.length > 0) {
    tools.push(...toAnthropicTools(mcpTools));
  }
  if (tools.length > 0) {
    requestOptions.tools = tools;
  }

  const stream = await client.messages.stream(requestOptions);

  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let reasoningTokens = 0;
  let currentToolName = '';
  let currentToolId = '';
  let currentToolInput = '';
  let currentThinkingSignature = '';

  for await (const event of stream) {
    if (event.type === 'message_start') {
      currentThinkingSignature = '';
    }

    if (event.type === 'content_block_start') {
      if (event.content_block.type === 'thinking') {
        currentThinkingSignature = event.content_block.signature;
      } else if (event.content_block.type === 'tool_use') {
        currentToolName = event.content_block.name;
        currentToolId = event.content_block.id;
        currentToolInput = '';
      }
    }

    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        yield { type: 'content', content: event.delta.text };
      } else if (event.delta.type === 'thinking_delta') {
        yield { type: 'reasoning', reasoning: event.delta.thinking };
      } else if (event.delta.type === 'input_json_delta') {
        currentToolInput += event.delta.partial_json;
      }
    }

    if (event.type === 'content_block_stop' && currentToolName) {
      try {
        const args = JSON.parse(currentToolInput);

        // Parse tool name to determine source
        const parsed = parseToolName(currentToolName);

        if (parsed.source === 'mcp') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: parsed.name,
            originalToolName: currentToolName, // Keep prefixed name for Anthropic API
            toolParams: args,
            toolSource: 'mcp',
            toolServerId: parsed.serverId,
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        } else if (parsed.source === 'builtin') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: parsed.name,
            originalToolName: currentToolName, // Keep prefixed name for Anthropic API
            toolParams: args,
            toolSource: 'builtin',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        } else if (currentToolName === 'web_search') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: currentToolName,
            originalToolName: currentToolName,
            toolParams: { query: args.query },
            toolSource: 'web_search',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        } else if (currentToolName === 'google_drive_search') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: currentToolName,
            originalToolName: currentToolName,
            toolParams: { query: args.query },
            toolSource: 'google_drive',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        }
      } catch {
        // Invalid tool call arguments
      }
      currentToolName = '';
      currentToolId = '';
      currentToolInput = '';
    }

    // Anthropic sends usage in message_start and message_delta events
    if (event.type === 'message_start' && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
      // Check for cache_read_input_tokens (prompt caching) and thinking_tokens (extended thinking)
      const usage = event.message.usage as {
        input_tokens: number;
        cache_read_input_tokens?: number;
        thinking_tokens?: number;
      };
      cachedTokens = usage.cache_read_input_tokens || 0;
      // Thinking tokens may be reported in message_start or message_delta
      reasoningTokens = usage.thinking_tokens || 0;
    }
    if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens;
      // Check for additional thinking tokens in message_delta
      const usage = event.usage as {
        output_tokens: number;
        thinking_tokens?: number;
      };
      if (usage.thinking_tokens) {
        reasoningTokens = usage.thinking_tokens;
      }
    }
  }

  // Send final usage
  yield {
    type: 'usage',
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cachedTokens: cachedTokens > 0 ? cachedTokens : undefined,
      reasoningTokens: reasoningTokens > 0 ? reasoningTokens : undefined,
    },
  };
}
