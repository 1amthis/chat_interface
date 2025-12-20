import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { UnifiedTool, ToolSource, Provider } from '@/types';
import type { MCPCallToolResult } from './types';

/**
 * Parse a potentially prefixed tool name to extract source and original name
 * Formats: "toolname", "builtin_toolname", "mcp_serverId_toolname"
 */
export function parseToolName(fullName: string): {
  source: ToolSource | 'other';
  name: string;
  serverId?: string;
} {
  if (fullName.startsWith('mcp_')) {
    const parts = fullName.split('_');
    if (parts.length >= 3) {
      const serverId = parts[1];
      const name = parts.slice(2).join('_');
      return { source: 'mcp', name, serverId };
    }
    // Fallback if format is unexpected
    return { source: 'mcp', name: fullName.slice(4) };
  }

  if (fullName.startsWith('builtin_')) {
    return { source: 'builtin', name: fullName.slice(8) };
  }

  if (fullName === 'web_search') {
    return { source: 'web_search', name: fullName };
  }

  if (fullName === 'google_drive_search') {
    return { source: 'google_drive', name: fullName };
  }

  // Default: unknown source
  return { source: 'other', name: fullName };
}

/**
 * Convert UnifiedTool array to OpenAI ChatCompletionTool format
 * Adds prefixes to tool names for routing
 */
export function toOpenAITools(tools: UnifiedTool[]): OpenAI.ChatCompletionTool[] {
  return tools.map((tool) => {
    // Create namespaced tool name
    const toolName =
      tool.source === 'mcp' && tool.serverId
        ? `mcp_${tool.serverId}_${tool.name}`
        : tool.source === 'builtin'
        ? `builtin_${tool.name}`
        : tool.name;

    return {
      type: 'function',
      function: {
        name: toolName,
        description: tool.description,
        parameters: tool.parameters as OpenAI.FunctionParameters,
      },
    };
  });
}

/**
 * Convert UnifiedTool array to Anthropic Tool format
 * Adds prefixes to tool names for routing
 */
export function toAnthropicTools(tools: UnifiedTool[]): Anthropic.Tool[] {
  return tools.map((tool) => {
    // Create namespaced tool name
    const toolName =
      tool.source === 'mcp' && tool.serverId
        ? `mcp_${tool.serverId}_${tool.name}`
        : tool.source === 'builtin'
        ? `builtin_${tool.name}`
        : tool.name;

    return {
      name: toolName,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema,
    };
  });
}

/**
 * Convert UnifiedTool array to Gemini function declarations format
 * Adds prefixes to tool names for routing
 */
export function toGeminiTools(tools: UnifiedTool[]): {
  functionDeclarations: Array<Record<string, unknown>>;
} {
  const functionDeclarations = tools.map((tool) => {
    // Create namespaced tool name
    const toolName =
      tool.source === 'mcp' && tool.serverId
        ? `mcp_${tool.serverId}_${tool.name}`
        : tool.source === 'builtin'
        ? `builtin_${tool.name}`
        : tool.name;

    return {
      name: toolName,
      description: tool.description,
      parameters: tool.parameters,
    };
  });

  return { functionDeclarations };
}

/**
 * Format MCP tool result for display to user or inclusion in LLM context
 */
export function formatMCPResultForProvider(
  result: MCPCallToolResult,
  provider: Provider
): string {
  if (result.isError) {
    const errorText = result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    return `Error: ${errorText}`;
  }

  // Extract text content
  const textBlocks: string[] = [];

  for (const block of result.content) {
    if (block.type === 'text' && block.text) {
      textBlocks.push(block.text);
    } else if (block.type === 'resource' && block.resource) {
      // Include resource information
      const resource = block.resource;
      if (resource.text) {
        textBlocks.push(`[Resource: ${resource.uri}]\n${resource.text}`);
      } else if (resource.blob) {
        textBlocks.push(`[Resource: ${resource.uri}] (Binary data: ${resource.mimeType || 'unknown'})`);
      }
    } else if (block.type === 'image' && block.data) {
      textBlocks.push(`[Image data: ${block.mimeType || 'image/*'}]`);
    }
  }

  return textBlocks.join('\n\n');
}
