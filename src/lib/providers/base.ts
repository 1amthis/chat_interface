/**
 * Shared utilities for all providers
 */

/**
 * Merge system prompts: global + project + conversation
 * Returns merged prompt with proper formatting
 */
export function mergeSystemPrompts(
  globalPrompt?: string,
  projectInstructions?: string,
  conversationPrompt?: string
): string | undefined {
  const parts: string[] = [];

  if (globalPrompt?.trim()) {
    parts.push(globalPrompt.trim());
  }

  if (projectInstructions?.trim()) {
    parts.push(projectInstructions.trim());
  }

  if (conversationPrompt?.trim()) {
    parts.push(conversationPrompt.trim());
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * Check if a model should use the OpenAI Responses API for reasoning summaries
 */
export function isOpenAIReasoningModel(model: string): boolean {
  return /^gpt-5(\b|[.-])/.test(model) || /^o[134]/.test(model) || model.includes('o1-') || model.includes('o3-') || model.includes('o4-');
}

/**
 * Check if a tool has already been executed in this turn
 */
export function hasToolBeenExecuted(
  toolName: string,
  toolExecutions?: { toolName: string; originalToolName?: string }[]
): boolean {
  return toolExecutions?.some(
    te => te.toolName === toolName || te.originalToolName === toolName
  ) ?? false;
}

/**
 * Generate a unique tool call ID for Gemini (which doesn't provide one)
 */
export function generateGeminiToolCallId(): string {
  return `gc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
