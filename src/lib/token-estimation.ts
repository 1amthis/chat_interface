import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ChatMessage, ToolExecutionResult } from '@/lib/providers';
import { toolCallLimitReached } from '@/lib/providers/base';
import {
  anthropicCreateArtifactTool,
  anthropicGoogleDriveTool,
  anthropicMemorySearchTool,
  anthropicRAGSearchTool,
  anthropicReadArtifactTool,
  anthropicUpdateArtifactTool,
  anthropicWebSearchTool,
  geminiCreateArtifactDeclaration,
  geminiGoogleDriveDeclaration,
  geminiMemorySearchDeclaration,
  geminiRAGSearchDeclaration,
  geminiReadArtifactDeclaration,
  geminiUpdateArtifactDeclaration,
  geminiWebSearchDeclaration,
  toResponsesAPICreateArtifactTool,
  toResponsesAPIGoogleDriveTool,
  toResponsesAPIMemorySearchTool,
  toResponsesAPIRAGSearchTool,
  toResponsesAPIReadArtifactTool,
  toResponsesAPIUpdateArtifactTool,
  toResponsesAPIWebSearchTool,
} from '@/lib/providers/tools/definitions';
import { toAnthropicContent } from '@/lib/providers/anthropic/content';
import { toGeminiParts } from '@/lib/providers/google/content';
import { toAnthropicTools, toGeminiTools } from '@/lib/mcp/tool-converter';
import type { ChatSettings, GoogleDriveSearchResponse, Provider, UnifiedTool, WebSearchResponse } from '@/types';

const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1';
const ANTHROPIC_EPHEMERAL_CACHE_CONTROL: Anthropic.CacheControlEphemeral = { type: 'ephemeral' };

const providerCountEndpointSupport: Partial<Record<'mistral' | 'cerebras', boolean>> = {};

/**
 * Fast local token estimate (~4 chars/token).
 * Used as fallback and for per-section allocation.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ProviderTokenCountParams {
  messages: ChatMessage[];
  settings: ChatSettings;
  systemPrompt?: string;
  webSearchEnabled?: boolean;
  searchResults?: WebSearchResponse;
  googleDriveEnabled?: boolean;
  driveSearchResults?: GoogleDriveSearchResponse;
  memorySearchEnabled?: boolean;
  mcpTools?: UnifiedTool[];
  toolExecutions?: ToolExecutionResult[];
  ragEnabled?: boolean;
  artifactsEnabled?: boolean;
}

export interface ProviderTokenCountResult {
  totalTokens: number;
  provider: Provider;
  source: string;
}

interface ActiveTools {
  webSearch: boolean;
  googleDrive: boolean;
  memorySearch: boolean;
  rag: boolean;
  mcpTools: UnifiedTool[];
  artifacts: boolean;
}

function getActiveTools(params: ProviderTokenCountParams): ActiveTools {
  const {
    webSearchEnabled,
    searchResults,
    googleDriveEnabled,
    driveSearchResults,
    memorySearchEnabled,
    ragEnabled,
    mcpTools,
    toolExecutions,
    artifactsEnabled,
  } = params;

  return {
    webSearch: !!webSearchEnabled && !searchResults && !toolCallLimitReached('web_search', toolExecutions),
    googleDrive:
      !!googleDriveEnabled &&
      !driveSearchResults &&
      !toolCallLimitReached('google_drive_search', toolExecutions),
    memorySearch: !!memorySearchEnabled && !toolCallLimitReached('memory_search', toolExecutions),
    rag: !!ragEnabled && !toolCallLimitReached('rag_search', toolExecutions),
    mcpTools: (mcpTools || []).filter((t) => !toolCallLimitReached(t.name, toolExecutions)),
    artifacts: artifactsEnabled !== false,
  };
}

function decodeAttachmentData(data: string): string | null {
  try {
    return atob(data);
  } catch {
    try {
      return Buffer.from(data, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }
}

function buildOpenAIInputMessages(messages: ChatMessage[], toolExecutions?: ToolExecutionResult[]) {
  const inputMessages: Record<string, unknown>[] = [];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    const contentParts: Record<string, unknown>[] = [];
    const textType = role === 'assistant' ? 'output_text' : 'input_text';

    if (msg.content) {
      contentParts.push({ type: textType, text: msg.content });
    }

    const attachments = msg.attachments || [];
    const projectFiles = msg.projectFiles || [];
    const allAttachments = [...projectFiles, ...attachments];

    for (const attachment of allAttachments) {
      if (attachment.type === 'image') {
        contentParts.push({
          type: 'input_image',
          image_url: `data:${attachment.mimeType};base64,${attachment.data}`,
        });
      } else if (attachment.type === 'file') {
        const textContent = decodeAttachmentData(attachment.data);
        contentParts.push({
          type: textType,
          text: textContent
            ? `[File: ${attachment.name}]\n${textContent}`
            : `[File: ${attachment.name}] (Unable to decode content)`,
        });
      }
    }

    if (contentParts.length > 0) {
      inputMessages.push({
        role,
        content: contentParts,
      });
    }
  }

  if (toolExecutions && toolExecutions.length > 0) {
    for (const te of toolExecutions) {
      inputMessages.push({
        type: 'function_call',
        name: te.originalToolName || te.toolName,
        call_id: te.toolCallId,
        arguments: JSON.stringify(te.toolParams),
      });

      inputMessages.push({
        type: 'function_call_output',
        call_id: te.toolCallId,
        output: te.result,
      });
    }
  }

  return inputMessages;
}

function buildOpenAIResponsesTools(activeTools: ActiveTools): Record<string, unknown>[] {
  const tools: Record<string, unknown>[] = [];

  if (activeTools.webSearch) tools.push(toResponsesAPIWebSearchTool());
  if (activeTools.googleDrive) tools.push(toResponsesAPIGoogleDriveTool());
  if (activeTools.memorySearch) tools.push(toResponsesAPIMemorySearchTool());
  if (activeTools.rag) tools.push(toResponsesAPIRAGSearchTool());

  if (activeTools.mcpTools.length > 0) {
    for (const tool of activeTools.mcpTools) {
      const toolName =
        tool.source === 'builtin'
          ? `builtin__${tool.name}`
          : tool.source === 'mcp' && tool.serverId
            ? `mcp__${tool.serverId}__${tool.name}`
            : tool.name;

      tools.push({
        type: 'function',
        name: toolName,
        description: tool.description,
        parameters: tool.parameters,
      });
    }
  }

  if (activeTools.artifacts) {
    tools.push(toResponsesAPICreateArtifactTool());
    tools.push(toResponsesAPIUpdateArtifactTool());
    tools.push(toResponsesAPIReadArtifactTool());
  }

  return tools;
}

async function countOpenAIStyleInputTokens(
  params: ProviderTokenCountParams,
  client: OpenAI
): Promise<number | null> {
  const activeTools = getActiveTools(params);
  const input = buildOpenAIInputMessages(params.messages, params.toolExecutions);
  const tools = buildOpenAIResponsesTools(activeTools);

  const countParams: Record<string, unknown> = {
    model: params.settings.model,
    input,
  };

  if (params.systemPrompt) {
    countParams.instructions = params.systemPrompt;
  }

  if (tools.length > 0) {
    countParams.tools = tools;
    countParams.tool_choice = 'auto';
  }

  const response = await client.responses.inputTokens.count(countParams);
  const total = response.input_tokens;
  return Number.isFinite(total) ? total : null;
}

async function countOpenAITokens(params: ProviderTokenCountParams): Promise<number | null> {
  const apiKey = params.settings.openaiKey;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  return countOpenAIStyleInputTokens(params, client);
}

function buildAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const lastUserMessageIndex = messages.reduce(
    (lastIndex, msg, index) => (msg.role === 'user' ? index : lastIndex),
    -1
  );

  return messages.map((msg, index) => {
    if (msg.role === 'assistant') {
      if (msg.contentBlocks && msg.contentBlocks.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];

        for (const block of msg.contentBlocks) {
          if (block.type === 'text' && block.text) {
            contentBlocks.push({ type: 'text', text: block.text } satisfies Anthropic.TextBlockParam);
          } else if (block.type === 'reasoning' && block.reasoning) {
            // Token counting endpoint accepts text blocks, not replay signatures.
            contentBlocks.push({ type: 'text', text: block.reasoning } satisfies Anthropic.TextBlockParam);
          }
        }

        if (contentBlocks.length > 0) {
          return { role: 'assistant', content: contentBlocks };
        }
      }

      return { role: 'assistant', content: msg.content || '...' };
    }

    return {
      role: 'user',
      content: toAnthropicContent(msg, { cacheBreakpoint: index === lastUserMessageIndex }),
    };
  });
}

async function countAnthropicTokens(params: ProviderTokenCountParams): Promise<number | null> {
  const apiKey = params.settings.anthropicKey;
  if (!apiKey) return null;

  const client = new Anthropic({
    apiKey,
    defaultHeaders: {
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
  });

  const activeTools = getActiveTools(params);
  const anthropicMessages = buildAnthropicMessages(params.messages);

  if (params.toolExecutions && params.toolExecutions.length > 0) {
    const thinkingFromToolTurn = params.toolExecutions.find(
      (te) => typeof te.anthropicThinkingSignature === 'string' && typeof te.anthropicThinking === 'string'
    );
    const replayThinkingBlockForToolTurn =
      params.settings.anthropicThinkingEnabled && thinkingFromToolTurn?.anthropicThinkingSignature
        ? ({
            type: 'thinking',
            signature: thinkingFromToolTurn.anthropicThinkingSignature,
            thinking: thinkingFromToolTurn.anthropicThinking ?? '',
          } satisfies Anthropic.ThinkingBlockParam)
        : undefined;

    const toolUseBlocks: Anthropic.ToolUseBlockParam[] = params.toolExecutions.map((te) => ({
      type: 'tool_use' as const,
      id: te.toolCallId,
      name: te.originalToolName || te.toolName,
      input: te.toolParams,
    }));

    anthropicMessages.push({
      role: 'assistant',
      content: replayThinkingBlockForToolTurn ? [replayThinkingBlockForToolTurn, ...toolUseBlocks] : toolUseBlocks,
    });

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = params.toolExecutions.map((te, index) => ({
      type: 'tool_result' as const,
      tool_use_id: te.toolCallId,
      content: te.result,
      is_error: te.isError,
      cache_control:
        index === params.toolExecutions.length - 1
          ? ANTHROPIC_EPHEMERAL_CACHE_CONTROL
          : undefined,
    }));

    anthropicMessages.push({
      role: 'user',
      content: toolResultBlocks,
    });
  }

  const countRequest: Anthropic.MessageCountTokensParams = {
    model: params.settings.model,
    system: params.systemPrompt || undefined,
    messages: anthropicMessages,
  };

  const tools: Anthropic.Tool[] = [];
  if (activeTools.webSearch) tools.push(anthropicWebSearchTool);
  if (activeTools.googleDrive) tools.push(anthropicGoogleDriveTool);
  if (activeTools.memorySearch) tools.push(anthropicMemorySearchTool);
  if (activeTools.rag) tools.push(anthropicRAGSearchTool);
  if (activeTools.mcpTools.length > 0) tools.push(...toAnthropicTools(activeTools.mcpTools));
  if (activeTools.artifacts) {
    tools.push(anthropicCreateArtifactTool, anthropicUpdateArtifactTool, anthropicReadArtifactTool);
  }
  if (tools.length > 0) {
    countRequest.tools = tools;
  }

  const response = await client.messages.countTokens(countRequest);
  const total = response.input_tokens;
  return Number.isFinite(total) ? total : null;
}

async function countGoogleTokens(params: ProviderTokenCountParams): Promise<number | null> {
  const apiKey = params.settings.googleKey;
  if (!apiKey) return null;

  const activeTools = getActiveTools(params);
  const model = params.settings.model;
  const isGemini3 = model.includes('gemini-3');

  const contents: Array<Record<string, unknown>> = [];

  for (const msg of params.messages) {
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

  if (params.toolExecutions && params.toolExecutions.length > 0) {
    contents.push({
      role: 'model',
      parts: params.toolExecutions.map((te) => {
        const part: Record<string, unknown> = {
          functionCall: {
            name: te.originalToolName || te.toolName,
            args: te.toolParams,
          },
        };
        if (isGemini3) {
          part.thoughtSignature = te.geminiThoughtSignature || 'skip_thought_signature_validator';
        }
        return part;
      }),
    });

    contents.push({
      role: 'user',
      parts: params.toolExecutions.map((te) => ({
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

  const requestBody: Record<string, unknown> = { contents };

  if (params.systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: params.systemPrompt }],
    };
  }

  const functionDeclarations: Array<Record<string, unknown>> = [];
  if (activeTools.webSearch) functionDeclarations.push(geminiWebSearchDeclaration);
  if (activeTools.googleDrive) functionDeclarations.push(geminiGoogleDriveDeclaration);
  if (activeTools.memorySearch) functionDeclarations.push(geminiMemorySearchDeclaration);
  if (activeTools.rag) functionDeclarations.push(geminiRAGSearchDeclaration);
  if (activeTools.mcpTools.length > 0) {
    functionDeclarations.push(...toGeminiTools(activeTools.mcpTools).functionDeclarations);
  }
  if (activeTools.artifacts) {
    functionDeclarations.push(
      geminiCreateArtifactDeclaration,
      geminiUpdateArtifactDeclaration,
      geminiReadArtifactDeclaration
    );
  }

  if (functionDeclarations.length > 0) {
    requestBody.tools = [{ functionDeclarations }];
    requestBody.toolConfig = {
      functionCallingConfig: { mode: 'AUTO' },
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:countTokens?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google countTokens failed [${response.status}] ${errorText}`);
  }

  const data = await response.json() as { totalTokens?: number; total_tokens?: number };
  const total = data.totalTokens ?? data.total_tokens;
  if (typeof total === 'number' && Number.isFinite(total)) {
    return total;
  }
  return null;
}

function isUnsupportedCountEndpointError(error: unknown): boolean {
  const err = error as { status?: number; message?: string } | undefined;
  if (err?.status && [404, 405, 501].includes(err.status)) {
    return true;
  }

  const message = err?.message?.toLowerCase() || '';
  return (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('unknown endpoint') ||
    message.includes('no route')
  );
}

async function countOpenAICompatibleProviderTokens(
  params: ProviderTokenCountParams,
  provider: 'mistral' | 'cerebras',
  baseURL: string,
  apiKey: string
): Promise<number | null> {
  if (providerCountEndpointSupport[provider] === false) {
    return null;
  }

  try {
    const client = new OpenAI({ apiKey, baseURL });
    const total = await countOpenAIStyleInputTokens(params, client);
    if (total !== null) {
      providerCountEndpointSupport[provider] = true;
    }
    return total;
  } catch (error) {
    if (isUnsupportedCountEndpointError(error)) {
      providerCountEndpointSupport[provider] = false;
      return null;
    }
    throw error;
  }
}

function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Try to get an authoritative input-token count directly from provider APIs.
 * Returns null if no API count endpoint is available or request fails.
 */
export async function countInputTokensWithProviderAPI(
  params: ProviderTokenCountParams
): Promise<ProviderTokenCountResult | null> {
  const { provider } = params.settings;

  try {
    if (provider === 'openai') {
      const totalTokens = await countOpenAITokens(params);
      if (totalTokens !== null) {
        return {
          totalTokens,
          provider,
          source: 'openai.responses.input_tokens',
        };
      }
      return null;
    }

    if (provider === 'anthropic') {
      const totalTokens = await countAnthropicTokens(params);
      if (totalTokens !== null) {
        return {
          totalTokens,
          provider,
          source: 'anthropic.messages.count_tokens',
        };
      }
      return null;
    }

    if (provider === 'google') {
      const totalTokens = await countGoogleTokens(params);
      if (totalTokens !== null) {
        return {
          totalTokens,
          provider,
          source: 'google.models.countTokens',
        };
      }
      return null;
    }

    if (provider === 'mistral' && params.settings.mistralKey) {
      const totalTokens = await countOpenAICompatibleProviderTokens(
        params,
        'mistral',
        MISTRAL_BASE_URL,
        params.settings.mistralKey
      );
      if (totalTokens !== null) {
        return {
          totalTokens,
          provider,
          source: 'mistral.openai_compatible.responses.input_tokens',
        };
      }
      return null;
    }

    if (provider === 'cerebras' && params.settings.cerebrasKey) {
      const totalTokens = await countOpenAICompatibleProviderTokens(
        params,
        'cerebras',
        CEREBRAS_BASE_URL,
        params.settings.cerebrasKey
      );
      if (totalTokens !== null) {
        return {
          totalTokens,
          provider,
          source: 'cerebras.openai_compatible.responses.input_tokens',
        };
      }
      return null;
    }
  } catch (error) {
    console.warn(`[token-estimation] Provider token counting failed (${provider}): ${errorToString(error)}`);
    return null;
  }

  return null;
}
