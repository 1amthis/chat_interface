# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 16 chat interface supporting multiple AI providers (OpenAI, Anthropic, Google, Mistral, Cerebras) with advanced features including:
- Multi-provider chat with streaming responses
- MCP (Model Context Protocol) server integration
- Tool-based artifacts system (code, HTML, React, SVG, Markdown, Mermaid)
- RAG (Retrieval-Augmented Generation) document search
- Memory search (AI searches previous conversations for context)
- Web search capabilities (Tavily, Brave, DuckDuckGo, Wikipedia)
- Google Drive integration
- Project-based conversation organization
- Dedicated configuration pages (Models & Providers, Connectors, Knowledge Base)
- Theme system (light/dark/system)
- Token usage tracking with cost calculation

## Development Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Multi-Provider Chat System

Five AI providers through a unified interface in `src/lib/providers.ts` → `src/lib/providers/`:

- **streamChat()** in `providers/index.ts` - Routes to provider-specific implementations
- Provider routing logic:
  - OpenAI: `streamOpenAIResponses()` for reasoning models (gpt-5, o3, o4-mini), `streamOpenAI()` for others
  - Anthropic: `streamAnthropic()` with extended thinking budget support
  - Google: `streamGoogle()` with Gemini thinking/reasoning levels
  - Mistral: `streamMistral()` with reasoning output support
  - Cerebras: `streamCerebras()` (OpenAI-compatible API)
- Each provider has its own directory under `src/lib/providers/` with `index.ts` (streaming) and `content.ts` (formatting)
- Shared utilities in `providers/base.ts`, types in `providers/types.ts`
- Tool schemas in `providers/tools/definitions.ts`
- All providers support multimodal inputs (images + text files) with provider-specific formatting
- Streaming responses yield chunks of type `{ type: 'content' | 'usage' | 'reasoning' | 'tool_call', ... }`

### Model Metadata Registry

`src/lib/model-metadata.ts` - Comprehensive metadata for every supported model:
- Display names, descriptions, context windows, max output tokens
- Model tiers (flagship, standard, fast, economy) with color coding
- Capabilities (vision, tools, reasoning)
- Pricing (input/output per million tokens)
- Helper functions: `getModelMetadata()`, `getTierColor()`, `formatContextWindow()`, `calculateCost()`

### MCP (Model Context Protocol) Integration

Complete MCP server integration in `src/lib/mcp/`:

- **MCPManager** (`manager.ts`) - Singleton managing multiple MCP server connections
- **MCPClient** (`client.ts`) - Individual client for each MCP server connection
- **Transport Support** - stdio, SSE, streamable-http, and http transports
- **Builtin Tools** (`builtin-tools.ts`) - Shell, filesystem, and fetch tools
- **Tool Converter** (`tool-converter.ts`) - Converts MCP tool schemas to provider formats
- **Unified Tool Sources** - builtin, mcp, web_search, google_drive, memory_search, rag_search, artifact
- **API Routes**:
  - `/api/mcp` - Get available tools from all connected MCP servers
  - `/api/mcp/call` - Execute tool calls on specific MCP servers

### Artifacts System

Tool-based artifact system with parser in `src/lib/artifact-parser.ts`:

- **Tool-Based Creation** - `create_artifact`, `update_artifact`, `read_artifact` structured tools
- **Supported Types**: code, html, react, svg, markdown, mermaid
- **Streaming Support**: Incremental parsing during message streaming
- **Versioning**: Artifacts maintain version history for edits
- **Configurable**: Can be toggled on/off via `artifactsEnabled` setting in Connectors
- **Components**:
  - `ArtifactManager.tsx` - Manages artifact lifecycle and storage
  - `ArtifactPanel.tsx` - Side panel displaying artifacts
  - `ArtifactPreview.tsx` - Router component for artifact type
  - `ArtifactCard.tsx` - Card display component
  - `artifact-previews/` - Specialized renderers (CodePreview, HTMLPreview, ReactPreview, SVGPreview, MarkdownPreview, MermaidPreview)
  - `ProjectDashboard.tsx` - Project-level artifact management

### RAG System

Retrieval-augmented generation in `src/lib/rag/`:

- **Document Processing**: Parse and chunk documents with multiple strategies (paragraph, fixed, sentence, markdown)
- **Vector Storage**: In-memory vector database with similarity search (`vectordb.ts`)
- **Embedding Service**: Pluggable embedding generation (`embeddings.ts`)
- **Search**: Vector similarity search with configurable limits and score thresholds (`search.ts`)
- **API Routes**:
  - `/api/rag/parse` - Parse documents for RAG indexing
  - `/api/rag/embed` - Embed document chunks
- **Settings**: Configurable chunk strategy, chunk size, overlap, search limit, min score

### Memory Search

AI-initiated search across previous conversations in `src/lib/memory-search/`:

- **Search Algorithm**: BM25 (Best Matching 25) for relevance ranking
- **Storage**: IndexedDB for client-side privacy-preserving search index
- **Trigger**: AI decides when to search via `memory_search` tool call
- **Components**:
  - `index.ts` - Main API: `searchMemory()`, `updateIndex()`, `syncIndex()`
  - `bm25.ts` - BM25 scoring algorithm
  - `indexdb.ts` - IndexedDB operations
  - `tokenizer.ts` - Text tokenization with stop word filtering
  - `types.ts` - IndexStats, MemorySearchResult types
- **Auto-indexing**: Conversations indexed on save, removed on delete

### Web Search Integration

Multi-provider web search in `src/lib/websearch.ts`:

- **Supported Providers**: Tavily (API key), Brave (API key), DuckDuckGo, SearXNG, Wikipedia
- **Fallback Strategy**: Automatically tries multiple free services if primary fails
- **API Route**: `/api/search` - Server-side search execution

### Google Drive Integration

OAuth-based Google Drive access in `src/lib/googledrive.ts`:

- **Features**: File search, content extraction, metadata retrieval
- **OAuth Flow**: Authorization code exchange, token refresh
- **API Routes**: `/api/auth/google/callback`, `/api/drive-search`
- **Supported Files**: Google Docs, Sheets, text files, PDFs

### State Management & Storage

Uses browser localStorage for all persistence (`src/lib/storage.ts`):

- **Conversations** - Message history with artifacts, tool calls, and metadata
- **Projects** - Organizational structure with instructions, files, provider/model settings
- **Settings** - User preferences (API keys, MCP config, theme, search, RAG settings)
- **Artifacts** - Stored per-conversation with versioning
- **Usage Records** - Per-conversation token usage tracking

### Content Blocks Architecture

Messages use a structured content block system (defined in `src/types/index.ts`):

- **TextContentBlock** - Regular text content
- **ReasoningContentBlock** - Model reasoning/thinking (OpenAI o-series, Claude extended thinking, Gemini thinking, Mistral reasoning)
- **ToolCallContentBlock** - Tool invocations with status and results
- **ArtifactContentBlock** - References to artifacts by ID

This allows proper interleaving of different content types in display order.

### Custom Hooks

Extracted hooks in `src/hooks/`:

- `useArtifacts.ts` - Artifact lifecycle management
- `useToolExecution.ts` - Tool call execution workflow
- `useProjects.ts` - Project CRUD operations
- `useScrollManagement.ts` - Auto-scroll behavior
- `useHtmlToPdf.ts` - PDF export from HTML content

### API Route Structure

- `POST /api/chat` - SSE endpoint for chat streaming (text/event-stream)
- `POST /api/models` - Fetch available models per provider
- `POST /api/validate-key` - Validate API keys for providers
- `POST /api/search` - Web search execution
- `POST /api/drive-search` - Google Drive search
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/mcp` - Get MCP tools
- `POST /api/mcp/call` - Execute MCP tool calls
- `POST /api/rag/parse` - Parse documents for RAG
- `POST /api/rag/embed` - Embed documents for RAG

### Component Responsibilities

**Main:**
- **Chat.tsx** - Main orchestrator (~1700 lines), manages conversation state, streaming, artifacts, tool calls, modals
- **Sidebar.tsx** - Conversation list with project organization, drag-drop, and menu buttons for configuration pages
- **ChatMessage.tsx** - Individual message display with edit/regenerate, artifact rendering
- **ChatInput.tsx** - Message composition with file/image attachment, project file injection

**Configuration Pages (opened as modals from Sidebar):**
- **ModelsConfig.tsx** - API key management for all 5 providers, dynamic model fetching, model metadata display, pricing/usage tracking
- **ConnectorsConfig.tsx** - MCP servers, web search, Google Drive, artifacts toggle
- **KnowledgeBase.tsx** - Memory search config/testing, RAG search config, index statistics
- **SettingsModal.tsx** - Simplified to theme selection + system prompt only

**Supporting:**
- **MCPSettingsSection.tsx** - MCP server management (used within ConnectorsConfig)
- **RAGSettingsSection.tsx** - RAG chunking/overlap settings (used within KnowledgeBase)
- **ToolCallDisplay.tsx** - Visualize tool execution status and results
- **TokenUsageDisplay.tsx** - Token breakdown (input/output/cached/reasoning)
- **MarkdownMessage.tsx** - Enhanced markdown rendering with syntax highlighting and typography
- **ThemeProvider.tsx** / **ThemeToggle.tsx** - Theme management
- **ThinkingIndicator.tsx** - Animated indicator during streaming

### Attachment & Project Files System

Attachments are stored as base64 in the Attachment type:
- **Images**: Sent directly to vision-capable models
- **Text files**: Decoded and injected into message content
- **Project Files**: Persistent files attached at project level, automatically included
- **Provider-specific formatting** in each provider's `content.ts`

## Import Path Alias

Uses `@/*` for `./src/*` (configured in tsconfig.json)

## TypeScript Configuration

- Target: ES2017
- JSX: react-jsx
- Strict mode enabled
- Incremental compilation
- All type definitions in `src/types/index.ts`

## Key Dependencies

- `next` 16.0.7 / `react` 19.2.0 - Framework
- `@anthropic-ai/sdk` - Anthropic API client
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `openai` - OpenAI API client (also used by Cerebras and Mistral via compatible endpoints)
- `react-markdown` / `remark-gfm` / `@tailwindcss/typography` - Markdown rendering
- `react-syntax-highlighter` - Code highlighting
- `mermaid` - Diagram rendering
- `dompurify` - HTML sanitization for artifacts
- `sucrase` - JSX transpilation for React artifact previews
- `zod` - Schema validation
- `pdf-parse` / `mammoth` / `xlsx` - Document parsing (server-side external packages)
- `html2pdf.js` - PDF export

## Next.js Configuration

- `serverExternalPackages`: pdf-parse, mammoth, xlsx (avoids bundling issues)
