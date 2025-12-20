import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ChatSettings, Attachment, TokenUsage, WebSearchResponse, GoogleDriveSearchResponse, UnifiedTool, ToolSource, ContentBlock } from '@/types';
import { toOpenAITools, toAnthropicTools, toGeminiTools, parseToolName } from './mcp/tool-converter';

/**
 * Merge system prompts: global + project + conversation
 * Returns merged prompt with proper formatting
 */
export function mergeSystemPrompts(
  globalPrompt?: string,
  projectInstructions?: string,
  conversationPrompt?: string
): string | undefined {
  const parts: string[] = [];

  if (globalPrompt?.trim()) {
    parts.push(globalPrompt.trim());
  }

  if (projectInstructions?.trim()) {
    parts.push(projectInstructions.trim());
  }

  if (conversationPrompt?.trim()) {
    parts.push(conversationPrompt.trim());
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  contentBlocks?: ContentBlock[]; // Ordered content blocks with interleaved tool calls/reasoning
  attachments?: Attachment[];
  projectFiles?: Attachment[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  // Original tool name as sent by the API (may include prefixes)
  originalName?: string;
  params: Record<string, unknown>;
  source?: ToolSource;
  serverId?: string;
}

// Represents a completed tool execution (call + result)
export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  // Original tool name as sent by the API (may include prefixes like mcp_serverId_)
  // Required for Anthropic to match tool_use blocks on follow-up turns
  originalToolName?: string;
  toolParams: Record<string, unknown>;
  result: string;
  isError: boolean;
  // Anthropic extended thinking requires replaying the signed thinking block
  // before tool_use blocks on follow-up turns.
  anthropicThinkingSignature?: string;
  anthropicThinking?: string;
}

export interface StreamChunk {
  type: 'content' | 'reasoning' | 'usage' | 'tool_call' | 'tool_calls' | 'tool_result' | 'search_status';
  content?: string;
  reasoning?: string;
  usage?: TokenUsage;
  toolCallId?: string;
  toolName?: string;
  // Original tool name as sent by the API (may include prefixes)
  originalToolName?: string;
  toolParams?: Record<string, unknown>;
  toolSource?: ToolSource;
  toolServerId?: string;
  toolThinkingSignature?: string;
  toolCalls?: ToolCallInfo[];  // For multiple parallel tool calls
  toolResult?: WebSearchResponse;
  status?: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  settings: ChatSettings;
  systemPrompt?: string;
  webSearchEnabled?: boolean;
  searchResults?: WebSearchResponse;
  googleDriveEnabled?: boolean;
  driveSearchResults?: GoogleDriveSearchResponse;
  mcpTools?: UnifiedTool[];
  toolExecutions?: ToolExecutionResult[];  // Completed tool calls with results
}

// Helper to check if a model should use the OpenAI Responses API for reasoning summaries
function isOpenAIReasoningModel(model: string): boolean {
  return /^gpt-5(\b|[.-])/.test(model) || /^o[134]/.test(model) || model.includes('o1-') || model.includes('o3-') || model.includes('o4-');
}

export async function* streamChat(
  messages: ChatMessage[],
  settings: ChatSettings,
  systemPrompt?: string,
  webSearchEnabled?: boolean,
  searchResults?: WebSearchResponse,
  googleDriveEnabled?: boolean,
  driveSearchResults?: GoogleDriveSearchResponse,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[]
): AsyncGenerator<StreamChunk> {
  const { provider, model } = settings;

  if (provider === 'openai') {
    // Use Responses API for reasoning-capable models (gpt-5 + o-series) to get reasoning summaries
    if (isOpenAIReasoningModel(model)) {
      yield* streamOpenAIResponses(messages, model, settings.openaiKey, systemPrompt, webSearchEnabled, searchResults, googleDriveEnabled, driveSearchResults, mcpTools, toolExecutions);
    } else {
      yield* streamOpenAI(messages, model, settings.openaiKey, systemPrompt, webSearchEnabled, searchResults, googleDriveEnabled, driveSearchResults, mcpTools, toolExecutions);
    }
  } else if (provider === 'anthropic') {
    yield* streamAnthropic(
      messages,
      model,
      settings.anthropicKey,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      mcpTools,
      toolExecutions,
      settings.anthropicThinkingEnabled,
      settings.anthropicThinkingBudgetTokens
    );
  } else if (provider === 'google') {
    yield* streamGoogle(
      messages,
      model,
      settings.googleKey,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      mcpTools,
      toolExecutions
    );
  } else if (provider === 'ollama') {
    yield* streamOllama(messages, model, settings.ollamaUrl, systemPrompt, searchResults, driveSearchResults, mcpTools, toolExecutions);
  }
}

// Web search tool definition for OpenAI
const openAIWebSearchTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information. Use this when you need up-to-date information, facts you are not certain about, or when the user asks about recent events, news, or anything that might have changed after your knowledge cutoff.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up on the web',
        },
      },
      required: ['query'],
    },
  },
};

// Web search tool definition for Anthropic
const anthropicWebSearchTool: Anthropic.Tool = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date information, facts you are not certain about, or when the user asks about recent events, news, or anything that might have changed after your knowledge cutoff.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web',
      },
    },
    required: ['query'],
  },
};

// Google Drive search tool definition for OpenAI
const openAIGoogleDriveTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'google_drive_search',
    description: 'Search files in the user\'s Google Drive. Use this when the user asks about their documents, files, spreadsheets, presentations, or any content stored in their Google Drive. This searches file names and content.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find files in Google Drive',
        },
      },
      required: ['query'],
    },
  },
};

// Google Drive search tool definition for Anthropic
const anthropicGoogleDriveTool: Anthropic.Tool = {
  name: 'google_drive_search',
  description: 'Search files in the user\'s Google Drive. Use this when the user asks about their documents, files, spreadsheets, presentations, or any content stored in their Google Drive. This searches file names and content.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find files in Google Drive',
      },
    },
    required: ['query'],
  },
};

// Web search tool definition for Gemini
const geminiWebSearchDeclaration = {
  name: 'web_search',
  description:
    'Search the web for current information. Use this when you need up-to-date information, facts you are not certain about, or when the user asks about recent events, news, or anything that might have changed after your knowledge cutoff.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web',
      },
    },
    required: ['query'],
  },
};

// Google Drive search tool definition for Gemini
const geminiGoogleDriveDeclaration = {
  name: 'google_drive_search',
  description:
    "Search files in the user's Google Drive. Use this when the user asks about their documents, files, spreadsheets, presentations, or any content stored in their Google Drive.",
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find files in Google Drive',
      },
    },
    required: ['query'],
  },
};

// Convert message to OpenAI format with multimodal support
function toOpenAIContent(message: ChatMessage): OpenAI.ChatCompletionContentPart[] | string {
  const attachments = message.attachments || [];
  const projectFiles = message.projectFiles || [];
  const allAttachments = [...projectFiles, ...attachments];
  const imageAttachments = allAttachments.filter((a) => a.type === 'image');
  const fileAttachments = allAttachments.filter((a) => a.type === 'file');

  // If no attachments, return simple string
  if (allAttachments.length === 0) {
    return message.content;
  }

  const parts: OpenAI.ChatCompletionContentPart[] = [];

  // Add text content if present
  if (message.content) {
    parts.push({ type: 'text', text: message.content });
  }

  // Add file contents as text
  for (const file of fileAttachments) {
    try {
      const textContent = atob(file.data);
      parts.push({
        type: 'text',
        text: `[File: ${file.name}]\n${textContent}`,
      });
    } catch {
      parts.push({
        type: 'text',
        text: `[File: ${file.name}] (Unable to decode content)`,
      });
    }
  }

  // Add images
  for (const image of imageAttachments) {
    parts.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.data}`,
      },
    });
  }

  return parts;
}

async function* streamOpenAI(
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
  const hasWebSearchResult = toolExecutions?.some(te => te.toolName === 'web_search' || te.originalToolName === 'web_search');
  const hasDriveSearchResult = toolExecutions?.some(te => te.toolName === 'google_drive_search' || te.originalToolName === 'google_drive_search');

  const tools: OpenAI.ChatCompletionTool[] = [];
  if (webSearchEnabled && !searchResults && !hasWebSearchResult) {
    tools.push(openAIWebSearchTool);
  }
  if (googleDriveEnabled && !driveSearchResults && !hasDriveSearchResult) {
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
    tools.push({
      type: 'function',
      name: 'web_search',
      description: 'Search the web for current information. Use this when you need up-to-date information, facts you are not certain about, or when the user asks about recent events, news, or anything that might have changed after your knowledge cutoff.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    });
  }

  // Add Google Drive search as a function tool
  if (googleDriveEnabled) {
    tools.push({
      type: 'function',
      name: 'google_drive_search',
      description: 'Search files in the user\'s Google Drive. Use this when the user asks about their documents, files, spreadsheets, presentations, or any content stored in their Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find files in Google Drive',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    });
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

// Stream using OpenAI Responses API (for reasoning models with reasoning summaries)
async function* streamOpenAIResponses(
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
  const hasWebSearchResult = toolExecutions?.some(te => te.toolName === 'web_search' || te.originalToolName === 'web_search');
  const hasDriveSearchResult = toolExecutions?.some(te => te.toolName === 'google_drive_search' || te.originalToolName === 'google_drive_search');

  const tools = toResponsesAPITools(
    webSearchEnabled && !searchResults && !hasWebSearchResult,
    googleDriveEnabled && !driveSearchResults && !hasDriveSearchResult,
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

// Convert message to Anthropic format with multimodal support
function toAnthropicContent(message: ChatMessage): Anthropic.ContentBlockParam[] {
  const attachments = message.attachments || [];
  const projectFiles = message.projectFiles || [];
  const allAttachments = [...projectFiles, ...attachments];
  const imageAttachments = allAttachments.filter((a) => a.type === 'image');
  const fileAttachments = allAttachments.filter((a) => a.type === 'file');

  const parts: Anthropic.ContentBlockParam[] = [];

  // Add images first (Anthropic prefers images before text)
  for (const image of imageAttachments) {
    parts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image.data,
      },
    });
  }

  // Add file contents as text
  for (const file of fileAttachments) {
    try {
      const textContent = atob(file.data);
      parts.push({
        type: 'text',
        text: `[File: ${file.name}]\n${textContent}`,
      });
    } catch {
      parts.push({
        type: 'text',
        text: `[File: ${file.name}] (Unable to decode content)`,
      });
    }
  }

  // Add text content
  if (message.content) {
    parts.push({ type: 'text', text: message.content });
  }

  // If no parts, add empty text
  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' });
  }

  return parts;
}

async function* streamAnthropic(
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
  const hasWebSearchResult = toolExecutions?.some(te => te.toolName === 'web_search' || te.originalToolName === 'web_search');
  const hasDriveSearchResult = toolExecutions?.some(te => te.toolName === 'google_drive_search' || te.originalToolName === 'google_drive_search');

  const tools: Anthropic.Tool[] = [];
  if (webSearchEnabled && !searchResults && !hasWebSearchResult) {
    tools.push(anthropicWebSearchTool);
  }
  if (googleDriveEnabled && !driveSearchResults && !hasDriveSearchResult) {
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

async function* streamOllama(
  messages: ChatMessage[],
  model: string,
  baseUrl: string,
  systemPrompt?: string,
  searchResults?: WebSearchResponse,
  driveSearchResults?: GoogleDriveSearchResponse,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[]
): AsyncGenerator<StreamChunk> {
  // Note: Ollama doesn't have standard tool result format, so we inject tool results
  // into the system prompt as context. This is a limitation of Ollama.
  const allMessages: { role: string; content: string; images?: string[] }[] = [];

  // Build system prompt - for Ollama we inject tool results here since it lacks proper tool support
  let fullSystemPrompt = systemPrompt || '';
  if (toolExecutions && toolExecutions.length > 0) {
    const toolContext = toolExecutions.map(te =>
      `Tool "${te.toolName}" returned:\n${te.result}`
    ).join('\n\n');
    fullSystemPrompt = fullSystemPrompt
      ? `${fullSystemPrompt}\n\n## Tool Results\n\n${toolContext}`
      : `## Tool Results\n\n${toolContext}`;
  }

  if (fullSystemPrompt) {
    allMessages.push({ role: 'system', content: fullSystemPrompt });
  }

  for (const msg of messages) {
    const attachments = msg.attachments || [];
    const imageAttachments = attachments.filter((a) => a.type === 'image');
    const fileAttachments = attachments.filter((a) => a.type === 'file');

    // Build content with file attachments
    let content = msg.content;
    for (const file of fileAttachments) {
      try {
        const textContent = atob(file.data);
        content += `\n\n[File: ${file.name}]\n${textContent}`;
      } catch {
        content += `\n\n[File: ${file.name}] (Unable to decode content)`;
      }
    }

    // Add images array for Ollama (if using vision-capable model)
    const images = imageAttachments.map((img) => img.data);

    allMessages.push({
      role: msg.role,
      content,
      ...(images.length > 0 && { images }),
    });
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let promptEvalCount = 0;
  let evalCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield { type: 'content', content: data.message.content };
        }
        // Ollama sends token counts in the final message
        if (data.done && data.prompt_eval_count !== undefined) {
          promptEvalCount = data.prompt_eval_count || 0;
          evalCount = data.eval_count || 0;
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  // Send final usage if we got token counts
  if (promptEvalCount > 0 || evalCount > 0) {
    yield {
      type: 'usage',
      usage: {
        inputTokens: promptEvalCount,
        outputTokens: evalCount,
        totalTokens: promptEvalCount + evalCount,
      },
    };
  }
}

// Convert message to Gemini parts with multimodal support
function toGeminiParts(message: ChatMessage): Array<Record<string, unknown>> {
  const attachments = message.attachments || [];
  const projectFiles = message.projectFiles || [];
  const allAttachments = [...projectFiles, ...attachments];
  const imageAttachments = allAttachments.filter((a) => a.type === 'image');
  const fileAttachments = allAttachments.filter((a) => a.type === 'file');

  const parts: Array<Record<string, unknown>> = [];

  // Add images first
  for (const image of imageAttachments) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data,
      },
    });
  }

  // Add file contents as text
  for (const file of fileAttachments) {
    try {
      const textContent = atob(file.data);
      parts.push({
        text: `[File: ${file.name}]\n${textContent}`,
      });
    } catch {
      parts.push({
        text: `[File: ${file.name}] (Unable to decode content)`,
      });
    }
  }

  if (message.content) {
    parts.push({ text: message.content });
  }

  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return parts;
}

function generateGeminiToolCallId(): string {
  return `gc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Google Gemini provider implementation (Google AI Studio API)
async function* streamGoogle(
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
  if (!apiKey) throw new Error('Google Gemini API key is required');

  const contents: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content }],
      });
    } else {
      contents.push({
        role: 'user',
        parts: toGeminiParts(msg),
      });
    }
  }

  // If there are tool executions, add them using Gemini's function call/response format
  // Use originalToolName (prefixed) when available to match registered tool names
  if (toolExecutions && toolExecutions.length > 0) {
    contents.push({
      role: 'model',
      parts: toolExecutions.map((te) => ({
        functionCall: {
          name: te.originalToolName || te.toolName,
          args: te.toolParams,
        },
      })),
    });

    contents.push({
      role: 'user',
      parts: toolExecutions.map((te) => ({
        functionResponse: {
          name: te.originalToolName || te.toolName,
          response: {
            content: te.result,
            isError: te.isError,
          },
        },
      })),
    });
  }

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: 4096,
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  // Build tools array based on enabled features and MCP tools
  // Don't include tools that have already been executed in this turn to prevent infinite loops
  const hasWebSearchResult = toolExecutions?.some(te => te.toolName === 'web_search' || te.originalToolName === 'web_search');
  const hasDriveSearchResult = toolExecutions?.some(te => te.toolName === 'google_drive_search' || te.originalToolName === 'google_drive_search');

  const functionDeclarations: Array<Record<string, unknown>> = [];

  if (webSearchEnabled && !searchResults && !hasWebSearchResult) {
    functionDeclarations.push(geminiWebSearchDeclaration);
  }
  if (googleDriveEnabled && !driveSearchResults && !hasDriveSearchResult) {
    functionDeclarations.push(geminiGoogleDriveDeclaration);
  }
  if (mcpTools && mcpTools.length > 0) {
    functionDeclarations.push(...toGeminiTools(mcpTools).functionDeclarations);
  }

  if (functionDeclarations.length > 0) {
    requestBody.tools = [{ functionDeclarations }];
    requestBody.toolConfig = {
      functionCallingConfig: { mode: 'AUTO' },
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google Gemini API error: ${response.status} ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  const handleChunk = (chunkObj: Record<string, unknown>): StreamChunk[] => {
    const emitted: StreamChunk[] = [];

    const usage = chunkObj.usageMetadata as Record<string, number> | undefined;
    if (usage) {
      inputTokens = usage.promptTokenCount || inputTokens;
      outputTokens = usage.candidatesTokenCount || outputTokens;
      totalTokens = usage.totalTokenCount || totalTokens;
    }

    const candidates = (chunkObj.candidates as Array<Record<string, unknown>>) || [];
    for (const candidate of candidates) {
      const content = candidate.content as Record<string, unknown> | undefined;
      const parts = (content?.parts as Array<Record<string, unknown>>) || [];

      const toolCallsInCandidate: ToolCallInfo[] = [];

      for (const part of parts) {
        const text = part.text as string | undefined;
        if (text) {
          emitted.push({ type: 'content', content: text });
        }

        const functionCall = part.functionCall as Record<string, unknown> | undefined;
        if (functionCall && functionCall.name) {
          const rawName = functionCall.name as string;
          let args: unknown = functionCall.args ?? functionCall.arguments ?? {};
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch {
              args = {};
            }
          }

          const parsed = parseToolName(rawName);
          const id = generateGeminiToolCallId();
          const params = (args as Record<string, unknown>) || {};

          if (parsed.source === 'mcp') {
            toolCallsInCandidate.push({
              id,
              name: parsed.name,
              originalName: rawName, // Keep prefixed name for API
              params,
              source: 'mcp',
              serverId: parsed.serverId,
            });
          } else if (parsed.source === 'builtin') {
            toolCallsInCandidate.push({
              id,
              name: parsed.name,
              originalName: rawName, // Keep prefixed name for API
              params,
              source: 'builtin',
            });
          } else if (rawName === 'web_search') {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'web_search',
            });
          } else if (rawName === 'google_drive_search') {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'google_drive',
            });
          } else {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
            });
          }
        }
      }

      if (toolCallsInCandidate.length === 1) {
        const tc = toolCallsInCandidate[0];
        emitted.push({
          type: 'tool_call',
          toolName: tc.name,
          originalToolName: tc.originalName, // Keep prefixed name for API
          toolParams: tc.params,
          toolSource: tc.source,
          toolServerId: tc.serverId,
        });
      } else if (toolCallsInCandidate.length > 1) {
        emitted.push({
          type: 'tool_calls',
          toolCalls: toolCallsInCandidate,
        });
      }
    }

    return emitted;
  };

  const processLine = (dataLine: string) => {
    try {
      const chunkObj = JSON.parse(dataLine) as Record<string, unknown>;
      return handleChunk(chunkObj);
    } catch {
      return [];
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;
      if (line.startsWith('event:')) continue;

      let dataLine = line;
      if (dataLine.startsWith('data:')) {
        dataLine = dataLine.slice(5).trim();
      }
      if (!dataLine || dataLine === '[DONE]') continue;

      for (const emitted of processLine(dataLine)) {
        yield emitted;
      }
    }
  }

  // Flush any remaining buffer
  const remaining = buffer.trim();
  if (remaining) {
    for (const emitted of processLine(remaining)) {
      yield emitted;
    }
  }

  if (inputTokens || outputTokens || totalTokens) {
    yield {
      type: 'usage',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: totalTokens || inputTokens + outputTokens,
      },
    };
  }
}
