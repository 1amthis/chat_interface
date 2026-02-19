export type Provider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'cerebras';

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
  usage?: TokenUsage;    // Token usage for this response
  model?: string;        // Model that generated this response (for cost calc)
  contextBreakdown?: ContextBreakdown; // Context window state when this response was generated
  parentId?: string | null; // null = root message, undefined = legacy (no branching)
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
  activeLeafId?: string; // Leaf of the currently active branch (for conversation branching)
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
  sqlite?: {
    enabled: boolean;
    databasePath?: string;
    readOnly?: boolean;
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
  cerebrasKey?: string;
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
  // Memory search tuning
  memorySearchLimit?: number;         // 1-20, default 5
  memorySearchMinScore?: number;      // 0-1, default 0.1
  memorySearchSnippetLength?: number; // 50-500, default 150
  bm25K1?: number;                    // 0.5-3.0, default 1.2
  bm25B?: number;                     // 0-1.0, default 0.75
  // RAG search tuning
  ragSearchLimit?: number;            // 1-20, default 5
  ragSearchMinScore?: number;         // 0-1, default 0.3
  // Artifacts settings
  artifactsEnabled?: boolean;
  // Generation parameters (undefined = provider defaults)
  temperature?: number;
  maxOutputTokens?: number;
  // OpenAI reasoning effort (gpt-5, o-series)
  openaiReasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  // Google thinking settings
  googleThinkingEnabled?: boolean;
  googleThinkingBudget?: number;   // Gemini 2.5: 0-32768, -1 for dynamic
  googleThinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'; // Gemini 3
  // Custom models per provider (persisted)
  customModels?: Partial<Record<Provider, string[]>>;
  // API key validation cache
  apiKeyValidation?: Partial<Record<Provider, ApiKeyValidationStatus>>;
}

export const DEFAULT_MODELS: Record<Provider, string[]> = {
  openai: [
    'gpt-5.2',
    'gpt-5.1',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'o3',
    'o3-mini',
    'o3-pro',
    'o4-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
  ],
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-opus-4-5',
  ],
  google: [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
  mistral: [
    'mistral-medium-2508',
    'mistral-small-2506',
    'magistral-medium-latest',
    'magistral-small-latest',
    'codestral-2508',
  ],
  cerebras: [
    'qwen-3-235b-a22b-instruct-2507',
    'gpt-oss-120b',
    'zai-glm-4.7',
    'llama3.1-8b',
  ],
};

export const DEFAULT_SETTINGS: ChatSettings = {
  provider: 'openai',
  model: 'gpt-5',
  theme: 'system',
  anthropicThinkingEnabled: false,
  anthropicThinkingBudgetTokens: 1024,
  artifactsEnabled: true,
  openaiReasoningEffort: 'medium',
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

export interface ContextBreakdownSection {
  label: string;
  estimatedTokens: number;
  percentage: number;
  color: string;
  details?: { label: string; estimatedTokens: number }[];
}

export interface ContextBreakdown {
  sections: ContextBreakdownSection[];
  totalEstimatedTokens: number;
  contextWindowSize: number;
  percentUsed: number;
  model: string;
}

export interface ApiKeyValidationStatus {
  valid: boolean;
  lastChecked: number;
  error?: string;
}

export interface UsageRecord {
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number;
  timestamp: number;
  conversationId?: string;
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
