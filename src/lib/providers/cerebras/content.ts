/**
 * Cerebras content conversion utilities
 * Cerebras uses the same message format as OpenAI, so we re-export directly.
 */

export { toOpenAIContent as toCerebrasContent } from '../openai/content';
