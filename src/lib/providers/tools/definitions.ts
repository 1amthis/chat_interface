/**
 * Tool definitions - single source of truth for tool schemas
 * These are converted to provider-specific formats by the converter functions
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Base tool schema (provider-agnostic)
export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

// Web search tool schema
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

// Google Drive search tool schema
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

// Memory search tool schema
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

// RAG search tool schema
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

// OpenAI format tools
export const openAIWebSearchTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: WEB_SEARCH_SCHEMA.name,
    description: WEB_SEARCH_SCHEMA.description,
    parameters: WEB_SEARCH_SCHEMA.parameters,
  },
};

export const openAIGoogleDriveTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: GOOGLE_DRIVE_SCHEMA.name,
    description: GOOGLE_DRIVE_SCHEMA.description,
    parameters: GOOGLE_DRIVE_SCHEMA.parameters,
  },
};

export const openAIMemorySearchTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: MEMORY_SEARCH_SCHEMA.name,
    description: MEMORY_SEARCH_SCHEMA.description,
    parameters: MEMORY_SEARCH_SCHEMA.parameters,
  },
};

export const openAIRAGSearchTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: RAG_SEARCH_SCHEMA.name,
    description: RAG_SEARCH_SCHEMA.description,
    parameters: RAG_SEARCH_SCHEMA.parameters,
  },
};

// Anthropic format tools
export const anthropicWebSearchTool: Anthropic.Tool = {
  name: WEB_SEARCH_SCHEMA.name,
  description: WEB_SEARCH_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: WEB_SEARCH_SCHEMA.parameters.properties,
    required: WEB_SEARCH_SCHEMA.parameters.required,
  },
};

export const anthropicGoogleDriveTool: Anthropic.Tool = {
  name: GOOGLE_DRIVE_SCHEMA.name,
  description: GOOGLE_DRIVE_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: GOOGLE_DRIVE_SCHEMA.parameters.properties,
    required: GOOGLE_DRIVE_SCHEMA.parameters.required,
  },
};

export const anthropicMemorySearchTool: Anthropic.Tool = {
  name: MEMORY_SEARCH_SCHEMA.name,
  description: MEMORY_SEARCH_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: MEMORY_SEARCH_SCHEMA.parameters.properties,
    required: MEMORY_SEARCH_SCHEMA.parameters.required,
  },
};

export const anthropicRAGSearchTool: Anthropic.Tool = {
  name: RAG_SEARCH_SCHEMA.name,
  description: RAG_SEARCH_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: RAG_SEARCH_SCHEMA.parameters.properties,
    required: RAG_SEARCH_SCHEMA.parameters.required,
  },
};

// Gemini format tools
export const geminiWebSearchDeclaration = {
  name: WEB_SEARCH_SCHEMA.name,
  description: WEB_SEARCH_SCHEMA.description,
  parameters: WEB_SEARCH_SCHEMA.parameters,
};

export const geminiGoogleDriveDeclaration = {
  name: GOOGLE_DRIVE_SCHEMA.name,
  description: GOOGLE_DRIVE_SCHEMA.description,
  parameters: GOOGLE_DRIVE_SCHEMA.parameters,
};

export const geminiMemorySearchDeclaration = {
  name: MEMORY_SEARCH_SCHEMA.name,
  description: MEMORY_SEARCH_SCHEMA.description,
  parameters: MEMORY_SEARCH_SCHEMA.parameters,
};

export const geminiRAGSearchDeclaration = {
  name: RAG_SEARCH_SCHEMA.name,
  description: RAG_SEARCH_SCHEMA.description,
  parameters: RAG_SEARCH_SCHEMA.parameters,
};

// Responses API format tools (for OpenAI reasoning models)
export function toResponsesAPIWebSearchTool() {
  return {
    type: 'function',
    name: WEB_SEARCH_SCHEMA.name,
    description: WEB_SEARCH_SCHEMA.description,
    parameters: {
      ...WEB_SEARCH_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}

export function toResponsesAPIGoogleDriveTool() {
  return {
    type: 'function',
    name: GOOGLE_DRIVE_SCHEMA.name,
    description: GOOGLE_DRIVE_SCHEMA.description,
    parameters: {
      ...GOOGLE_DRIVE_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}

export function toResponsesAPIMemorySearchTool() {
  return {
    type: 'function',
    name: MEMORY_SEARCH_SCHEMA.name,
    description: MEMORY_SEARCH_SCHEMA.description,
    parameters: {
      ...MEMORY_SEARCH_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}

export function toResponsesAPIRAGSearchTool() {
  return {
    type: 'function',
    name: RAG_SEARCH_SCHEMA.name,
    description: RAG_SEARCH_SCHEMA.description,
    parameters: {
      ...RAG_SEARCH_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}
