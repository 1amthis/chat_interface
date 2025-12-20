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
  openAIWebSearchTool,
  openAIGoogleDriveTool,
  anthropicWebSearchTool,
  anthropicGoogleDriveTool,
  geminiWebSearchDeclaration,
  geminiGoogleDriveDeclaration,
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
