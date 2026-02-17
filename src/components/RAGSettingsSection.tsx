'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RAGDocument, RAGUploadProgress } from '@/lib/rag/types';
import { uploadDocument, removeDocument, listDocuments, clearRAGStore, getDocumentChunks } from '@/lib/rag';
import type { RAGChunk } from '@/lib/rag';
import type { ChunkStrategy } from '@/lib/rag/chunker';

const ACCEPTED_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.js', '.ts', '.py', '.html', '.css',
  '.xml', '.yaml', '.yml', '.toml', '.log', '.sh', '.sql', '.go', '.rs',
  '.java', '.c', '.cpp', '.rb', '.php',
  '.pdf', '.docx', '.xlsx', '.xls',
];

const STRATEGY_OPTIONS: { value: ChunkStrategy; label: string; description: string }[] = [
  { value: 'paragraph', label: 'Paragraph', description: 'Split on double newlines' },
  { value: 'fixed', label: 'Fixed-size', description: 'Sliding window with word-boundary snapping' },
  { value: 'sentence', label: 'Sentence', description: 'Accumulate sentences to chunk size' },
  { value: 'markdown', label: 'Markdown heading', description: 'Split on # headings' },
];

interface RAGSettingsSectionProps {
  openaiKey?: string;
  chunkStrategy?: ChunkStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
  onChunkSettingsChange?: (settings: {
    ragChunkStrategy?: ChunkStrategy;
    ragChunkSize?: number;
    ragChunkOverlap?: number;
  }) => void;
}

export function RAGSettingsSection({
  openaiKey,
  chunkStrategy = 'paragraph',
  chunkSize = 2000,
  chunkOverlap = 200,
  onChunkSettingsChange,
}: RAGSettingsSectionProps) {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<RAGUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunk inspector state
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [docChunks, setDocChunks] = useState<Map<string, RAGChunk[]>>(new Map());
  const [loadingChunks, setLoadingChunks] = useState<string | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to load RAG documents:', e);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleToggleExpand = useCallback(async (docId: string) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(docId);
    setExpandedChunks(new Set());

    // Lazy-load chunks if not cached
    if (!docChunks.has(docId)) {
      setLoadingChunks(docId);
      try {
        const chunks = await getDocumentChunks(docId);
        setDocChunks((prev) => new Map(prev).set(docId, chunks));
      } catch (e) {
        console.error('Failed to load chunks:', e);
      } finally {
        setLoadingChunks(null);
      }
    }
  }, [expandedDocId, docChunks]);

  const toggleChunkExpanded = useCallback((chunkId: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  }, []);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!openaiKey) {
      setError('OpenAI API key is required for document embeddings');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, openaiKey, setProgress, {
          strategy: chunkStrategy,
          chunkSize,
          overlap: chunkOverlap,
        });
      }
      await loadDocuments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }, [openaiKey, loadDocuments, chunkStrategy, chunkSize, chunkOverlap]);

  const handleDelete = useCallback(async (docId: string) => {
    try {
      await removeDocument(docId);
      if (expandedDocId === docId) setExpandedDocId(null);
      setDocChunks((prev) => {
        const next = new Map(prev);
        next.delete(docId);
        return next;
      });
      await loadDocuments();
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  }, [loadDocuments, expandedDocId]);

  const handleClearAll = useCallback(async () => {
    try {
      await clearRAGStore();
      setDocuments([]);
      setExpandedDocId(null);
      setDocChunks(new Map());
    } catch (e) {
      console.error('Failed to clear RAG store:', e);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressLabel = progress
    ? progress.stage === 'reading' ? 'Reading file...'
    : progress.stage === 'parsing' ? 'Parsing document...'
    : progress.stage === 'chunking' ? 'Splitting into chunks...'
    : progress.stage === 'embedding' ? `Embedding chunks (${progress.current}/${progress.total})...`
    : 'Storing...'
    : '';

  if (!openaiKey) {
    return (
      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          Document search requires an OpenAI API key (for embeddings). Set your OpenAI API key in Models & Providers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-[var(--border-color)] hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleUpload(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Text, code, markdown, PDF, DOCX, XLSX, and more
        </p>
      </div>

      {/* Chunking settings */}
      <div className="space-y-2 p-3 rounded-lg bg-[var(--border-color)]/20 border border-[var(--border-color)]">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Chunking Strategy</p>
        <select
          value={chunkStrategy}
          onChange={(e) => onChunkSettingsChange?.({ ragChunkStrategy: e.target.value as ChunkStrategy })}
          className="w-full px-2 py-1.5 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
        >
          {STRATEGY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {opt.description}
            </option>
          ))}
        </select>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 dark:text-gray-400">Chunk size</label>
            <span className="text-xs font-mono text-gray-500">{chunkSize}</span>
          </div>
          <input
            type="range"
            min={500}
            max={5000}
            step={100}
            value={chunkSize}
            onChange={(e) => onChunkSettingsChange?.({ ragChunkSize: Number(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>500</span>
            <span>5000</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 dark:text-gray-400">Overlap</label>
            <span className="text-xs font-mono text-gray-500">{chunkOverlap}</span>
          </div>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={chunkOverlap}
            onChange={(e) => onChunkSettingsChange?.({ ragChunkOverlap: Number(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span>500</span>
          </div>
        </div>
      </div>

      {/* Upload progress */}
      {uploading && progress && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-blue-700 dark:text-blue-300">{progressLabel}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Document list with chunk inspector */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
            <button
              onClick={handleClearAll}
              className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {documents.map((doc) => {
              const isExpanded = expandedDocId === doc.id;
              const chunks = docChunks.get(doc.id);
              const isLoading = loadingChunks === doc.id;

              return (
                <div key={doc.id}>
                  <div
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors group ${
                      isExpanded ? 'bg-[var(--border-color)]/50' : 'bg-[var(--border-color)]/30 hover:bg-[var(--border-color)]/40'
                    }`}
                    onClick={() => handleToggleExpand(doc.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                      <svg
                        className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatSize(doc.size)} &middot; {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''} &middot; {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Chunk inspector panel */}
                  {isExpanded && (
                    <div className="ml-5 mt-1 mb-2 pl-3 border-l-2 border-[var(--border-color)] space-y-1.5">
                      {isLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <svg className="animate-spin h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="text-xs text-gray-400">Loading chunks...</span>
                        </div>
                      ) : chunks && chunks.length > 0 ? (
                        chunks.map((chunk) => {
                          const isChunkExpanded = expandedChunks.has(chunk.id);
                          return (
                            <div
                              key={chunk.id}
                              className="p-2 rounded bg-[var(--border-color)]/20 border border-[var(--border-color)]"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    Chunk {chunk.position + 1}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono">
                                    {chunk.embedding.length}d
                                  </span>
                                </div>
                                <button
                                  onClick={() => toggleChunkExpanded(chunk.id)}
                                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {isChunkExpanded ? 'Show less' : 'Show full'}
                                </button>
                              </div>
                              <p className={`text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap ${
                                isChunkExpanded ? '' : 'line-clamp-3'
                              }`}>
                                {chunk.content}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-gray-400 py-2">No chunks found</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Documents are embedded using OpenAI and stored locally in your browser. The AI can search them using the rag_search tool.
      </p>
    </div>
  );
}
