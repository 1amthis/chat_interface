/**
 * IndexedDB vector store for RAG documents and chunks
 */

import { RAGDocument, RAGChunk } from './types';

const DB_NAME = 'rag_vector_store';
const DB_VERSION = 1;

const STORES = {
  DOCUMENTS: 'documents',
  CHUNKS: 'chunks',
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open RAG database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.CHUNKS)) {
        const chunkStore = db.createObjectStore(STORES.CHUNKS, { keyPath: 'id' });
        chunkStore.createIndex('documentId', 'documentId', { unique: false });
      }
    };
  });
}

/**
 * Store a document record
 */
export async function storeDocument(doc: RAGDocument): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.DOCUMENTS, 'readwrite');
  tx.objectStore(STORES.DOCUMENTS).put(doc);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store chunks for a document
 */
export async function storeChunks(chunks: RAGChunk[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.CHUNKS, 'readwrite');
  const store = tx.objectStore(STORES.CHUNKS);
  for (const chunk of chunks) {
    store.put(chunk);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all stored documents
 */
export async function getAllDocuments(): Promise<RAGDocument[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.DOCUMENTS, 'readonly');
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(STORES.DOCUMENTS).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get chunks for a specific document, sorted by position
 */
export async function getChunksByDocumentId(documentId: string): Promise<RAGChunk[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.CHUNKS, 'readonly');
  const index = tx.objectStore(STORES.CHUNKS).index('documentId');
  const range = IDBKeyRange.only(documentId);

  return new Promise((resolve, reject) => {
    const request = index.getAll(range);
    request.onsuccess = () => {
      const chunks = request.result as RAGChunk[];
      chunks.sort((a, b) => a.position - b.position);
      resolve(chunks);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all stored chunks
 */
export async function getAllChunks(): Promise<RAGChunk[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORES.CHUNKS, 'readonly');
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(STORES.CHUNKS).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a document and all its chunks
 */
export async function removeDocument(documentId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.DOCUMENTS, STORES.CHUNKS], 'readwrite');
    const docStore = tx.objectStore(STORES.DOCUMENTS);
    const chunkStore = tx.objectStore(STORES.CHUNKS);
    const index = chunkStore.index('documentId');
    const range = IDBKeyRange.only(documentId);
    const chunkRequest = index.getAll(range);

    docStore.delete(documentId);

    chunkRequest.onsuccess = () => {
      const chunks = chunkRequest.result as RAGChunk[];
      for (const chunk of chunks) {
        chunkStore.delete(chunk.id);
      }
    };

    chunkRequest.onerror = () => reject(chunkRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('RAG document removal transaction aborted'));
  });
}

/**
 * Clear all documents and chunks
 */
export async function clearAll(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORES.DOCUMENTS, STORES.CHUNKS], 'readwrite');
  tx.objectStore(STORES.DOCUMENTS).clear();
  tx.objectStore(STORES.CHUNKS).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get store statistics
 */
export async function getStats(): Promise<{
  documentCount: number;
  chunkCount: number;
}> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.DOCUMENTS, STORES.CHUNKS], 'readonly');
    const docRequest = tx.objectStore(STORES.DOCUMENTS).count();
    const chunkRequest = tx.objectStore(STORES.CHUNKS).count();

    docRequest.onerror = () => reject(docRequest.error);
    chunkRequest.onerror = () => reject(chunkRequest.error);
    tx.oncomplete = () => resolve({
      documentCount: docRequest.result,
      chunkCount: chunkRequest.result,
    });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('RAG stats transaction aborted'));
  });
}
