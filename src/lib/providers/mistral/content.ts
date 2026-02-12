/**
 * Mistral content conversion utilities
 * Mistral uses the same message format as OpenAI, so we re-export directly.
 */

export { toOpenAIContent as toMistralContent } from '../openai/content';
