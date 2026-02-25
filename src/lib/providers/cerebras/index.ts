/**
 * Cerebras AI provider implementation
 *
 * Uses the OpenAI SDK with a custom base URL since Cerebras's API
 * is OpenAI-compatible (same chat completions endpoint format).
 */

import OpenAI from 'openai';
import { ChatMessage, StreamChunk, ToolCallInfo, ToolExecutionResult } from '../types';
import { UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';
import { toolCallLimitReached } from '../base';
import { toOpenAITools, parseToolName } from '@/lib/mcp/tool-converter';
import { openAIWebSearchTool, openAIGoogleDriveTool, openAIMemorySearchTool, openAIRAGSearchTool, openAICreateArtifactTool, openAIUpdateArtifactTool, openAIReadArtifactTool } from '../tools/definitions';
import { isArtifactTool } from '../base';
import { toCerebrasContent } from './content';

const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1';

/**
 * Stream chat using Cerebras AI Chat Completions API
 */
export async function* streamCerebras(
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
  ragEnabled?: boolean,
  artifactsEnabled?: boolean,
  temperature?: number,
  maxOutputTokens?: number
): AsyncGenerator<StreamChunk> {
  if (!apiKey) throw new Error('Cerebras API key is required');

  const client = new OpenAI({ apiKey, baseURL: CEREBRAS_BASE_URL });

  const allMessages: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    const content = toCerebrasContent(msg);
    if (msg.role === 'user') {
      allMessages.push({ role: 'user', content });
    } else {
      allMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Add tool execution results following OpenAI's tool use protocol
  if (toolExecutions && toolExecutions.length > 0) {
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

    for (const te of toolExecutions) {
      allMessages.push({
        role: 'tool',
        tool_call_id: te.toolCallId,
        content: te.result,
      });
    }
  }

  const requestOptions: OpenAI.ChatCompletionCreateParamsStreaming = {
    model,
    messages: allMessages,
    stream: true,
  };

  if (temperature !== undefined) {
    requestOptions.temperature = temperature;
  }
  if (maxOutputTokens !== undefined) {
    requestOptions.max_tokens = maxOutputTokens;
  }

  // Build tools array based on enabled features
  const tools: OpenAI.ChatCompletionTool[] = [];
  if (webSearchEnabled && !searchResults && !toolCallLimitReached('web_search', toolExecutions)) {
    tools.push(openAIWebSearchTool);
  }
  if (googleDriveEnabled && !driveSearchResults && !toolCallLimitReached('google_drive_search', toolExecutions)) {
    tools.push(openAIGoogleDriveTool);
  }
  if (memorySearchEnabled && !toolCallLimitReached('memory_search', toolExecutions)) {
    tools.push(openAIMemorySearchTool);
  }
  if (ragEnabled && !toolCallLimitReached('rag_search', toolExecutions)) {
    tools.push(openAIRAGSearchTool);
  }
  // Add MCP/builtin tools (with per-tool call limit to prevent loops)
  if (mcpTools && mcpTools.length > 0) {
    const filteredMcpTools = mcpTools.filter(t => !toolCallLimitReached(t.name, toolExecutions));
    if (filteredMcpTools.length > 0) {
      tools.push(...toOpenAITools(filteredMcpTools));
    }
  }
  // Artifact tools (enabled by default, can be toggled off)
  if (artifactsEnabled !== false) {
    tools.push(openAICreateArtifactTool, openAIUpdateArtifactTool, openAIReadArtifactTool);
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

    // Handle tool calls
    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index;

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

    // Check for finish reason
    const finishReason = chunk.choices[0]?.finish_reason;
    if (finishReason === 'tool_calls') {
      const parsedToolCalls: ToolCallInfo[] = [];

      for (const [, tc] of toolCalls) {
        try {
          const args = tc.args.trim() ? JSON.parse(tc.args) : {};
          const parsed = parseToolName(tc.name);

          if (parsed.source === 'mcp') {
            parsedToolCalls.push({
              id: tc.id,
              name: parsed.name,
              originalName: tc.name,
              params: args,
              source: 'mcp',
              serverId: parsed.serverId,
            });
          } else if (parsed.source === 'builtin') {
            parsedToolCalls.push({
              id: tc.id,
              name: parsed.name,
              originalName: tc.name,
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
          } else if (tc.name === 'memory_search') {
            parsedToolCalls.push({
              id: tc.id,
              name: tc.name,
              originalName: tc.name,
              params: { query: args.query },
              source: 'memory_search',
            });
          } else if (tc.name === 'rag_search') {
            parsedToolCalls.push({
              id: tc.id,
              name: tc.name,
              originalName: tc.name,
              params: { query: args.query },
              source: 'rag_search',
            });
          } else if (isArtifactTool(tc.name)) {
            parsedToolCalls.push({
              id: tc.id,
              name: tc.name,
              originalName: tc.name,
              params: args,
              source: 'artifact',
            });
          }
        } catch {
          console.warn(
            `[Cerebras] Failed to parse tool call arguments for "${tc.name}":`,
            tc.args.slice(0, 200)
          );
        }
      }

      if (parsedToolCalls.length === 1) {
        yield {
          type: 'tool_call',
          toolCallId: parsedToolCalls[0].id,
          toolName: parsedToolCalls[0].name,
          originalToolName: parsedToolCalls[0].originalName,
          toolParams: parsedToolCalls[0].params,
          toolSource: parsedToolCalls[0].source,
          toolServerId: parsedToolCalls[0].serverId,
        };
      } else if (parsedToolCalls.length > 1) {
        yield {
          type: 'tool_calls',
          toolCalls: parsedToolCalls,
        };
      }
    }

    // Cerebras may include usage in the final chunk
    if (chunk.usage) {
      const usageAny = chunk.usage as unknown as Record<string, unknown>;
      const completionDetails = usageAny.completion_tokens_details as Record<string, number> | undefined;
      const reasoningTokens = completionDetails?.reasoning_tokens;

      yield {
        type: 'usage',
        usage: {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
          reasoningTokens,
        },
      };
    }
  }
}
