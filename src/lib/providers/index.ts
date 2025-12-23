/**
 * Multi-provider chat streaming module
 *
 * This module provides a unified interface for streaming chat responses
 * from multiple AI providers (OpenAI, Anthropic, Google, Ollama).
 */

// Re-export types
export type {
  ChatMessage,
  ToolCallInfo,
  ToolExecutionResult,
  StreamChunk,
  StreamChatOptions,
} from './types';

// Re-export shared utilities
export { mergeSystemPrompts, isOpenAIReasoningModel, generateGeminiToolCallId } from './base';

// Re-export tool definitions
export {
  WEB_SEARCH_SCHEMA,
  GOOGLE_DRIVE_SCHEMA,
  MEMORY_SEARCH_SCHEMA,
  openAIWebSearchTool,
  openAIGoogleDriveTool,
  openAIMemorySearchTool,
  anthropicWebSearchTool,
  anthropicGoogleDriveTool,
  anthropicMemorySearchTool,
  geminiWebSearchDeclaration,
  geminiGoogleDriveDeclaration,
  geminiMemorySearchDeclaration,
} from './tools/definitions';

// Import provider implementations
import { streamOpenAI, streamOpenAIResponses } from './openai';
import { streamAnthropic } from './anthropic';
import { streamGoogle } from './google';
import { streamOllama } from './ollama';
import { isOpenAIReasoningModel } from './base';
import { ChatMessage, StreamChunk, ToolExecutionResult } from './types';
import { ChatSettings, UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';

/**
 * Main entry point for streaming chat responses from any provider.
 * Routes to the appropriate provider-specific implementation based on settings.
 */
export async function* streamChat(
  messages: ChatMessage[],
  settings: ChatSettings,
  systemPrompt?: string,
  webSearchEnabled?: boolean,
  searchResults?: WebSearchResponse,
  googleDriveEnabled?: boolean,
  driveSearchResults?: GoogleDriveSearchResponse,
  memorySearchEnabled?: boolean,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[]
): AsyncGenerator<StreamChunk> {
  const { provider, model } = settings;

  if (provider === 'openai') {
    // Use Responses API for reasoning-capable models (gpt-5 + o-series) to get reasoning summaries
    if (isOpenAIReasoningModel(model)) {
      yield* streamOpenAIResponses(messages, model, settings.openaiKey, systemPrompt, webSearchEnabled, searchResults, googleDriveEnabled, driveSearchResults, memorySearchEnabled, mcpTools, toolExecutions);
    } else {
      yield* streamOpenAI(messages, model, settings.openaiKey, systemPrompt, webSearchEnabled, searchResults, googleDriveEnabled, driveSearchResults, memorySearchEnabled, mcpTools, toolExecutions);
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
      memorySearchEnabled,
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
      memorySearchEnabled,
      mcpTools,
      toolExecutions
    );
  } else if (provider === 'ollama') {
    // Ollama doesn't support tools directly, but memory search results can be passed via tool executions
    yield* streamOllama(messages, model, settings.ollamaUrl, systemPrompt, searchResults, driveSearchResults, mcpTools, toolExecutions);
  }
}
