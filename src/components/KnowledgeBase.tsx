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
import { searchRAG, getRAGStats } from '@/lib/rag';
import type { RAGSearchResult } from '@/lib/rag';
import { RAGSettingsSection } from './RAGSettingsSection';

type KnowledgeTab = 'memory' | 'rag';

interface KnowledgeBaseProps {
  conversations: Conversation[];
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onClose: () => void;
}

// Spinner SVG reused across buttons
function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ScoreBadge({ score, maxExpected }: { score: number; maxExpected?: number }) {
  const normalized = maxExpected ? Math.min(score / maxExpected, 1) : score;
  const color =
    normalized >= 0.6
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      : normalized >= 0.3
        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${color}`}>
      {score.toFixed(3)}
    </span>
  );
}

function RolePill({ role }: { role: 'user' | 'assistant' }) {
  const cls =
    role === 'user'
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {role === 'user' ? 'User' : 'Assistant'}
    </span>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>
        <span className="text-xs font-mono text-gray-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{min}</span>
        {description && <span className="text-center flex-1">{description}</span>}
        <span>{max}</span>
      </div>
    </div>
  );
}

export function KnowledgeBase({
  conversations,
  settings,
  onSettingsChange,
  onClose,
}: KnowledgeBaseProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('memory');

  // Memory search state
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showMemoryParams, setShowMemoryParams] = useState(false);

  // RAG state
  const [ragStats, setRagStats] = useState<{ documentCount: number; chunkCount: number } | null>(null);
  const [ragSearchQuery, setRagSearchQuery] = useState('');
  const [ragSearchResults, setRagSearchResults] = useState<RAGSearchResult[] | null>(null);
  const [ragSearching, setRagSearching] = useState(false);
  const [showRagParams, setShowRagParams] = useState(false);

  // Current param values (read from settings with defaults)
  const memoryLimit = settings.memorySearchLimit ?? 5;
  const memoryMinScore = settings.memorySearchMinScore ?? 0.1;
  const snippetLength = settings.memorySearchSnippetLength ?? 150;
  const bm25K1 = settings.bm25K1 ?? 1.2;
  const bm25B = settings.bm25B ?? 0.75;
  const ragLimit = settings.ragSearchLimit ?? 5;
  const ragMinScore = settings.ragSearchMinScore ?? 0.3;

  const loadStats = useCallback(async () => {
    try {
      const s = await getIndexStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load index stats:', e);
    }
  }, []);

  const loadRagStats = useCallback(async () => {
    try {
      const s = await getRAGStats();
      setRagStats(s);
    } catch (e) {
      console.error('Failed to load RAG stats:', e);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadRagStats();
  }, [loadStats, loadRagStats]);

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
      const results = await searchMemory(searchQuery, {
        limit: memoryLimit,
        minScore: memoryMinScore,
        snippetLength,
        k1: bm25K1,
        b: bm25B,
      });
      setSearchResults(results);
    } catch (e) {
      console.error('Search failed:', e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleRagSearch = async () => {
    if (!ragSearchQuery.trim()) return;
    if (!settings.openaiKey) return;
    setRagSearching(true);
    try {
      const results = await searchRAG(ragSearchQuery, settings.openaiKey, {
        limit: ragLimit,
        minScore: ragMinScore,
      });
      setRagSearchResults(results);
    } catch (e) {
      console.error('RAG search failed:', e);
      setRagSearchResults([]);
    } finally {
      setRagSearching(false);
    }
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString();
  };

  const formatRelativeDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-color)]">
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'memory'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Memory Search
            {!settings.memorySearchEnabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">Off</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rag'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Document Search
            {!settings.ragEnabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">Off</span>
            )}
          </button>
        </div>

        {/* ==================== MEMORY SEARCH TAB ==================== */}
        {activeTab === 'memory' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-color)] bg-purple-50/50 dark:bg-purple-900/10">
                <svg className="w-8 h-8 text-purple-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Messages Indexed</p>
                  <p className="text-2xl font-bold">{stats?.totalDocuments ?? '...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-color)] bg-blue-50/50 dark:bg-blue-900/10">
                <svg className="w-8 h-8 text-blue-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Conversations</p>
                  <p className="text-2xl font-bold">{stats?.totalConversations ?? '...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-color)] bg-gray-50/50 dark:bg-gray-800/30">
                <svg className="w-8 h-8 text-gray-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm font-medium">{stats ? formatDate(stats.lastUpdated) : '...'}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRebuild}
                disabled={!!loadingAction}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
              >
                {loadingAction === 'rebuild' ? <Spinner /> : (
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
                {loadingAction === 'sync' ? <Spinner /> : (
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
                {loadingAction === 'clear' ? <Spinner /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                Clear Index
              </button>
            </div>

            {/* Search Parameters (collapsible) */}
            <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
              <button
                onClick={() => setShowMemoryParams(!showMemoryParams)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--border-color)]/20 transition-colors"
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Search Parameters
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showMemoryParams ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showMemoryParams && (
                <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-color)]">
                  <div className="pt-3 space-y-3">
                    <SliderField
                      label="Result Limit"
                      value={memoryLimit}
                      min={1} max={20} step={1}
                      onChange={(v) => onSettingsChange({ memorySearchLimit: v })}
                    />
                    <SliderField
                      label="Min Score"
                      value={memoryMinScore}
                      min={0} max={1} step={0.05}
                      onChange={(v) => onSettingsChange({ memorySearchMinScore: v })}
                    />
                    <SliderField
                      label="Snippet Length"
                      value={snippetLength}
                      min={50} max={500} step={10}
                      onChange={(v) => onSettingsChange({ memorySearchSnippetLength: v })}
                    />
                    <SliderField
                      label="BM25 K1"
                      value={bm25K1}
                      min={0.5} max={3} step={0.1}
                      description="Term frequency saturation"
                      onChange={(v) => onSettingsChange({ bm25K1: v })}
                    />
                    <SliderField
                      label="BM25 B"
                      value={bm25B}
                      min={0} max={1} step={0.05}
                      description="Length normalization"
                      onChange={(v) => onSettingsChange({ bm25B: v })}
                    />
                  </div>
                  <button
                    onClick={() => onSettingsChange({
                      memorySearchLimit: undefined,
                      memorySearchMinScore: undefined,
                      memorySearchSnippetLength: undefined,
                      bm25K1: undefined,
                      bm25B: undefined,
                    })}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reset to Defaults
                  </button>
                </div>
              )}
            </div>

            {/* Memory Test Search */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Test Search</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="Search your conversation history..."
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {searching ? <Spinner /> : 'Search'}
                </button>
              </div>

              {/* Memory Search Results */}
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
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium truncate">{result.conversationTitle}</span>
                              <ScoreBadge score={result.score} />
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <RolePill role={result.role} />
                              <span className="text-[10px] text-gray-400">{formatRelativeDate(result.timestamp)}</span>
                            </div>
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
          </div>
        )}

        {/* ==================== DOCUMENT SEARCH (RAG) TAB ==================== */}
        {activeTab === 'rag' && (
          <div className="space-y-6">
            {/* RAG Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-color)] bg-green-50/50 dark:bg-green-900/10">
                <svg className="w-8 h-8 text-green-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Documents</p>
                  <p className="text-2xl font-bold">{ragStats?.documentCount ?? '...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-color)] bg-emerald-50/50 dark:bg-emerald-900/10">
                <svg className="w-8 h-8 text-emerald-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Chunks</p>
                  <p className="text-2xl font-bold">{ragStats?.chunkCount ?? '...'}</p>
                </div>
              </div>
            </div>

            {/* Upload + Chunking Settings via RAGSettingsSection */}
            <RAGSettingsSection
              openaiKey={settings.openaiKey}
              chunkStrategy={settings.ragChunkStrategy}
              chunkSize={settings.ragChunkSize}
              chunkOverlap={settings.ragChunkOverlap}
              onChunkSettingsChange={(chunkSettings) => {
                onSettingsChange(chunkSettings);
                // Refresh RAG stats after upload (component handles its own state)
                setTimeout(() => loadRagStats(), 500);
              }}
            />

            {/* RAG Search Parameters (collapsible) */}
            <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
              <button
                onClick={() => setShowRagParams(!showRagParams)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--border-color)]/20 transition-colors"
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Search Parameters
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${showRagParams ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showRagParams && (
                <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-color)]">
                  <div className="pt-3 space-y-3">
                    <SliderField
                      label="Result Limit"
                      value={ragLimit}
                      min={1} max={20} step={1}
                      onChange={(v) => onSettingsChange({ ragSearchLimit: v })}
                    />
                    <SliderField
                      label="Min Similarity Score"
                      value={ragMinScore}
                      min={0} max={1} step={0.05}
                      onChange={(v) => onSettingsChange({ ragSearchMinScore: v })}
                    />
                  </div>
                  <button
                    onClick={() => onSettingsChange({
                      ragSearchLimit: undefined,
                      ragSearchMinScore: undefined,
                    })}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reset to Defaults
                  </button>
                </div>
              )}
            </div>

            {/* RAG Test Search */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Test Search</h3>
              {!settings.openaiKey ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    OpenAI API key required for semantic search. Set it in Models & Providers.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ragSearchQuery}
                      onChange={(e) => setRagSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRagSearch(); }}
                      placeholder="Search uploaded documents..."
                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={handleRagSearch}
                      disabled={ragSearching || !ragSearchQuery.trim()}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {ragSearching ? <Spinner /> : 'Search'}
                    </button>
                  </div>

                  {/* RAG Search Results */}
                  {ragSearchResults !== null && (
                    <div className="space-y-2">
                      {ragSearchResults.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">No results found</p>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500">{ragSearchResults.length} result{ragSearchResults.length !== 1 ? 's' : ''}</p>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {ragSearchResults.map((result, i) => {
                              const pct = Math.round(result.score * 100);
                              return (
                                <div
                                  key={`rag-${i}`}
                                  className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--border-color)]/10"
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium truncate">{result.documentName}</span>
                                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">Chunk {result.position + 1}</span>
                                  </div>
                                  {/* Similarity bar */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          pct >= 60 ? 'bg-green-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 w-10 text-right">{pct}%</span>
                                  </div>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                                    {result.chunkContent}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
