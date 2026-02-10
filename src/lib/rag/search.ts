/**
 * Vector similarity search for RAG
 */

import { RAGChunk, RAGSearchResult } from './types';

export interface SearchOptions {
  limit?: number;
  minScore?: number;
}

/**
 * Cosine similarity between two vectors
 * OpenAI embeddings are normalized, so this is just dot product
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Search chunks by cosine similarity to query embedding
 */
export function searchChunks(
  queryEmbedding: number[],
  chunks: RAGChunk[],
  documentNames: Map<string, string>,
  options?: SearchOptions
): RAGSearchResult[] {
  const limit = options?.limit ?? 5;
  const minScore = options?.minScore ?? 0.3;

  const scored = chunks.map((chunk) => ({
    documentName: documentNames.get(chunk.documentId) || 'Unknown',
    chunkContent: chunk.content,
    position: chunk.position,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return scored
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
