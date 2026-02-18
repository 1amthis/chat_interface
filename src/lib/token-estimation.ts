/**
 * Simple token estimation utility.
 * Uses ~4 characters per token as a rough approximation.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
