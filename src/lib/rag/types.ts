/**
 * RAG (Retrieval-Augmented Generation) types
 */

export interface RAGDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  chunkCount: number;
  createdAt: number;
}

export interface RAGChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  position: number;
}

export interface RAGSearchResult {
  documentName: string;
  chunkContent: string;
  position: number;
  score: number;
}

export interface RAGUploadProgress {
  stage: 'reading' | 'parsing' | 'chunking' | 'embedding' | 'storing';
  current: number;
  total: number;
}
