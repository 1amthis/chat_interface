/**
 * Memory Search - Main API
 *
 * Provides BM25-based search across previous conversations
 * stored in IndexedDB for fast, privacy-preserving client-side search.
 */

import { Conversation } from '@/types';
import { MemorySearchResult, SearchOptions, IndexStats } from './types';
import {
  indexConversation as dbIndexConversation,
  removeFromIndex as dbRemoveFromIndex,
  updateMetadata,
  needsReindex,
  getAllDocuments,
  getMetadata,
  getIndexStats as dbGetIndexStats,
  clearIndex,
} from './indexdb';
import { searchWithBM25 } from './bm25';

// Re-export types
export type { MemorySearchResult, SearchOptions, IndexStats } from './types';

// Debounce metadata updates to avoid excessive writes during streaming
let metadataUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
const METADATA_UPDATE_DELAY = 2000; // 2 seconds

/**
 * Search through previous conversations
 *
 * @param query - Search query string
 * @param options - Search options (limit, projectId, excludeConversationId)
 * @returns Array of search results sorted by relevance
 */
export async function searchMemory(
  query: string,
  options: SearchOptions = {}
): Promise<MemorySearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const [documents, metadata] = await Promise.all([
      getAllDocuments(),
      getMetadata(),
    ]);

    if (!metadata || documents.length === 0) {
      return [];
    }

    return searchWithBM25(query, documents, metadata, options);
  } catch (error) {
    console.error('Memory search error:', error);
    return [];
  }
}

/**
 * Update the search index with a conversation
 * Called automatically when conversations are saved
 *
 * @param conversation - The conversation to index
 */
export async function updateIndex(conversation: Conversation): Promise<void> {
  try {
    await dbIndexConversation(conversation);

    // Debounce metadata update
    if (metadataUpdateTimeout) {
      clearTimeout(metadataUpdateTimeout);
    }
    metadataUpdateTimeout = setTimeout(async () => {
      try {
        await updateMetadata();
      } catch (error) {
        console.error('Failed to update metadata:', error);
      }
    }, METADATA_UPDATE_DELAY);
  } catch (error) {
    console.error('Failed to update index:', error);
  }
}

/**
 * Remove a conversation from the search index
 * Called automatically when conversations are deleted
 *
 * @param conversationId - ID of the conversation to remove
 */
export async function removeFromIndex(conversationId: string): Promise<void> {
  try {
    await dbRemoveFromIndex(conversationId);

    // Debounce metadata update
    if (metadataUpdateTimeout) {
      clearTimeout(metadataUpdateTimeout);
    }
    metadataUpdateTimeout = setTimeout(async () => {
      try {
        await updateMetadata();
      } catch (error) {
        console.error('Failed to update metadata:', error);
      }
    }, METADATA_UPDATE_DELAY);
  } catch (error) {
    console.error('Failed to remove from index:', error);
  }
}

/**
 * Sync the index with current conversations
 * Indexes new/updated conversations, removes deleted ones
 *
 * @param conversations - All current conversations
 */
export async function syncIndex(conversations: Conversation[]): Promise<void> {
  try {
    const conversationIds = new Set(conversations.map(c => c.id));

    // Get current sync states
    const documents = await getAllDocuments();
    const indexedConversationIds = new Set(documents.map(d => d.conversationId));

    // Remove conversations that no longer exist
    for (const convId of indexedConversationIds) {
      if (!conversationIds.has(convId)) {
        await dbRemoveFromIndex(convId);
      }
    }

    // Index new or updated conversations
    for (const conv of conversations) {
      const needs = await needsReindex(conv.id, conv.updatedAt);
      if (needs) {
        await dbIndexConversation(conv);
      }
    }

    // Update metadata
    await updateMetadata();
  } catch (error) {
    console.error('Failed to sync index:', error);
  }
}

/**
 * Rebuild the entire search index from scratch
 *
 * @param conversations - All conversations to index
 */
export async function rebuildIndex(conversations: Conversation[]): Promise<void> {
  try {
    // Clear existing index
    await clearIndex();

    // Index all conversations
    for (const conv of conversations) {
      await dbIndexConversation(conv);
    }

    // Update metadata
    await updateMetadata();
  } catch (error) {
    console.error('Failed to rebuild index:', error);
    throw error;
  }
}

/**
 * Get index statistics for UI display
 */
export async function getIndexStats(): Promise<IndexStats> {
  try {
    return await dbGetIndexStats();
  } catch (error) {
    console.error('Failed to get index stats:', error);
    return {
      totalDocuments: 0,
      totalConversations: 0,
      lastUpdated: null,
    };
  }
}

/**
 * Format search results for display to the AI
 */
export function formatSearchResultsForAI(results: MemorySearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant past conversations found.';
  }

  let output = `Found ${results.length} relevant past conversation(s):\n\n`;

  results.forEach((result, index) => {
    const date = new Date(result.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const roleLabel = result.role === 'user' ? 'User' : 'Assistant';
    const relevance = Math.round(result.score * 10); // Simple score display

    output += `[${index + 1}] "${result.conversationTitle}" (${date})\n`;
    output += `    ${roleLabel}: ${result.snippet}\n`;
    output += `    Relevance score: ${relevance}\n\n`;
  });

  return output.trim();
}
