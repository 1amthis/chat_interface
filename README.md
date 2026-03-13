# Opus Chat Interface

Multi-provider chat workspace built with Next.js.  
It combines model chat, tools, projects, artifacts, citations, and token/context inspection in one UI.

## Core Capabilities

- Multi-provider chat: OpenAI, Anthropic, Google (Gemini), Mistral, Cerebras
- Project-based organization with per-project instructions/files
- Conversation branching (edit/regenerate without destructive overwrite)
- Tool execution with live status blocks:
  - Web search
  - Google Drive search
  - Memory search across conversations
  - Document search (RAG)
  - MCP server tools and built-in tools
- Artifact workflow:
  - Create/update/read artifacts
  - Artifact library
  - Multi-format export (`source`, `docx`, `pdf`, `xlsx`, `pptx`)
- Citation UX for web and document sources (including modal source viewer)
- Token/context visibility with provider-aware token accounting
- System prompt inspector and effective prompt composition

## Recent Updates

Based on recent commit history:

- `90637f1` Add chat toolbar tool toggles and tool execution guards
- `ce49c44` Improve document artifact parsing and export
- `8931340` Add system prompt inspector
- `e83dc56` Improve token accounting with provider counts and reasoning/cache usage
- `825af8e` Fix duplicate citation keys across repeated web/RAG searches
- `dea3365` Improve citation UX with modal source viewer
- `4875b28` Improve artifact editing flow and add artifact library
- `8be9b42` Show connectors/tool catalog with parameter schemas
- `2ca3041` Add visual tool results for Google Drive, memory search, and RAG
- `fe7ccbb` Add visual web search results cards
- `50728e6` Add thinking toggle and provider reasoning handling fixes
- `b055eb6` Add document/spreadsheet/presentation artifacts with export
- `6ca00c1` Add SQLite integration and tool-call reliability improvements

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment (optional but recommended)

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Current env vars are used for Google Drive OAuth:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_GOOGLE_REDIRECT_URI`

API keys for model providers/search are configured in-app from:

- `Models & Providers` view (provider keys/models)
- `Connectors` view (search/tool integrations)

### 3. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` Start dev server
- `npm run build` Build production bundle
- `npm run start` Run production server
- `npm run lint` Run ESLint
- `npm run sync:litellm-metadata` Refresh `src/lib/litellm-chat-metadata.json` from LiteLLM

## MCP Notes

For MCP server setup example, see [MCP_SETUP.md](./MCP_SETUP.md).
For Google Workspace CLI MCP setup, including the required legacy version pin, see [GOOGLE_WORKSPACE_MCP.md](./GOOGLE_WORKSPACE_MCP.md).
