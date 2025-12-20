# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 16 chat interface supporting multiple AI providers (OpenAI, Anthropic, Google, Ollama) with advanced features including:
- Multi-provider chat with streaming responses
- MCP (Model Context Protocol) server integration
- Artifacts system (code, HTML, React, SVG, Markdown, Mermaid)
- Web search capabilities (Tavily, Brave, DuckDuckGo, Wikipedia)
- Google Drive integration
- Project-based conversation organization
- Theme system (light/dark/system)
- Token usage tracking with caching support

## Development Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Multi-Provider Chat System

The application abstracts four AI providers through a unified interface in `src/lib/providers.ts`:

- **streamChat()** - Main entry point that routes to provider-specific implementations
- Each provider has its own streaming function: `streamOpenAI()`, `streamAnthropic()`, `streamGoogle()`, `streamOllama()`
- All providers support multimodal inputs (images + text files) with provider-specific formatting
- Streaming responses yield chunks of type `{ type: 'content' | 'usage' | 'reasoning' | 'tool_call', ... }`
- Extended thinking mode support for Claude with configurable token budgets

### MCP (Model Context Protocol) Integration

Complete MCP server integration system in `src/lib/mcp/`:

- **MCPManager** (`manager.ts`) - Singleton managing multiple MCP server connections
- **MCPClient** (`client.ts`) - Individual client for each MCP server connection
- **Transport Support** - stdio, SSE, streamable-http, and http transports
- **Unified Tools** - Combines builtin, MCP, web_search, and google_drive tools
- **API Routes**:
  - `/api/mcp/route.ts` - Get available tools from all connected MCP servers
  - `/api/mcp/call/route.ts` - Execute tool calls on specific MCP servers
- **UI Components**:
  - `MCPSettingsSection.tsx` - Configure MCP servers in settings
  - `ToolCallDisplay.tsx` - Visualize tool calls with status and results

### Artifacts System

Parser and rendering system for embedded content in chat messages (`src/lib/artifact-parser.ts`):

- **Supported Types**: code, html, react, svg, markdown, mermaid
- **Format**: Messages can contain `<artifact type="..." title="..." language="...">content</artifact>` tags
- **Streaming Support**: Incremental parsing during message streaming
- **Versioning**: Artifacts maintain version history for edits
- **Components**:
  - `ArtifactManager.tsx` - Manages artifact lifecycle and storage
  - `ArtifactPanel.tsx` - Side panel displaying artifacts
  - `ArtifactPreview.tsx` - Router component for artifact type
  - `artifact-previews/` - Specialized renderers (CodePreview, ReactPreview, MermaidPreview, etc.)
  - `ProjectDashboard.tsx` - Project-level artifact management

### Web Search Integration

Multi-provider web search system in `src/lib/websearch.ts`:

- **Supported Providers**: Tavily (API key), Brave (API key), DuckDuckGo, SearXNG, Wikipedia
- **Fallback Strategy**: Automatically tries multiple free services if primary fails
- **API Route**: `/api/search/route.ts` - Server-side search execution
- **Context Injection**: Search results formatted for inclusion in chat context

### Google Drive Integration

OAuth-based Google Drive access in `src/lib/googledrive.ts`:

- **Features**: File search, content extraction, metadata retrieval
- **OAuth Flow**: Authorization code exchange, token refresh
- **API Routes**:
  - `/api/auth/google/callback/route.ts` - OAuth callback handler
  - `/api/drive-search/route.ts` - Execute Drive searches
- **Supported Files**: Google Docs, Sheets, text files, PDFs

### State Management & Storage

Uses browser localStorage for all persistence (`src/lib/storage.ts`):

- **Conversations** - Message history with artifacts, tool calls, and metadata
- **Projects** - Organizational structure with instructions, files, provider/model settings
- **Settings** - User preferences (API keys, MCP config, theme, search settings)
- **Artifacts** - Stored per-conversation with versioning

The Chat component (`src/components/Chat.tsx`) manages all state and orchestrates:
- Message streaming via `/api/chat` route
- Conversation CRUD operations
- Artifact parsing and management
- Tool call execution and visualization
- Token usage tracking (input, output, cached, reasoning)
- Abort handling for streaming responses

### Content Blocks Architecture

Messages use a structured content block system (defined in `src/types/index.ts`):

- **TextContentBlock** - Regular text content
- **ReasoningContentBlock** - Model reasoning/thinking (o1, o3-mini, Claude extended thinking)
- **ToolCallContentBlock** - Tool invocations with status and results
- **ArtifactContentBlock** - References to artifacts by ID

This allows proper interleaving of different content types in display order.

### API Route Structure

- `/api/chat/route.ts` - Server-sent events (SSE) endpoint for chat streaming
  - Accepts messages, settings, system prompt, project context
  - Returns text/event-stream with data chunks
  - Format: `data: {content: string}` or `data: {usage: TokenUsage}` or `data: {reasoning: string}` or `data: [DONE]`

### Component Responsibilities

- **Chat.tsx** - Main orchestrator, manages conversation state, streaming, artifacts, tool calls
- **ChatMessage.tsx** - Individual message display with edit/regenerate, artifact rendering
- **ChatInput.tsx** - Message composition with file/image attachment, project file injection
- **Sidebar.tsx** - Conversation list with project organization and drag-drop
- **SettingsModal.tsx** - Configuration hub for API keys, MCP servers, web search, Google Drive
- **ThemeProvider.tsx** / **ThemeToggle.tsx** - Theme management
- **ThinkingIndicator.tsx** - Animated indicator during streaming
- **TokenUsageDisplay.tsx** - Detailed token breakdown (input/output/cached/reasoning)
- **MarkdownMessage.tsx** - Enhanced markdown rendering with syntax highlighting

### Attachment & Project Files System

Attachments are stored as base64 in the Attachment type:
- **Images**: Sent directly to vision-capable models
- **Text files**: Decoded and injected into message content
- **Project Files**: Persistent files attached at project level, automatically included
- **Provider-specific formatting**: `toOpenAIContent()`, `toAnthropicContent()`, `toGoogleContent()`, etc.

## Import Path Alias

Uses `@/*` for `./src/*` (configured in tsconfig.json)

## TypeScript Configuration

- Target: ES2017
- JSX: react-jsx
- Strict mode enabled
- All type definitions in `src/types/index.ts`

## Key Dependencies

- `@anthropic-ai/sdk` - Anthropic API client
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `openai` - OpenAI API client
- `react-markdown` / `remark-gfm` - Markdown rendering
- `react-syntax-highlighter` - Code highlighting
- `mermaid` - Diagram rendering
- `dompurify` - HTML sanitization for artifacts
- `zod` - Schema validation
