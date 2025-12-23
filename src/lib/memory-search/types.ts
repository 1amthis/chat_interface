/**
 * Types for the memory search feature
 */

// Document stored in IndexedDB for BM25 search
export interface IndexedDocument {
  id: string; // Composite: ${conversationId}:${messageId}
  conversationId: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  terms: string[];
  termFrequencies: Record<string, number>;
  length: number; // Term count
  timestamp: number;
  conversationTitle: string;
  projectId?: string;
}

// Global BM25 statistics stored in IndexedDB
export interface IndexMetadata {
  id: 'global';
  totalDocuments: number;
  avgDocumentLength: number;
  documentFrequencies: Record<string, number>; // DF for each term
  lastUpdated: number;
  version: string;
}

// Tracks which conversations are indexed
export interface SyncState {
  conversationId: string;
  lastIndexedAt: number;
  messageCount: number;
  updatedAt: number;
}

// Search result returned to the caller
export interface MemorySearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  score: number;
  snippet: string;
  projectId?: string;
}

// Search options
export interface SearchOptions {
  limit?: number;
  projectId?: string;
  excludeConversationId?: string;
  minScore?: number;
}

// Index statistics for UI display
export interface IndexStats {
  totalDocuments: number;
  totalConversations: number;
  lastUpdated: number | null;
}
