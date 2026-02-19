/**
 * Google Gemini provider implementation
 */

import { ChatMessage, StreamChunk, ToolCallInfo, ToolExecutionResult } from '../types';
import { UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';
import { toGeminiTools, parseToolName } from '@/lib/mcp/tool-converter';
import { toolCallLimitReached, generateGeminiToolCallId } from '../base';
import { geminiWebSearchDeclaration, geminiGoogleDriveDeclaration, geminiMemorySearchDeclaration, geminiRAGSearchDeclaration, geminiCreateArtifactDeclaration, geminiUpdateArtifactDeclaration, geminiReadArtifactDeclaration } from '../tools/definitions';
import { isArtifactTool } from '../base';
import { toGeminiParts } from './content';

/**
 * Stream chat using Google Gemini API
 */
export async function* streamGoogle(
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
  systemPrompt?: string,
  webSearchEnabled?: boolean,
  searchResults?: WebSearchResponse,
  googleDriveEnabled?: boolean,
  driveSearchResults?: GoogleDriveSearchResponse,
  memorySearchEnabled?: boolean,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[],
  ragEnabled?: boolean,
  artifactsEnabled?: boolean,
  temperature?: number,
  maxOutputTokens?: number,
  googleThinkingEnabled?: boolean,
  googleThinkingBudget?: number,
  googleThinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
): AsyncGenerator<StreamChunk> {
  if (!apiKey) throw new Error('Google Gemini API key is required');

  const contents: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content }],
      });
    } else {
      contents.push({
        role: 'user',
        parts: toGeminiParts(msg),
      });
    }
  }

  // If there are tool executions, add them using Gemini's function call/response format
  // Use originalToolName (prefixed) when available to match registered tool names
  // Only Gemini 3 models require thoughtSignature (at part level, not inside functionCall)
  const isGemini3 = model.includes('gemini-3');

  if (toolExecutions && toolExecutions.length > 0) {
    contents.push({
      role: 'model',
      parts: toolExecutions.map((te) => {
        const part: Record<string, unknown> = {
          functionCall: {
            name: te.originalToolName || te.toolName,
            args: te.toolParams,
          },
        };
        // Gemini 3 requires thoughtSignature at part level (sibling to functionCall)
        // Use captured signature or dummy value to bypass validation
        if (isGemini3) {
          if (!te.geminiThoughtSignature) {
            console.warn(
              `[Gemini] No thought signature available for tool "${te.toolName}", using dummy signature`
            );
          }
          part.thoughtSignature = te.geminiThoughtSignature || 'skip_thought_signature_validator';
        }
        return part;
      }),
    });

    contents.push({
      role: 'user',
      parts: toolExecutions.map((te) => ({
        functionResponse: {
          name: te.originalToolName || te.toolName,
          response: {
            content: te.result,
            isError: te.isError,
          },
        },
      })),
    });
  }

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxOutputTokens || 4096,
  };
  if (temperature !== undefined) {
    generationConfig.temperature = temperature;
  }

  // Gemini 2.5+ models think by default. Always request thought summaries
  // so they appear in the UI. The thinkingEnabled toggle and budget/level
  // settings control HOW much thinking happens, not whether we see it.
  const isThinkingCapable = model.includes('gemini-2.5') || model.includes('gemini-3');

  if (isThinkingCapable) {
    const thinkingConfig: Record<string, unknown> = {
      includeThoughts: true,
    };

    if (googleThinkingEnabled) {
      if (isGemini3 && googleThinkingLevel) {
        thinkingConfig.thinkingLevel = googleThinkingLevel.toUpperCase();
      } else if (!isGemini3 && googleThinkingBudget !== undefined) {
        thinkingConfig.thinkingBudget = googleThinkingBudget;
      }
    }

    generationConfig.thinkingConfig = thinkingConfig;
  }

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  // Build tools array based on enabled features and MCP tools
  // Per-tool call limit prevents loops while allowing multiple calls with different queries
  const functionDeclarations: Array<Record<string, unknown>> = [];

  if (webSearchEnabled && !searchResults && !toolCallLimitReached('web_search', toolExecutions)) {
    functionDeclarations.push(geminiWebSearchDeclaration);
  }
  if (googleDriveEnabled && !driveSearchResults && !toolCallLimitReached('google_drive_search', toolExecutions)) {
    functionDeclarations.push(geminiGoogleDriveDeclaration);
  }
  if (memorySearchEnabled && !toolCallLimitReached('memory_search', toolExecutions)) {
    functionDeclarations.push(geminiMemorySearchDeclaration);
  }
  if (ragEnabled && !toolCallLimitReached('rag_search', toolExecutions)) {
    functionDeclarations.push(geminiRAGSearchDeclaration);
  }
  // Add MCP/builtin tools (with per-tool call limit to prevent loops)
  if (mcpTools && mcpTools.length > 0) {
    const filteredMcpTools = mcpTools.filter(t => !toolCallLimitReached(t.name, toolExecutions));
    if (filteredMcpTools.length > 0) {
      functionDeclarations.push(...toGeminiTools(filteredMcpTools).functionDeclarations);
    }
  }
  // Artifact tools (enabled by default, can be toggled off)
  if (artifactsEnabled !== false) {
    functionDeclarations.push(geminiCreateArtifactDeclaration, geminiUpdateArtifactDeclaration, geminiReadArtifactDeclaration);
  }

  if (functionDeclarations.length > 0) {
    requestBody.tools = [{ functionDeclarations }];
    requestBody.toolConfig = {
      functionCallingConfig: { mode: 'AUTO' },
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google Gemini API error: ${response.status} ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  const handleChunk = (chunkObj: Record<string, unknown>): StreamChunk[] => {
    const emitted: StreamChunk[] = [];

    const usage = chunkObj.usageMetadata as Record<string, number> | undefined;
    if (usage) {
      inputTokens = usage.promptTokenCount || inputTokens;
      outputTokens = usage.candidatesTokenCount || outputTokens;
      totalTokens = usage.totalTokenCount || totalTokens;
    }

    const candidates = (chunkObj.candidates as Array<Record<string, unknown>>) || [];
    for (const candidate of candidates) {
      const content = candidate.content as Record<string, unknown> | undefined;
      const parts = (content?.parts as Array<Record<string, unknown>>) || [];

      const toolCallsInCandidate: ToolCallInfo[] = [];

      for (const part of parts) {
        // Handle thinking/thought parts from Gemini models
        if (part.thought === true && part.text) {
          emitted.push({ type: 'reasoning', reasoning: part.text as string });
          continue;
        }

        const text = part.text as string | undefined;
        if (text) {
          emitted.push({ type: 'content', content: text });
        }

        const functionCall = part.functionCall as Record<string, unknown> | undefined;
        if (functionCall && functionCall.name) {
          const rawName = functionCall.name as string;
          let args: unknown = functionCall.args ?? functionCall.arguments ?? {};
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch {
              args = {};
            }
          }

          // Capture thoughtSignature for Gemini 3 models (at part level, camelCase)
          const thoughtSignature = part.thoughtSignature as string | undefined;

          const parsed = parseToolName(rawName);
          const id = generateGeminiToolCallId();
          const params = (args as Record<string, unknown>) || {};

          if (parsed.source === 'mcp') {
            toolCallsInCandidate.push({
              id,
              name: parsed.name,
              originalName: rawName, // Keep prefixed name for API
              params,
              source: 'mcp',
              serverId: parsed.serverId,
              thoughtSignature,
            });
          } else if (parsed.source === 'builtin') {
            toolCallsInCandidate.push({
              id,
              name: parsed.name,
              originalName: rawName, // Keep prefixed name for API
              params,
              source: 'builtin',
              thoughtSignature,
            });
          } else if (rawName === 'web_search') {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'web_search',
              thoughtSignature,
            });
          } else if (rawName === 'google_drive_search') {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'google_drive',
              thoughtSignature,
            });
          } else if (rawName === 'memory_search') {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'memory_search',
              thoughtSignature,
            });
          } else if (rawName === 'rag_search') {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'rag_search',
              thoughtSignature,
            });
          } else if (isArtifactTool(rawName)) {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              source: 'artifact',
              thoughtSignature,
            });
          } else {
            toolCallsInCandidate.push({
              id,
              name: rawName,
              originalName: rawName,
              params,
              thoughtSignature,
            });
          }
        }
      }

      if (toolCallsInCandidate.length === 1) {
        const tc = toolCallsInCandidate[0];
        emitted.push({
          type: 'tool_call',
          toolName: tc.name,
          originalToolName: tc.originalName, // Keep prefixed name for API
          toolParams: tc.params,
          toolSource: tc.source,
          toolServerId: tc.serverId,
          toolThinkingSignature: tc.thoughtSignature, // Gemini 3 thought signature
        });
      } else if (toolCallsInCandidate.length > 1) {
        emitted.push({
          type: 'tool_calls',
          toolCalls: toolCallsInCandidate,
        });
      }
    }

    return emitted;
  };

  const processLine = (dataLine: string) => {
    try {
      const chunkObj = JSON.parse(dataLine) as Record<string, unknown>;
      return handleChunk(chunkObj);
    } catch {
      return [];
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;
      if (line.startsWith('event:')) continue;

      let dataLine = line;
      if (dataLine.startsWith('data:')) {
        dataLine = dataLine.slice(5).trim();
      }
      if (!dataLine || dataLine === '[DONE]') continue;

      for (const emitted of processLine(dataLine)) {
        yield emitted;
      }
    }
  }

  // Flush any remaining buffer
  const remaining = buffer.trim();
  if (remaining) {
    for (const emitted of processLine(remaining)) {
      yield emitted;
    }
  }

  if (inputTokens || outputTokens || totalTokens) {
    yield {
      type: 'usage',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: totalTokens || inputTokens + outputTokens,
      },
    };
  }
}
