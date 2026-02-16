'use client';

import { useState, useEffect, useCallback } from 'react';
import { Conversation, ChatSettings } from '@/types';
import {
  getIndexStats,
  searchMemory,
  rebuildIndex,
  syncIndex,
  clearMemoryIndex,
} from '@/lib/memory-search';
import type { IndexStats, MemorySearchResult } from '@/lib/memory-search';
import { RAGSettingsSection } from './RAGSettingsSection';

interface KnowledgeBaseProps {
  conversations: Conversation[];
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onClose: () => void;
}

export function KnowledgeBase({
  conversations,
  settings,
  onSettingsChange,
  onClose,
}: KnowledgeBaseProps) {
  // Memory search state
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const s = await getIndexStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load index stats:', e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRebuild = async () => {
    setLoadingAction('rebuild');
    try {
      await rebuildIndex(conversations);
      await loadStats();
    } catch (e) {
      console.error('Rebuild failed:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSync = async () => {
    setLoadingAction('sync');
    try {
      await syncIndex(conversations);
      await loadStats();
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClear = async () => {
    setLoadingAction('clear');
    try {
      await clearMemoryIndex();
      await loadStats();
      setSearchResults(null);
    } catch (e) {
      console.error('Clear failed:', e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchMemory(searchQuery, { limit: 10 });
      setSearchResults(results);
    } catch (e) {
      console.error('Search failed:', e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--border-color)] rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Memory Search Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h2 className="text-lg font-semibold">Memory Search</h2>
            {!settings.memorySearchEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">Disabled</span>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--border-color)]/10">
              <p className="text-sm text-gray-500">Documents</p>
              <p className="text-2xl font-bold">{stats?.totalDocuments ?? '...'}</p>
            </div>
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--border-color)]/10">
              <p className="text-sm text-gray-500">Conversations</p>
              <p className="text-2xl font-bold">{stats?.totalConversations ?? '...'}</p>
            </div>
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--border-color)]/10">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-sm font-medium mt-1">{stats ? formatDate(stats.lastUpdated) : '...'}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleRebuild}
              disabled={!!loadingAction}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
            >
              {loadingAction === 'rebuild' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Rebuild Index
            </button>
            <button
              onClick={handleSync}
              disabled={!!loadingAction}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
            >
              {loadingAction === 'sync' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              )}
              Sync Index
            </button>
            <button
              onClick={handleClear}
              disabled={!!loadingAction}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {loadingAction === 'clear' ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              Clear Index
            </button>
          </div>

          {/* Search Test Interface */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Test Search</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Search your conversation history..."
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {searching ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  'Search'
                )}
              </button>
            </div>

            {/* Search Results */}
            {searchResults !== null && (
              <div className="space-y-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No results found</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {searchResults.map((result, i) => (
                        <div
                          key={`${result.conversationId}-${result.messageId}-${i}`}
                          className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--border-color)]/10"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{result.conversationTitle}</span>
                            <span className="text-xs text-gray-500 shrink-0 ml-2">
                              Score: {result.score.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">
                            {result.role === 'user' ? 'User' : 'Assistant'} &middot; {new Date(result.timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                            {result.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Divider */}
        <hr className="border-[var(--border-color)]" />

        {/* RAG Documents Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-lg font-semibold">Document Search (RAG)</h2>
            {!settings.ragEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">Disabled</span>
            )}
          </div>

          <RAGSettingsSection
            openaiKey={settings.openaiKey}
            chunkStrategy={settings.ragChunkStrategy}
            chunkSize={settings.ragChunkSize}
            chunkOverlap={settings.ragChunkOverlap}
            onChunkSettingsChange={(chunkSettings) => onSettingsChange(chunkSettings)}
          />
        </section>
      </div>
    </div>
  );
}
