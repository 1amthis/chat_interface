/**
 * IndexedDB operations for memory search
 */

import { Conversation, Message } from '@/types';
import { IndexedDocument, IndexMetadata, SyncState, IndexStats } from './types';
import { tokenize, calculateTermFrequencies, extractTextFromMessage } from './tokenizer';

const DB_NAME = 'chat_memory_index';
const DB_VERSION = 1;

const STORES = {
  DOCUMENTS: 'documents',
  METADATA: 'index_metadata',
  SYNC_STATE: 'sync_state',
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
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Documents store - indexed messages
      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
        docStore.createIndex('conversationId', 'conversationId', { unique: false });
        docStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Metadata store - global BM25 statistics
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'id' });
      }

      // Sync state store - tracks indexed conversations
      if (!db.objectStoreNames.contains(STORES.SYNC_STATE)) {
        db.createObjectStore(STORES.SYNC_STATE, { keyPath: 'conversationId' });
      }
    };
  });
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get a transaction and object store
 */
async function getStore(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * Convert a message to an indexed document
 */
function messageToDocument(
  message: Message,
  conversation: Conversation
): IndexedDocument {
  const content = extractTextFromMessage(
    message.content,
    message.contentBlocks as Array<{ type: string; text?: string }>
  );
  const terms = tokenize(content);
  const termFrequencies = calculateTermFrequencies(terms);

  return {
    id: `${conversation.id}:${message.id}`,
    conversationId: conversation.id,
    messageId: message.id,
    role: message.role,
    content,
    terms,
    termFrequencies,
    length: terms.length,
    timestamp: message.timestamp,
    conversationTitle: conversation.title,
    projectId: conversation.projectId,
  };
}

/**
 * Index a single conversation's messages
 */
export async function indexConversation(conversation: Conversation): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction([STORES.DOCUMENTS, STORES.SYNC_STATE], 'readwrite');
  const docStore = transaction.objectStore(STORES.DOCUMENTS);
  const syncStore = transaction.objectStore(STORES.SYNC_STATE);

  // First, remove existing documents for this conversation
  const index = docStore.index('conversationId');
  const range = IDBKeyRange.only(conversation.id);
  const existingDocs = await new Promise<IndexedDocument[]>((resolve, reject) => {
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  for (const doc of existingDocs) {
    docStore.delete(doc.id);
  }

  // Index all messages
  let messageCount = 0;
  for (const message of conversation.messages) {
    // Skip messages with no meaningful content
    const content = extractTextFromMessage(
      message.content,
      message.contentBlocks as Array<{ type: string; text?: string }>
    );
    if (content.length < 10) continue;

    const doc = messageToDocument(message, conversation);
    docStore.put(doc);
    messageCount++;
  }

  // Update sync state
  const syncState: SyncState = {
    conversationId: conversation.id,
    lastIndexedAt: Date.now(),
    messageCount,
    updatedAt: conversation.updatedAt,
  };
  syncStore.put(syncState);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Remove a conversation from the index
 */
export async function removeFromIndex(conversationId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction([STORES.DOCUMENTS, STORES.SYNC_STATE], 'readwrite');
  const docStore = transaction.objectStore(STORES.DOCUMENTS);
  const syncStore = transaction.objectStore(STORES.SYNC_STATE);

  // Remove all documents for this conversation
  const index = docStore.index('conversationId');
  const range = IDBKeyRange.only(conversationId);
  const existingDocs = await new Promise<IndexedDocument[]>((resolve, reject) => {
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  for (const doc of existingDocs) {
    docStore.delete(doc.id);
  }

  // Remove sync state
  syncStore.delete(conversationId);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Update global metadata (document frequencies, avg length, etc.)
 */
export async function updateMetadata(): Promise<void> {
  const db = await openDatabase();

  // Get all documents
  const docStore = await getStore(STORES.DOCUMENTS);
  const documents = await new Promise<IndexedDocument[]>((resolve, reject) => {
    const request = docStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (documents.length === 0) {
    // Clear metadata if no documents
    const metaStore = await getStore(STORES.METADATA, 'readwrite');
    metaStore.delete('global');
    return;
  }

  // Calculate document frequencies
  const documentFrequencies: Record<string, number> = {};
  let totalLength = 0;

  for (const doc of documents) {
    totalLength += doc.length;
    // Count unique terms per document for DF
    const uniqueTerms = new Set(doc.terms);
    for (const term of uniqueTerms) {
      documentFrequencies[term] = (documentFrequencies[term] || 0) + 1;
    }
  }

  const metadata: IndexMetadata = {
    id: 'global',
    totalDocuments: documents.length,
    avgDocumentLength: totalLength / documents.length,
    documentFrequencies,
    lastUpdated: Date.now(),
    version: '1.0',
  };

  const metaStore = await getStore(STORES.METADATA, 'readwrite');
  metaStore.put(metadata);
}

/**
 * Check if a conversation needs reindexing
 */
export async function needsReindex(
  conversationId: string,
  updatedAt: number
): Promise<boolean> {
  const syncStore = await getStore(STORES.SYNC_STATE);
  const syncState = await new Promise<SyncState | undefined>((resolve, reject) => {
    const request = syncStore.get(conversationId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!syncState) {
    return true; // Never indexed
  }

  return syncState.updatedAt < updatedAt;
}

/**
 * Get all indexed documents
 */
export async function getAllDocuments(): Promise<IndexedDocument[]> {
  const docStore = await getStore(STORES.DOCUMENTS);
  return new Promise((resolve, reject) => {
    const request = docStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get global metadata
 */
export async function getMetadata(): Promise<IndexMetadata | null> {
  const metaStore = await getStore(STORES.METADATA);
  return new Promise((resolve, reject) => {
    const request = metaStore.get('global');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get index statistics for UI display
 */
export async function getIndexStats(): Promise<IndexStats> {
  const metadata = await getMetadata();
  const syncStore = await getStore(STORES.SYNC_STATE);
  const syncStates = await new Promise<SyncState[]>((resolve, reject) => {
    const request = syncStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return {
    totalDocuments: metadata?.totalDocuments || 0,
    totalConversations: syncStates.length,
    lastUpdated: metadata?.lastUpdated || null,
  };
}

/**
 * Clear the entire index
 */
export async function clearIndex(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(
    [STORES.DOCUMENTS, STORES.METADATA, STORES.SYNC_STATE],
    'readwrite'
  );

  transaction.objectStore(STORES.DOCUMENTS).clear();
  transaction.objectStore(STORES.METADATA).clear();
  transaction.objectStore(STORES.SYNC_STATE).clear();

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
