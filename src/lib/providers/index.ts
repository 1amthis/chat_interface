/**
 * Multi-provider chat streaming module
 *
 * This module provides a unified interface for streaming chat responses
 * from multiple AI providers (OpenAI, Anthropic, Google, Mistral, Cerebras).
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
export { mergeSystemPrompts, isOpenAIReasoningModel, generateGeminiToolCallId, buildArtifactSystemPrompt, isArtifactTool } from './base';

// Re-export tool definitions
export {
  WEB_SEARCH_SCHEMA,
  GOOGLE_DRIVE_SCHEMA,
  MEMORY_SEARCH_SCHEMA,
  RAG_SEARCH_SCHEMA,
  ARTIFACT_TOOL_NAMES,
  openAIWebSearchTool,
  openAIGoogleDriveTool,
  openAIMemorySearchTool,
  openAIRAGSearchTool,
  openAICreateArtifactTool,
  openAIUpdateArtifactTool,
  openAIReadArtifactTool,
  anthropicWebSearchTool,
  anthropicGoogleDriveTool,
  anthropicMemorySearchTool,
  anthropicRAGSearchTool,
  anthropicCreateArtifactTool,
  anthropicUpdateArtifactTool,
  anthropicReadArtifactTool,
  geminiWebSearchDeclaration,
  geminiGoogleDriveDeclaration,
  geminiMemorySearchDeclaration,
  geminiRAGSearchDeclaration,
  geminiCreateArtifactDeclaration,
  geminiUpdateArtifactDeclaration,
  geminiReadArtifactDeclaration,
  toResponsesAPICreateArtifactTool,
  toResponsesAPIUpdateArtifactTool,
  toResponsesAPIReadArtifactTool,
} from './tools/definitions';

// Import provider implementations
import { streamOpenAI, streamOpenAIResponses } from './openai';
import { streamAnthropic } from './anthropic';
import { streamGoogle } from './google';
import { streamMistral } from './mistral';
import { streamCerebras } from './cerebras';
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
  toolExecutions?: ToolExecutionResult[],
  ragEnabled?: boolean
): AsyncGenerator<StreamChunk> {
  const { provider, model } = settings;

  if (provider === 'openai') {
    // Use Responses API for reasoning-capable models (gpt-5 + o-series) to get reasoning summaries
    if (isOpenAIReasoningModel(model)) {
      yield* streamOpenAIResponses(messages, model, settings.openaiKey, systemPrompt, webSearchEnabled, searchResults, googleDriveEnabled, driveSearchResults, memorySearchEnabled, mcpTools, toolExecutions, ragEnabled);
    } else {
      yield* streamOpenAI(messages, model, settings.openaiKey, systemPrompt, webSearchEnabled, searchResults, googleDriveEnabled, driveSearchResults, memorySearchEnabled, mcpTools, toolExecutions, ragEnabled);
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
      settings.anthropicThinkingBudgetTokens,
      ragEnabled
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
      toolExecutions,
      ragEnabled
    );
  } else if (provider === 'mistral') {
    yield* streamMistral(
      messages,
      model,
      settings.mistralKey,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      memorySearchEnabled,
      mcpTools,
      toolExecutions,
      ragEnabled
    );
  } else if (provider === 'cerebras') {
    yield* streamCerebras(
      messages,
      model,
      settings.cerebrasKey,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      memorySearchEnabled,
      mcpTools,
      toolExecutions,
      ragEnabled
    );
  }
}
