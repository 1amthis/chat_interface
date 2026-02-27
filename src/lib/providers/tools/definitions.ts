/**
 * Tool definitions - single source of truth for tool schemas
 * These are converted to provider-specific formats by the converter functions
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  ARTIFACT_TOOL_NAMES,
  CREATE_ARTIFACT_SCHEMA,
  GOOGLE_DRIVE_SCHEMA,
  MEMORY_SEARCH_SCHEMA,
  RAG_SEARCH_SCHEMA,
  READ_ARTIFACT_SCHEMA,
  UPDATE_ARTIFACT_SCHEMA,
  WEB_SEARCH_SCHEMA,
} from './schemas';

export {
  ARTIFACT_TOOL_NAMES,
  CREATE_ARTIFACT_SCHEMA,
  GOOGLE_DRIVE_SCHEMA,
  MEMORY_SEARCH_SCHEMA,
  RAG_SEARCH_SCHEMA,
  READ_ARTIFACT_SCHEMA,
  UPDATE_ARTIFACT_SCHEMA,
  WEB_SEARCH_SCHEMA,
};
export type { ToolSchema } from './schemas';

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

// OpenAI format artifact tools
export const openAICreateArtifactTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: CREATE_ARTIFACT_SCHEMA.name,
    description: CREATE_ARTIFACT_SCHEMA.description,
    parameters: CREATE_ARTIFACT_SCHEMA.parameters,
  },
};

export const openAIUpdateArtifactTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: UPDATE_ARTIFACT_SCHEMA.name,
    description: UPDATE_ARTIFACT_SCHEMA.description,
    parameters: UPDATE_ARTIFACT_SCHEMA.parameters,
  },
};

export const openAIReadArtifactTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: READ_ARTIFACT_SCHEMA.name,
    description: READ_ARTIFACT_SCHEMA.description,
    parameters: READ_ARTIFACT_SCHEMA.parameters,
  },
};

// Anthropic format artifact tools
export const anthropicCreateArtifactTool: Anthropic.Tool = {
  name: CREATE_ARTIFACT_SCHEMA.name,
  description: CREATE_ARTIFACT_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: CREATE_ARTIFACT_SCHEMA.parameters.properties,
    required: CREATE_ARTIFACT_SCHEMA.parameters.required,
  },
};

export const anthropicUpdateArtifactTool: Anthropic.Tool = {
  name: UPDATE_ARTIFACT_SCHEMA.name,
  description: UPDATE_ARTIFACT_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: UPDATE_ARTIFACT_SCHEMA.parameters.properties,
    required: UPDATE_ARTIFACT_SCHEMA.parameters.required,
  },
};

export const anthropicReadArtifactTool: Anthropic.Tool = {
  name: READ_ARTIFACT_SCHEMA.name,
  description: READ_ARTIFACT_SCHEMA.description,
  input_schema: {
    type: 'object' as const,
    properties: READ_ARTIFACT_SCHEMA.parameters.properties,
    required: READ_ARTIFACT_SCHEMA.parameters.required,
  },
};

// Gemini format artifact tools
export const geminiCreateArtifactDeclaration = {
  name: CREATE_ARTIFACT_SCHEMA.name,
  description: CREATE_ARTIFACT_SCHEMA.description,
  parameters: CREATE_ARTIFACT_SCHEMA.parameters,
};

export const geminiUpdateArtifactDeclaration = {
  name: UPDATE_ARTIFACT_SCHEMA.name,
  description: UPDATE_ARTIFACT_SCHEMA.description,
  parameters: UPDATE_ARTIFACT_SCHEMA.parameters,
};

export const geminiReadArtifactDeclaration = {
  name: READ_ARTIFACT_SCHEMA.name,
  description: READ_ARTIFACT_SCHEMA.description,
  parameters: READ_ARTIFACT_SCHEMA.parameters,
};

// Responses API format artifact tools (for OpenAI reasoning models)
export function toResponsesAPICreateArtifactTool() {
  return {
    type: 'function',
    name: CREATE_ARTIFACT_SCHEMA.name,
    description: CREATE_ARTIFACT_SCHEMA.description,
    parameters: {
      ...CREATE_ARTIFACT_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}

export function toResponsesAPIUpdateArtifactTool() {
  return {
    type: 'function',
    name: UPDATE_ARTIFACT_SCHEMA.name,
    description: UPDATE_ARTIFACT_SCHEMA.description,
    parameters: {
      ...UPDATE_ARTIFACT_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}

export function toResponsesAPIReadArtifactTool() {
  return {
    type: 'function',
    name: READ_ARTIFACT_SCHEMA.name,
    description: READ_ARTIFACT_SCHEMA.description,
    parameters: {
      ...READ_ARTIFACT_SCHEMA.parameters,
      additionalProperties: false,
    },
  };
}

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
