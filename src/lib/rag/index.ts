/**
 * RAG (Retrieval-Augmented Generation) - Main API
 *
 * Provides semantic search across user-uploaded documents
 * using OpenAI embeddings and IndexedDB for client-side storage.
 */

import { RAGDocument, RAGSearchResult, RAGUploadProgress } from './types';
import { RAGChunk } from './types';
import { chunkText, ChunkOptions } from './chunker';
import { embedTexts, embedQuery } from './embeddings';
import {
  storeDocument,
  storeChunks,
  getAllDocuments,
  getAllChunks,
  getChunksByDocumentId,
  removeDocument as dbRemoveDocument,
  clearAll,
  getStats,
} from './vectordb';
import { searchChunks } from './search';

// Re-export types
export type { RAGDocument, RAGSearchResult, RAGUploadProgress, RAGChunk } from './types';

const BINARY_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'xls']);

/**
 * Upload and index a document file
 */
export async function uploadDocument(
  file: File,
  openaiKey: string,
  onProgress?: (progress: RAGUploadProgress) => void,
  chunkOptions?: ChunkOptions
): Promise<RAGDocument> {
  // Determine file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isBinary = BINARY_EXTENSIONS.has(ext);

  let text: string;

  if (isBinary) {
    // Parse binary files server-side
    onProgress?.({ stage: 'parsing', current: 0, total: 1 });
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/rag/parse', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Parse failed' }));
      throw new Error(err.error || `Failed to parse ${ext} file`);
    }

    const result = await response.json();
    text = result.text;
    onProgress?.({ stage: 'parsing', current: 1, total: 1 });
  } else {
    // Read text files client-side
    onProgress?.({ stage: 'reading', current: 0, total: 1 });
    text = await file.text();
  }

  if (!text.trim()) {
    throw new Error('File is empty or contains no text');
  }

  // Chunk the text
  onProgress?.({ stage: 'chunking', current: 0, total: 1 });
  const chunks = chunkText(text, chunkOptions);

  if (chunks.length === 0) {
    throw new Error('No content to index');
  }

  // Embed chunks in batches
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    onProgress?.({ stage: 'embedding', current: i, total: chunks.length });
    const batchEmbeddings = await embedTexts(batch, openaiKey);
    embeddings.push(...batchEmbeddings);
  }
  onProgress?.({ stage: 'embedding', current: chunks.length, total: chunks.length });

  // Store in IndexedDB
  onProgress?.({ stage: 'storing', current: 0, total: 1 });
  const documentId = crypto.randomUUID();

  const doc: RAGDocument = {
    id: documentId,
    name: file.name,
    type: file.type || 'text/plain',
    size: file.size,
    chunkCount: chunks.length,
    createdAt: Date.now(),
  };

  const ragChunks: RAGChunk[] = chunks.map((content, i) => ({
    id: `${documentId}_${i}`,
    documentId,
    content,
    embedding: embeddings[i],
    position: i,
  }));

  await storeDocument(doc);
  await storeChunks(ragChunks);

  onProgress?.({ stage: 'storing', current: 1, total: 1 });
  return doc;
}

/**
 * Remove a document and its chunks from the store
 */
export async function removeDocument(documentId: string): Promise<void> {
  await dbRemoveDocument(documentId);
}

/**
 * Search uploaded documents using semantic similarity
 */
export async function searchRAG(
  query: string,
  openaiKey: string,
  options?: { limit?: number; minScore?: number }
): Promise<RAGSearchResult[]> {
  if (!query || !query.trim()) {
    return [];
  }

  try {
    const [queryEmbedding, chunks, documents] = await Promise.all([
      embedQuery(query, openaiKey),
      getAllChunks(),
      getAllDocuments(),
    ]);

    if (chunks.length === 0) {
      return [];
    }

    // Build document name lookup
    const documentNames = new Map<string, string>();
    for (const doc of documents) {
      documentNames.set(doc.id, doc.name);
    }

    return searchChunks(queryEmbedding, chunks, documentNames, {
      limit: options?.limit ?? 5,
      minScore: options?.minScore,
    });
  } catch (error) {
    console.error('RAG search error:', error);
    return [];
  }
}

/**
 * List all uploaded documents
 */
export async function listDocuments(): Promise<RAGDocument[]> {
  return getAllDocuments();
}

/**
 * Get RAG store statistics
 */
export async function getRAGStats(): Promise<{
  documentCount: number;
  chunkCount: number;
}> {
  return getStats();
}

/**
 * Clear all RAG data
 */
export async function clearRAGStore(): Promise<void> {
  await clearAll();
}

/**
 * Get all chunks for a specific document (for chunk inspector)
 */
export async function getDocumentChunks(documentId: string): Promise<RAGChunk[]> {
  return getChunksByDocumentId(documentId);
}

/**
 * Format RAG search results for display to the AI
 */
export function formatRAGResultsForAI(results: RAGSearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant content found in uploaded documents.';
  }

  let output = `Found ${results.length} relevant passage(s) from uploaded documents:\n\n`;

  results.forEach((result, index) => {
    const relevance = Math.round(result.score * 100);
    output += `[${index + 1}] From "${result.documentName}" (chunk ${result.position + 1}):\n`;
    output += `${result.chunkContent}\n`;
    output += `Relevance: ${relevance}%\n\n`;
  });

  return output.trim();
}
