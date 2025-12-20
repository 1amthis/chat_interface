/**
 * Ollama provider implementation
 */

import { ChatMessage, StreamChunk, ToolExecutionResult } from '../types';
import { UnifiedTool, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';

/**
 * Stream chat using Ollama API
 * Note: Ollama doesn't have standard tool support, so tool results are injected into system prompt
 */
export async function* streamOllama(
  messages: ChatMessage[],
  model: string,
  baseUrl: string,
  systemPrompt?: string,
  searchResults?: WebSearchResponse,
  driveSearchResults?: GoogleDriveSearchResponse,
  mcpTools?: UnifiedTool[],
  toolExecutions?: ToolExecutionResult[]
): AsyncGenerator<StreamChunk> {
  // Note: Ollama doesn't have standard tool result format, so we inject tool results
  // into the system prompt as context. This is a limitation of Ollama.
  const allMessages: { role: string; content: string; images?: string[] }[] = [];

  // Build system prompt - for Ollama we inject tool results here since it lacks proper tool support
  let fullSystemPrompt = systemPrompt || '';
  if (toolExecutions && toolExecutions.length > 0) {
    const toolContext = toolExecutions.map(te =>
      `Tool "${te.toolName}" returned:\n${te.result}`
    ).join('\n\n');
    fullSystemPrompt = fullSystemPrompt
      ? `${fullSystemPrompt}\n\n## Tool Results\n\n${toolContext}`
      : `## Tool Results\n\n${toolContext}`;
  }

  if (fullSystemPrompt) {
    allMessages.push({ role: 'system', content: fullSystemPrompt });
  }

  for (const msg of messages) {
    const attachments = msg.attachments || [];
    const imageAttachments = attachments.filter((a) => a.type === 'image');
    const fileAttachments = attachments.filter((a) => a.type === 'file');

    // Build content with file attachments
    let content = msg.content;
    for (const file of fileAttachments) {
      try {
        const textContent = atob(file.data);
        content += `\n\n[File: ${file.name}]\n${textContent}`;
      } catch {
        content += `\n\n[File: ${file.name}] (Unable to decode content)`;
      }
    }

    // Add images array for Ollama (if using vision-capable model)
    const images = imageAttachments.map((img) => img.data);

    allMessages.push({
      role: msg.role,
      content,
      ...(images.length > 0 && { images }),
    });
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let promptEvalCount = 0;
  let evalCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield { type: 'content', content: data.message.content };
        }
        // Ollama sends token counts in the final message
        if (data.done && data.prompt_eval_count !== undefined) {
          promptEvalCount = data.prompt_eval_count || 0;
          evalCount = data.eval_count || 0;
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  // Send final usage if we got token counts
  if (promptEvalCount > 0 || evalCount > 0) {
    yield {
      type: 'usage',
      usage: {
        inputTokens: promptEvalCount,
        outputTokens: evalCount,
        totalTokens: promptEvalCount + evalCount,
      },
    };
  }
}
