/**
 * BM25 ranking algorithm implementation
 * BM25 (Best Matching 25) is a bag-of-words retrieval function
 */

import { IndexedDocument, IndexMetadata, MemorySearchResult } from './types';
import { tokenize } from './tokenizer';

/**
 * Calculate BM25 score for a single document against a query
 * @param k1 - Term frequency saturation (1.2-2.0 typical)
 * @param b  - Document length normalization (0.75 typical)
 */
export function calculateBM25Score(
  queryTerms: string[],
  doc: IndexedDocument,
  metadata: IndexMetadata,
  k1: number = 1.2,
  b: number = 0.75
): number {
  let score = 0;
  const N = metadata.totalDocuments;
  const avgDl = metadata.avgDocumentLength;
  const dl = doc.length;

  for (const term of queryTerms) {
    const tf = doc.termFrequencies[term] || 0;
    if (tf === 0) continue;

    const df = metadata.documentFrequencies[term] || 0;

    // IDF: Inverse Document Frequency
    // Using the standard BM25 IDF formula
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

    // TF component with saturation and length normalization
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (dl / avgDl));

    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Generate a snippet from document content around matching terms
 */
export function generateSnippet(
  content: string,
  queryTerms: string[],
  maxLength: number = 150
): string {
  if (!content || content.length === 0) {
    return '';
  }

  const lowerContent = content.toLowerCase();
  const querySet = new Set(queryTerms.map(t => t.toLowerCase()));

  // Find the best position - where query terms appear
  let bestPos = 0;
  let bestScore = 0;

  // Check each word position
  const words = content.split(/\s+/);
  let charPos = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[^\w]/g, '');
    let score = 0;

    // Score based on how many query terms are nearby (within 10 words)
    for (let j = Math.max(0, i - 5); j < Math.min(words.length, i + 5); j++) {
      const nearbyWord = words[j].toLowerCase().replace(/[^\w]/g, '');
      if (querySet.has(nearbyWord)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPos = charPos;
    }

    charPos += words[i].length + 1; // +1 for space
  }

  // Extract snippet around best position
  let start = Math.max(0, bestPos - Math.floor(maxLength / 3));
  let end = Math.min(content.length, start + maxLength);

  // Adjust to word boundaries
  if (start > 0) {
    const nextSpace = content.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace < start + 20) {
      start = nextSpace + 1;
    }
  }

  if (end < content.length) {
    const lastSpace = content.lastIndexOf(' ', end);
    if (lastSpace > end - 20) {
      end = lastSpace;
    }
  }

  let snippet = content.slice(start, end).trim();

  // Add ellipsis if truncated
  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < content.length) {
    snippet = snippet + '...';
  }

  return snippet;
}

/**
 * Search documents using BM25 ranking
 */
export function searchWithBM25(
  query: string,
  documents: IndexedDocument[],
  metadata: IndexMetadata,
  options: {
    limit?: number;
    projectId?: string;
    excludeConversationId?: string;
    minScore?: number;
    snippetLength?: number;
    k1?: number;
    b?: number;
  } = {}
): MemorySearchResult[] {
  const {
    limit = 5,
    projectId,
    excludeConversationId,
    minScore = 0.1,
    snippetLength = 150,
    k1 = 1.2,
    b = 0.75,
  } = options;

  // Tokenize query
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return [];
  }

  // Score all documents
  const scored: Array<{ doc: IndexedDocument; score: number }> = [];

  for (const doc of documents) {
    // Apply filters
    if (excludeConversationId && doc.conversationId === excludeConversationId) {
      continue;
    }
    if (projectId && doc.projectId !== projectId) {
      continue;
    }

    const score = calculateBM25Score(queryTerms, doc, metadata, k1, b);
    if (score >= minScore) {
      scored.push({ doc, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top results and convert to MemorySearchResult
  return scored.slice(0, limit).map(({ doc, score }) => ({
    conversationId: doc.conversationId,
    conversationTitle: doc.conversationTitle,
    messageId: doc.messageId,
    role: doc.role,
    content: doc.content,
    timestamp: doc.timestamp,
    score,
    snippet: generateSnippet(doc.content, queryTerms, snippetLength),
    projectId: doc.projectId,
  }));
}

/**
 * Normalize score to 0-1 range for display
 * Uses sigmoid-like function to map unbounded BM25 scores
 */
export function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  // Scale to 0-1 range
  const normalized = score / maxScore;
  return Math.min(1, Math.max(0, normalized));
}
