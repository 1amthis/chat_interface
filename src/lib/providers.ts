/**
 * Multi-provider chat streaming module
 *
 * This file re-exports from the modular providers/ directory
 * for backwards compatibility with existing imports.
 */

export {
  // Types
  type ChatMessage,
  type ToolCallInfo,
  type ToolExecutionResult,
  type StreamChunk,
  type StreamChatOptions,
  // Main function
  streamChat,
  // Utilities
  mergeSystemPrompts,
  isOpenAIReasoningModel,
  generateGeminiToolCallId,
  buildArtifactSystemPrompt,
  isArtifactTool,
  // Tool definitions (for advanced use cases)
  WEB_SEARCH_SCHEMA,
  GOOGLE_DRIVE_SCHEMA,
  ARTIFACT_TOOL_NAMES,
  openAIWebSearchTool,
  openAIGoogleDriveTool,
  anthropicWebSearchTool,
  anthropicGoogleDriveTool,
  geminiWebSearchDeclaration,
  geminiGoogleDriveDeclaration,
} from './providers/index';
