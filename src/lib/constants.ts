/**
 * Application-wide constants
 */

// Tool execution limits
export const MAX_TOOL_RECURSION_DEPTH = 10;

// API retry configuration
export const API_CONFIG = {
  SEARCH_RETRIES: 2,
  RETRY_DELAY_BASE_MS: 500,
} as const;

// Storage limits
export const STORAGE_LIMITS = {
  MAX_TOTAL_SIZE: 4 * 1024 * 1024, // 4MB total localStorage budget
  MAX_CONVERSATION_SIZE: 500 * 1024, // 500KB per conversation
  MAX_CONVERSATIONS: 50,
} as const;

// File upload limits (re-exported from utils for convenience)
export { MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES, ACCEPTED_FILE_TYPES } from './utils/file';

// Streaming configuration
export const STREAMING_CONFIG = {
  SCROLL_THRESHOLD: 100, // pixels from bottom to consider "near bottom"
} as const;
