// Shared tool schemas used by provider adapters and UI catalog views.

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export const WEB_SEARCH_SCHEMA: ToolSchema = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date information, facts you are not certain about, or when the user asks about recent events, news, or anything that might have changed after your knowledge cutoff.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web',
      },
    },
    required: ['query'],
  },
};

export const GOOGLE_DRIVE_SCHEMA: ToolSchema = {
  name: 'google_drive_search',
  description: 'Search files in the user\'s Google Drive. Use this when the user asks about their documents, files, spreadsheets, presentations, or any content stored in their Google Drive. This searches file names and content.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find files in Google Drive',
      },
    },
    required: ['query'],
  },
};

export const MEMORY_SEARCH_SCHEMA: ToolSchema = {
  name: 'memory_search',
  description: 'Search through previous conversations to find relevant context, information, or discussions. Use this when the user references something from a past conversation, asks about previous discussions, or when you need to recall information that may have been discussed before.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant past conversations. Be specific and use keywords that are likely to appear in the content.',
      },
    },
    required: ['query'],
  },
};

export const RAG_SEARCH_SCHEMA: ToolSchema = {
  name: 'rag_search',
  description: 'Search through user-uploaded documents for relevant information. Use this when the user asks about content from their uploaded files, documents, or knowledge base. This performs semantic search across all uploaded documents.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant content in uploaded documents. Use natural language to describe what you are looking for.',
      },
    },
    required: ['query'],
  },
};

export const CREATE_ARTIFACT_SCHEMA: ToolSchema = {
  name: 'create_artifact',
  description: 'Create a new artifact. Supported types: code, html, react, markdown, svg, mermaid, document, spreadsheet, presentation. Use this for substantial, self-contained content that benefits from a dedicated preview panel. Do NOT use this for short code snippets shown inline in conversation.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'The artifact type.',
        enum: ['code', 'html', 'react', 'markdown', 'svg', 'mermaid', 'document', 'spreadsheet', 'presentation'],
      },
      title: {
        type: 'string',
        description: 'A short descriptive title for the artifact',
      },
      content: {
        type: 'string',
        description: 'The full content of the artifact. For document: markdown or JSON blocks/sections. For spreadsheet: CSV/TSV, markdown table, array-of-objects JSON, or {sheets:{...}} JSON. For presentation: JSON {"theme":{...},"slides":[{"layout":"title","title":"..."},{"layout":"title-content","title":"...","bullets":[...]},...]} for rich output, or markdown with --- slide breaks for basic output.',
      },
      language: {
        type: 'string',
        description: 'Programming language for code artifacts (e.g. "python", "javascript", "typescript"). Only needed when type is "code".',
      },
      output_format: {
        type: 'string',
        description: 'Optional preferred file format for export/download.',
        enum: ['source', 'docx', 'pdf', 'xlsx', 'pptx'],
      },
    },
    required: ['type', 'title', 'content'],
  },
};

export const UPDATE_ARTIFACT_SCHEMA: ToolSchema = {
  name: 'update_artifact',
  description: 'Update an existing artifact with new content. Always provide the complete updated content, not a diff. Use read_artifact first if you need to see the current content. You may optionally update output_format.',
  parameters: {
    type: 'object',
    properties: {
      artifact_id: {
        type: 'string',
        description: 'The ID of the artifact to update',
      },
      content: {
        type: 'string',
        description: 'The complete new content for the artifact (not a diff). Same supported formats as create_artifact.',
      },
      title: {
        type: 'string',
        description: 'Optional new title for the artifact',
      },
      output_format: {
        type: 'string',
        description: 'Optional preferred file format for export/download.',
        enum: ['source', 'docx', 'pdf', 'xlsx', 'pptx'],
      },
    },
    required: ['artifact_id', 'content'],
  },
};

export const READ_ARTIFACT_SCHEMA: ToolSchema = {
  name: 'read_artifact',
  description: 'Read the current content of an existing artifact. Use this before update_artifact if the artifact content is not in the recent conversation context.',
  parameters: {
    type: 'object',
    properties: {
      artifact_id: {
        type: 'string',
        description: 'The ID of the artifact to read',
      },
    },
    required: ['artifact_id'],
  },
};

export const ARTIFACT_TOOL_NAMES = ['create_artifact', 'update_artifact', 'read_artifact'];
