export type Provider = 'openai' | 'anthropic' | 'google' | 'mistral';

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  data: string; // base64 encoded data
  size: number;
}

export interface ProjectFile {
  id: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  data: string; // base64 encoded
  size: number;
  addedAt: number;
}

// Content blocks allow interleaving text, reasoning, and tool calls in the correct order
export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ReasoningContentBlock {
  type: 'reasoning';
  reasoning: string;
}

export interface ToolCallContentBlock {
  type: 'tool_call';
  toolCall: ToolCall;
}

// Artifact Types
export type ArtifactType = 'code' | 'html' | 'react' | 'markdown' | 'svg' | 'mermaid';

export interface ArtifactVersion {
  id: string;
  content: string;
  createdAt: number;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string; // For code artifacts (javascript, python, etc.)
  versions: ArtifactVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface ArtifactContentBlock {
  type: 'artifact';
  artifactId: string;
}

export type ContentBlock = TextContentBlock | ReasoningContentBlock | ToolCallContentBlock | ArtifactContentBlock;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string; // Legacy: combined text content for backwards compatibility
  contentBlocks?: ContentBlock[]; // New: ordered content blocks with interleaved tool calls
  attachments?: Attachment[];
  toolCalls?: ToolCall[]; // Legacy: kept for backwards compatibility
  reasoning?: string; // Reasoning/thinking content from models like o3-mini, o1
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  instructions?: string;
  files?: ProjectFile[];
  provider?: Provider;
  model?: string;
}

/** @deprecated Use Project instead */
export type Folder = Project;

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  artifacts?: Artifact[]; // Artifacts created in this conversation
  provider: Provider;
  model: string;
  systemPrompt?: string;
  projectId?: string;
  folderId?: string; // @deprecated - kept for migration
  createdAt: number;
  updatedAt: number;
}

export interface ProviderConfig {
  provider: Provider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export type Theme = 'light' | 'dark' | 'system';

// MCP (Model Context Protocol) Types - defined early for use in ChatSettings

export type MCPTransport = 'stdio' | 'sse' | 'streamable-http' | 'http';

export interface MCPServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: MCPTransport;
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For SSE and Streamable HTTP transports
  url?: string;
  headers?: Record<string, string>;
}

export type ToolSource = 'builtin' | 'mcp' | 'web_search' | 'google_drive' | 'memory_search' | 'rag_search' | 'artifact';

export interface BuiltinToolsConfig {
  filesystem?: {
    enabled: boolean;
    allowedPaths?: string[];
  };
  shell?: {
    enabled: boolean;
    allowedCommands?: string[];
  };
  fetch?: {
    enabled: boolean;
    allowedDomains?: string[];
  };
}

export interface ChatSettings {
  provider: Provider;
  model: string;
  openaiKey?: string;
  anthropicKey?: string;
  anthropicThinkingEnabled?: boolean;
  anthropicThinkingBudgetTokens?: number;
  googleKey?: string;
  mistralKey?: string;
  systemPrompt?: string;
  theme: Theme;
  webSearchEnabled?: boolean;
  tavilyApiKey?: string;
  braveApiKey?: string;
  // Google Drive settings
  googleDriveEnabled?: boolean;
  googleDriveAccessToken?: string;
  googleDriveRefreshToken?: string;
  googleDriveTokenExpiry?: number;
  // MCP settings
  mcpEnabled?: boolean;
  mcpServers?: MCPServerConfig[];
  builtinTools?: BuiltinToolsConfig;
  // Memory search settings
  memorySearchEnabled?: boolean;
  // RAG search settings
  ragEnabled?: boolean;
  ragChunkStrategy?: 'paragraph' | 'fixed' | 'sentence' | 'markdown';
  ragChunkSize?: number;    // 500–5000, default 2000
  ragChunkOverlap?: number; // 0–500, default 200
}

export const DEFAULT_MODELS: Record<Provider, string[]> = {
  openai: [
    'gpt-5',
    'gpt-5.1',
    'gpt-5.2',
    'gpt-5-mini',
    'gpt-5-nano',
  ],
  anthropic: [
    'claude-sonnet-4-5',
    'claude-opus-4-5',
    'claude-haiku-4-5',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-5-20251101',
    'claude-haiku-4-5-20251001',
  ],
  google: [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ],
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
  ],
};

export const DEFAULT_SETTINGS: ChatSettings = {
  provider: 'openai',
  model: 'gpt-5',
  theme: 'system',
  anthropicThinkingEnabled: false,
  anthropicThinkingBudgetTokens: 1024,
};

export const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

/** @deprecated Use PROJECT_COLORS */
export const FOLDER_COLORS = PROJECT_COLORS;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

// Web Search Types
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  timestamp: number;
}

// Tool Call Types for visualization
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error';

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  startedAt: number;
  completedAt?: number;
  source?: ToolSource;
  serverId?: string; // For MCP tools
}

export interface MessageToolCalls {
  toolCalls: ToolCall[];
}

// Google Drive Types
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  size?: string;
}

export interface GoogleDriveSearchResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  snippet?: string;
  owner?: string;
  size?: string;
}

export interface GoogleDriveSearchResponse {
  query: string;
  results: GoogleDriveSearchResult[];
  timestamp: number;
}

// Additional MCP Types

export interface UnifiedTool {
  source: ToolSource;
  serverId?: string; // For MCP tools, which server provides this
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

// MCP Tool Result for passing back to the model
export interface MCPToolResultContext {
  toolName: string;
  result: string;
  isError: boolean;
  source: ToolSource;
  serverId?: string;
}

// Tool Parameter Types (replacing generic Record<string, unknown>)
export interface WebSearchParams {
  query: string;
}

export interface GoogleDriveSearchParams {
  query: string;
}

export interface MemorySearchParams {
  query: string;
}

export interface RAGSearchParams {
  query: string;
}

export interface FilesystemReadParams {
  path: string;
}

export interface FilesystemWriteParams {
  path: string;
  content: string;
}

export interface ShellExecParams {
  command: string;
  cwd?: string;
}

export interface FetchParams {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

// Union type for all known tool parameters
export type KnownToolParams =
  | WebSearchParams
  | GoogleDriveSearchParams
  | MemorySearchParams
  | RAGSearchParams
  | FilesystemReadParams
  | FilesystemWriteParams
  | ShellExecParams
  | FetchParams;

// Discriminated union for tool results
export type ToolResultData =
  | { source: 'web_search'; result: WebSearchResponse }
  | { source: 'google_drive'; result: GoogleDriveSearchResponse }
  | { source: 'mcp'; result: MCPToolResult }
  | { source: 'builtin'; result: MCPToolResult };

// Gemini API Types (not fully typed in SDK)
export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

// OpenAI Responses API Types
export interface OpenAIResponsesEvent {
  type:
    | 'response.created'
    | 'response.in_progress'
    | 'response.completed'
    | 'response.failed'
    | 'response.output_item.added'
    | 'response.output_item.done'
    | 'response.content_part.added'
    | 'response.content_part.done'
    | 'response.output_text.delta'
    | 'response.output_text.done'
    | 'response.function_call_arguments.delta'
    | 'response.function_call_arguments.done'
    | 'response.reasoning_summary_text.delta'
    | 'response.reasoning_summary_text.done';
  delta?: string;
  output_index?: number;
  content_index?: number;
  item_id?: string;
  item?: {
    type: string;
    id?: string;
    status?: string;
    content?: Array<{ type: string; text?: string }>;
    name?: string;
    call_id?: string;
    arguments?: string;
  };
}

// JSON Schema types for tool definitions
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
}

// PDF Export types
export interface PdfExportOptions {
  margin: number | [number, number, number, number];
  filename: string;
  image: { type: 'jpeg' | 'png'; quality: number };
  html2canvas: {
    scale: number;
    useCORS: boolean;
    logging?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string;
    removeContainer?: boolean;
    imageTimeout?: number;
    foreignObjectRendering?: boolean;
    windowWidth?: number;
    windowHeight?: number;
  };
  jsPDF: {
    unit: 'pt' | 'mm' | 'in';
    format: 'a4' | 'letter' | 'a3' | 'a5';
    orientation: 'portrait' | 'landscape'
  };
  pagebreak?: {
    mode?: string | string[];
    before?: string | string[];
    after?: string | string[];
    avoid?: string | string[];
  };
}
