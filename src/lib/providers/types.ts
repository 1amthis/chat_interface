/**
 * Shared types for all provider implementations
 */

import { Attachment, TokenUsage, WebSearchResponse, GoogleDriveSearchResponse, ToolSource, ContentBlock } from '@/types';

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
  // Gemini 3 thought signature for maintaining reasoning context
  thoughtSignature?: string;
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
  // Gemini 3 thought signature for maintaining reasoning context
  geminiThoughtSignature?: string;
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
  settings: import('@/types').ChatSettings;
  systemPrompt?: string;
  webSearchEnabled?: boolean;
  searchResults?: WebSearchResponse;
  googleDriveEnabled?: boolean;
  driveSearchResults?: GoogleDriveSearchResponse;
  mcpTools?: import('@/types').UnifiedTool[];
  toolExecutions?: ToolExecutionResult[];  // Completed tool calls with results
}
