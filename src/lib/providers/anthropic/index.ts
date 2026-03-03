/**
 * Anthropic provider implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, StreamChunk, ToolExecutionResult } from '../types';
import { UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';
import { toolCallLimitReached } from '../base';
import { toAnthropicTools, parseToolName } from '@/lib/mcp/tool-converter';
import { anthropicWebSearchTool, anthropicGoogleDriveTool, anthropicMemorySearchTool, anthropicRAGSearchTool, anthropicAskQuestionTool, anthropicCreateArtifactTool, anthropicUpdateArtifactTool, anthropicReadArtifactTool } from '../tools/definitions';
import { isArtifactTool } from '../base';
import { toAnthropicContent } from './content';

const ANTHROPIC_EPHEMERAL_CACHE_CONTROL: Anthropic.CacheControlEphemeral = { type: 'ephemeral' };

interface AnthropicUsageSnapshot {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  thinking_tokens?: number | null;
}

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
  memorySearchEnabled?: boolean,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[],
  thinkingEnabled?: boolean,
  thinkingBudgetTokens?: number,
  ragEnabled?: boolean,
  artifactsEnabled?: boolean,
  temperature?: number,
  maxOutputTokens?: number
): AsyncGenerator<StreamChunk> {
  if (!apiKey) throw new Error('Anthropic API key is required');

  const client = new Anthropic({
    apiKey,
    defaultHeaders: {
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
  });

  const lastUserMessageIndex = messages.reduce(
    (lastIndex, msg, index) => (msg.role === 'user' ? index : lastIndex),
    -1
  );

  // System prompt only - search results are now handled as proper tool results
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg, index) => {
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
    return {
      role: 'user',
      content: toAnthropicContent(msg, { cacheBreakpoint: index === lastUserMessageIndex }),
    };
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
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = toolExecutions.map((te, index) => ({
      type: 'tool_result' as const,
      tool_use_id: te.toolCallId,
      content: te.result,
      is_error: te.isError,
      cache_control: index === toolExecutions.length - 1 ? ANTHROPIC_EPHEMERAL_CACHE_CONTROL : undefined,
    }));

    anthropicMessages.push({
      role: 'user',
      content: toolResultBlocks,
    });
  }

  // Create request options
  const requestOptions: Anthropic.MessageStreamParams = {
    model,
    max_tokens: maxOutputTokens || 8192, // Increased for complex tool use workflows
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

  // Anthropic temperature range is 0-1.
  // When extended thinking is enabled, temperature MUST NOT be set (API rejects it).
  if (temperature !== undefined && !requestOptions.thinking) {
    requestOptions.temperature = Math.min(Math.max(temperature, 0), 1);
  }

  // Build tools array based on enabled features
  // Per-tool call limit prevents loops while allowing multiple calls with different queries
  const tools: Anthropic.Tool[] = [];
  if (webSearchEnabled && !searchResults && !toolCallLimitReached('web_search', toolExecutions)) {
    tools.push(anthropicWebSearchTool);
  }
  if (googleDriveEnabled && !driveSearchResults && !toolCallLimitReached('google_drive_search', toolExecutions)) {
    tools.push(anthropicGoogleDriveTool);
  }
  if (memorySearchEnabled && !toolCallLimitReached('memory_search', toolExecutions)) {
    tools.push(anthropicMemorySearchTool);
  }
  if (ragEnabled && !toolCallLimitReached('rag_search', toolExecutions)) {
    tools.push(anthropicRAGSearchTool);
  }
  if (!toolCallLimitReached('ask_question', toolExecutions)) {
    tools.push(anthropicAskQuestionTool);
  }
  // Add MCP/builtin tools (with per-tool call limit to prevent loops)
  if (mcpTools && mcpTools.length > 0) {
    const filteredMcpTools = mcpTools.filter(t => !toolCallLimitReached(t.name, toolExecutions));
    if (filteredMcpTools.length > 0) {
      tools.push(...toAnthropicTools(filteredMcpTools));
    }
  }
  // Artifact tools (enabled by default, can be toggled off)
  if (artifactsEnabled !== false) {
    tools.push(anthropicCreateArtifactTool, anthropicUpdateArtifactTool, anthropicReadArtifactTool);
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

  const applyUsageSnapshot = (usage: AnthropicUsageSnapshot | undefined) => {
    if (!usage) return;

    const inputTokensUsed =
      typeof usage.input_tokens === 'number' && Number.isFinite(usage.input_tokens)
        ? usage.input_tokens
        : undefined;
    const cacheReadInputTokens =
      typeof usage.cache_read_input_tokens === 'number' && Number.isFinite(usage.cache_read_input_tokens)
        ? usage.cache_read_input_tokens
        : undefined;
    const cacheCreationInputTokens =
      typeof usage.cache_creation_input_tokens === 'number' && Number.isFinite(usage.cache_creation_input_tokens)
        ? usage.cache_creation_input_tokens
        : undefined;
    const outputTokensUsed =
      typeof usage.output_tokens === 'number' && Number.isFinite(usage.output_tokens)
        ? usage.output_tokens
        : undefined;
    const thinkingTokens =
      typeof usage.thinking_tokens === 'number' && Number.isFinite(usage.thinking_tokens)
        ? usage.thinking_tokens
        : undefined;

    // Anthropic reports cached token buckets separately from input_tokens.
    // For UI consistency across providers, normalize input as full input total.
    if (
      inputTokensUsed !== undefined ||
      cacheReadInputTokens !== undefined ||
      cacheCreationInputTokens !== undefined
    ) {
      inputTokens = (inputTokensUsed ?? 0) + (cacheReadInputTokens ?? 0) + (cacheCreationInputTokens ?? 0);
    }
    if (cacheReadInputTokens !== undefined) {
      cachedTokens = cacheReadInputTokens;
    }
    if (outputTokensUsed !== undefined) {
      outputTokens = outputTokensUsed;
    }
    if (thinkingTokens !== undefined) {
      reasoningTokens = thinkingTokens;
    }
  };

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
        // Default to empty object for tools with no required parameters (e.g. get_db_schema)
        const args = currentToolInput.trim() ? JSON.parse(currentToolInput) : {};

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
        } else if (currentToolName === 'memory_search') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: currentToolName,
            originalToolName: currentToolName,
            toolParams: { query: args.query },
            toolSource: 'memory_search',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        } else if (currentToolName === 'rag_search') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: currentToolName,
            originalToolName: currentToolName,
            toolParams: { query: args.query },
            toolSource: 'rag_search',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        } else if (currentToolName === 'ask_question') {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: currentToolName,
            originalToolName: currentToolName,
            toolParams: args,
            toolSource: 'ask_question',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        } else if (isArtifactTool(currentToolName)) {
          yield {
            type: 'tool_call',
            toolCallId: currentToolId,
            toolName: currentToolName,
            originalToolName: currentToolName,
            toolParams: args,
            toolSource: 'artifact',
            toolThinkingSignature: currentThinkingSignature || undefined,
          };
        }
      } catch {
        // Invalid tool call arguments - warn instead of silently dropping
        console.warn(
          `[Anthropic] Failed to parse tool call arguments for "${currentToolName}":`,
          currentToolInput.slice(0, 200)
        );
      }
      currentToolName = '';
      currentToolId = '';
      currentToolInput = '';
    }

    // Anthropic sends usage in message_start and message_delta events
    if (event.type === 'message_start' && event.message.usage) {
      applyUsageSnapshot(event.message.usage as AnthropicUsageSnapshot);
    }
    if (event.type === 'message_delta' && event.usage) {
      applyUsageSnapshot(event.usage as AnthropicUsageSnapshot);
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
