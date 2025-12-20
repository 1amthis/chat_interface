/**
 * OpenAI provider implementation
 */

import OpenAI from 'openai';
import { ChatMessage, StreamChunk, ToolCallInfo, ToolExecutionResult } from '../types';
import { UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse, ToolSource } from '@/types';
import { toOpenAITools, parseToolName } from '@/lib/mcp/tool-converter';
import { hasToolBeenExecuted } from '../base';
import { openAIWebSearchTool, openAIGoogleDriveTool, toResponsesAPIWebSearchTool, toResponsesAPIGoogleDriveTool } from '../tools/definitions';
import { toOpenAIContent } from './content';

/**
 * Stream chat using OpenAI Chat Completions API
 */
export async function* streamOpenAI(
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
  systemPrompt?: string,
  webSearchEnabled?: boolean,
  searchResults?: WebSearchResponse,
  googleDriveEnabled?: boolean,
  driveSearchResults?: GoogleDriveSearchResponse,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[]
): AsyncGenerator<StreamChunk> {
  if (!apiKey) throw new Error('OpenAI API key is required');

  const client = new OpenAI({ apiKey });

  const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

  // System prompt only - search results are now handled as proper tool results
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    const content = toOpenAIContent(msg);
    if (msg.role === 'user') {
      allMessages.push({ role: 'user', content });
    } else {
      // Assistant messages are always text-only
      allMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // If there are tool executions, add them as proper tool call/result messages
  // This follows OpenAI's tool use protocol
  if (toolExecutions && toolExecutions.length > 0) {
    // Add assistant message with tool_calls
    // Use originalToolName (prefixed) when available to match registered tool names
    const toolCallsForAssistant: OpenAI.ChatCompletionMessageToolCall[] = toolExecutions.map(te => ({
      id: te.toolCallId,
      type: 'function' as const,
      function: {
        name: te.originalToolName || te.toolName,
        arguments: JSON.stringify(te.toolParams),
      },
    }));

    allMessages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCallsForAssistant,
    });

    // Add tool result messages for each execution
    for (const te of toolExecutions) {
      allMessages.push({
        role: 'tool',
        tool_call_id: te.toolCallId,
        content: te.result,
      });
    }
  }

  // Check if this is a reasoning model (o1, o3, o4-mini, etc.)
  const isReasoningModel = /^o[134]/.test(model) || model.includes('o1-') || model.includes('o3-') || model.includes('o4-');

  // Create request with optional tools
  const requestOptions: OpenAI.ChatCompletionCreateParamsStreaming = {
    model,
    messages: allMessages,
    stream: true,
    stream_options: { include_usage: true },
  };

  // For reasoning models (o-series), use max_completion_tokens instead of max_tokens
  // Note: Reasoning summaries require the Responses API, not Chat Completions API
  // The Chat Completions API does not expose reasoning content for o-series models
  if (isReasoningModel) {
    const reqAny = requestOptions as unknown as Record<string, unknown>;
    reqAny.max_completion_tokens = 16384;
  }

  // Build tools array based on enabled features
  // Don't include tools that have already been executed in this turn to prevent infinite loops
  const tools: OpenAI.ChatCompletionTool[] = [];
  if (webSearchEnabled && !searchResults && !hasToolBeenExecuted('web_search', toolExecutions)) {
    tools.push(openAIWebSearchTool);
  }
  if (googleDriveEnabled && !driveSearchResults && !hasToolBeenExecuted('google_drive_search', toolExecutions)) {
    tools.push(openAIGoogleDriveTool);
  }
  // Add MCP tools
  if (mcpTools && mcpTools.length > 0) {
    tools.push(...toOpenAITools(mcpTools));
  }
  if (tools.length > 0) {
    requestOptions.tools = tools;
    requestOptions.tool_choice = 'auto';
  }

  const stream = await client.chat.completions.create(requestOptions);

  // Track multiple parallel tool calls by index
  const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    // Handle tool calls - OpenAI sends them with an index for parallel calls
    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index;

        // Initialize or get existing tool call data
        if (!toolCalls.has(index)) {
          toolCalls.set(index, { id: '', name: '', args: '' });
        }
        const tc = toolCalls.get(index)!;

        if (toolCall.id) {
          tc.id = toolCall.id;
        }
        if (toolCall.function?.name) {
          tc.name = toolCall.function.name;
        }
        if (toolCall.function?.arguments) {
          tc.args += toolCall.function.arguments;
        }
      }
    }

    const content = delta?.content;
    if (content) {
      yield { type: 'content', content };
    }

    // Note: Chat Completions API does not return reasoning summaries for o-series models
    // Use the Responses API (streamOpenAIResponses) to get reasoning summaries

    // Check for finish reason
    const finishReason = chunk.choices[0]?.finish_reason;
    if (finishReason === 'tool_calls') {
      // Parse and yield all tool calls
      const parsedToolCalls: ToolCallInfo[] = [];

      for (const [, tc] of toolCalls) {
        try {
          const args = JSON.parse(tc.args);

          // Parse tool name to determine source
          const parsed = parseToolName(tc.name);

          if (parsed.source === 'mcp') {
            parsedToolCalls.push({
              id: tc.id,
              name: parsed.name,
              originalName: tc.name, // Keep prefixed name for API
              params: args,
              source: 'mcp',
              serverId: parsed.serverId,
            });
          } else if (parsed.source === 'builtin') {
            parsedToolCalls.push({
              id: tc.id,
              name: parsed.name,
              originalName: tc.name, // Keep prefixed name for API
              params: args,
              source: 'builtin',
            });
          } else if (tc.name === 'web_search') {
            parsedToolCalls.push({
              id: tc.id,
              name: tc.name,
              originalName: tc.name,
              params: { query: args.query },
              source: 'web_search',
            });
          } else if (tc.name === 'google_drive_search') {
            parsedToolCalls.push({
              id: tc.id,
              name: tc.name,
              originalName: tc.name,
              params: { query: args.query },
              source: 'google_drive',
            });
          }
        } catch {
          // Invalid tool call arguments, skip this one
        }
      }

      if (parsedToolCalls.length === 1) {
        // Single tool call - use existing format for backwards compatibility
        yield {
          type: 'tool_call',
          toolName: parsedToolCalls[0].name,
          originalToolName: parsedToolCalls[0].originalName, // Keep prefixed name for API
          toolParams: parsedToolCalls[0].params,
          toolSource: parsedToolCalls[0].source,
          toolServerId: parsedToolCalls[0].serverId,
        };
      } else if (parsedToolCalls.length > 1) {
        // Multiple tool calls - use new format
        yield {
          type: 'tool_calls',
          toolCalls: parsedToolCalls,
        };
      }
    }

    // OpenAI sends usage in the final chunk
    if (chunk.usage) {
      // Extract reasoning tokens if available (o-series models)
      const usageAny = chunk.usage as unknown as Record<string, unknown>;
      const completionDetails = usageAny.completion_tokens_details as Record<string, number> | undefined;
      const reasoningTokens = completionDetails?.reasoning_tokens;

      yield {
        type: 'usage',
        usage: {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
          cachedTokens: chunk.usage.prompt_tokens_details?.cached_tokens,
          reasoningTokens,
        },
      };
    }
  }
}

// Convert tools to Responses API format
function toResponsesAPITools(
  webSearchEnabled?: boolean,
  googleDriveEnabled?: boolean,
  mcpTools?: UnifiedTool[]
): Record<string, unknown>[] {
  const tools: Record<string, unknown>[] = [];

  // Add web search as a function tool
  if (webSearchEnabled) {
    tools.push(toResponsesAPIWebSearchTool());
  }

  // Add Google Drive search as a function tool
  if (googleDriveEnabled) {
    tools.push(toResponsesAPIGoogleDriveTool());
  }

  // Add MCP tools
  if (mcpTools && mcpTools.length > 0) {
    for (const tool of mcpTools) {
      // Create a namespaced tool name for MCP tools
      const toolName = tool.serverId ? `mcp_${tool.serverId}_${tool.name}` : `mcp_${tool.name}`;
      tools.push({
        type: 'function',
        name: toolName,
        description: tool.description,
        parameters: tool.parameters,
      });
    }
  }

  return tools;
}

/**
 * Stream using OpenAI Responses API (for reasoning models with reasoning summaries)
 */
export async function* streamOpenAIResponses(
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
  systemPrompt?: string,
  webSearchEnabled?: boolean,
  searchResults?: WebSearchResponse,
  googleDriveEnabled?: boolean,
  driveSearchResults?: GoogleDriveSearchResponse,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[]
): AsyncGenerator<StreamChunk> {
  if (!apiKey) throw new Error('OpenAI API key is required');

  const client = new OpenAI({ apiKey });

  // Build input from messages - Responses API uses a different format
  // Convert chat messages to a conversation format
  const inputParts: string[] = [];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    let content = msg.content;

    // Handle file attachments
    const attachments = msg.attachments || [];
    const projectFiles = msg.projectFiles || [];
    const allAttachments = [...projectFiles, ...attachments];
    const fileAttachments = allAttachments.filter((a) => a.type === 'file');

    for (const file of fileAttachments) {
      try {
        const textContent = atob(file.data);
        content += `\n\n[File: ${file.name}]\n${textContent}`;
      } catch {
        content += `\n\n[File: ${file.name}] (Unable to decode content)`;
      }
    }

    inputParts.push(`${role}: ${content}`);
  }

  // Add tool execution results to the input if present
  if (toolExecutions && toolExecutions.length > 0) {
    for (const te of toolExecutions) {
      inputParts.push(`[Tool Result for ${te.toolName}]: ${te.result}`);
    }
  }

  // Build the request options
  const requestOptions: Record<string, unknown> = {
    model,
    input: inputParts.join('\n\n'),
    stream: true,
    reasoning: {
      effort: 'medium',
      summary: 'auto',
    },
    max_output_tokens: 16384,
  };

  // Add system prompt as instructions
  if (systemPrompt) {
    requestOptions.instructions = systemPrompt;
  }

  // Add tools if enabled (and we don't already have results or tool executions)
  // Don't include tools that have already been executed in this turn to prevent infinite loops
  const tools = toResponsesAPITools(
    webSearchEnabled && !searchResults && !hasToolBeenExecuted('web_search', toolExecutions),
    googleDriveEnabled && !driveSearchResults && !hasToolBeenExecuted('google_drive_search', toolExecutions),
    mcpTools
  );
  if (tools.length > 0) {
    requestOptions.tools = tools;
    requestOptions.tool_choice = 'auto';
  }

  // Use the responses API
  const responsesClient = client.responses as unknown as {
    create(options: Record<string, unknown>): Promise<AsyncIterable<Record<string, unknown>>>;
  };

  const stream = await responsesClient.create(requestOptions);

  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let sawReasoningSummaryDelta = false;
  let sawReasoningTextDelta = false;

  // Track function calls being built
  const functionCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  for await (const event of stream) {
    const eventType = event.type as string;

    // Handle text content delta
    if (eventType === 'response.output_text.delta') {
      const delta = event.delta as string;
      if (delta) {
        yield { type: 'content', content: delta };
      }
    }

    // Handle reasoning summary delta
    if (eventType === 'response.reasoning_summary_text.delta') {
      const delta = event.delta as string;
      if (delta) {
        sawReasoningSummaryDelta = true;
        yield { type: 'reasoning', reasoning: delta };
      }
    }

    // Handle reasoning summary done (some models may only emit the final text)
    if (eventType === 'response.reasoning_summary_text.done' && !sawReasoningSummaryDelta) {
      const text = (event.text as string) || '';
      if (text) {
        yield { type: 'reasoning', reasoning: text };
      }
    }

    // Handle reasoning text delta (fallback when summary deltas are not emitted)
    if (eventType === 'response.reasoning_text.delta' && !sawReasoningSummaryDelta) {
      const delta = event.delta as string;
      if (delta) {
        sawReasoningTextDelta = true;
        yield { type: 'reasoning', reasoning: delta };
      }
    }

    // Handle reasoning text done (fallback when no deltas were emitted)
    if (eventType === 'response.reasoning_text.done' && !sawReasoningSummaryDelta && !sawReasoningTextDelta) {
      const text = (event.text as string) || '';
      if (text) {
        yield { type: 'reasoning', reasoning: text };
      }
    }

    // Handle new output item (including function calls)
    if (eventType === 'response.output_item.added') {
      const item = event.item as Record<string, unknown>;
      const outputIndex = event.output_index as number;

      if (item.type === 'function_call') {
        functionCalls.set(outputIndex, {
          id: (item.call_id as string) || `call_${outputIndex}`,
          name: item.name as string,
          arguments: '',
        });
      }
    }

    // Handle function call arguments delta
    if (eventType === 'response.function_call_arguments.delta') {
      const outputIndex = event.output_index as number;
      const delta = event.delta as string;
      const fc = functionCalls.get(outputIndex);
      if (fc && delta) {
        fc.arguments += delta;
      }
    }

    // Handle function call arguments done
    if (eventType === 'response.function_call_arguments.done') {
      const outputIndex = event.output_index as number;
      const fc = functionCalls.get(outputIndex);

      if (fc) {
        try {
          const args = JSON.parse(fc.arguments || '{}');

          // Determine tool source from name
          let toolName = fc.name;
          let toolSource: ToolSource = 'builtin';
          let toolServerId: string | undefined;

          if (fc.name === 'web_search') {
            toolSource = 'web_search';
          } else if (fc.name === 'google_drive_search') {
            toolSource = 'google_drive';
          } else if (fc.name.startsWith('mcp_')) {
            toolSource = 'mcp';
            // Parse MCP tool name: mcp_serverId_toolName
            const parts = fc.name.split('_');
            if (parts.length >= 3) {
              toolServerId = parts[1];
              toolName = parts.slice(2).join('_');
            }
          }

          yield {
            type: 'tool_call',
            toolName,
            toolParams: args,
            toolSource,
            toolServerId,
          };
        } catch {
          // Invalid JSON arguments, skip
        }
      }
    }

    // Handle completion with usage info
    if (eventType === 'response.completed') {
      const response = event.response as Record<string, unknown>;
      const usage = response?.usage as Record<string, number> | undefined;

      if (usage) {
        inputTokens = usage.input_tokens || 0;
        outputTokens = usage.output_tokens || 0;
        reasoningTokens = usage.reasoning_tokens || 0;
      }
    }
  }

  // Yield final usage
  yield {
    type: 'usage',
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      reasoningTokens: reasoningTokens > 0 ? reasoningTokens : undefined,
    },
  };
}
