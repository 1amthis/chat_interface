'use client';

import { useState } from 'react';
import { ToolCall, WebSearchResponse, GoogleDriveSearchResponse } from '@/types';
import { MemorySearchResult } from '@/lib/memory-search/types';
import { RAGSearchResult } from '@/lib/rag/types';

// SQL result types (mirrors builtin-tools.ts shapes)
interface SqlSelectResult {
  __sql_result__: true;
  type: 'select';
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
}

interface SqlMutateResult {
  __sql_result__: true;
  type: 'mutate';
  statement: string;
  changes: number;
  lastInsertRowid: number | bigint;
}

type SqlResult = SqlSelectResult | SqlMutateResult;

function tryParseSqlResult(text: string): SqlResult | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.__sql_result__ === true) {
      return parsed as SqlResult;
    }
  } catch { /* not JSON */ }
  return null;
}

const SQL_PAGE_SIZE = 50;

function SqlResultTable({ result }: { result: SqlResult }) {
  const [page, setPage] = useState(0);

  if (result.type === 'mutate') {
    return (
      <div className="sql-result-summary">
        <strong>{result.statement}</strong> — {result.changes} row{result.changes !== 1 ? 's' : ''} affected
        {result.lastInsertRowid ? ` (last insert rowid: ${result.lastInsertRowid})` : ''}
      </div>
    );
  }

  // SELECT result
  const totalPages = Math.ceil(result.rows.length / SQL_PAGE_SIZE);
  const pageRows = result.rows.slice(page * SQL_PAGE_SIZE, (page + 1) * SQL_PAGE_SIZE);

  return (
    <div>
      {result.truncated && (
        <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">
          Showing first 500 of {result.rowCount} rows
        </div>
      )}
      <div className="sql-result-table-wrapper">
        <table className="sql-result-table">
          <thead>
            <tr>
              {result.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    {cell === null || cell === undefined
                      ? <span className="sql-null">NULL</span>
                      : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="sql-result-pagination">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            ‹ Prev
          </button>
          <span>Page {page + 1} / {totalPages} ({result.rows.length} rows)</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

function tryParseWebSearchResponse(result: unknown): WebSearchResponse | null {
  if (!result || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  if (typeof obj.query === 'string' && Array.isArray(obj.results) && typeof obj.timestamp === 'number') {
    return obj as unknown as WebSearchResponse;
  }
  // Also try parsing from a JSON string
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      if (parsed && typeof parsed.query === 'string' && Array.isArray(parsed.results)) {
        return parsed as WebSearchResponse;
      }
    } catch { /* not JSON */ }
  }
  return null;
}

function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function WebSearchResultsList({ response }: { response: WebSearchResponse }) {
  if (response.results.length === 0) {
    return (
      <div className="tool-results-header">
        No results found for &quot;{response.query}&quot;
      </div>
    );
  }

  return (
    <div className="tool-call-results">
      <div className="tool-results-header">
        {response.results.length} result{response.results.length !== 1 ? 's' : ''} for &quot;{response.query}&quot;
      </div>
      <div className="tool-results-list">
        {response.results.map((r, i) => {
          const domain = getDomain(r.url);
          return (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tool-result-item"
            >
              <div className="tool-result-header-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`}
                  alt=""
                  className="tool-result-favicon"
                  width={16}
                  height={16}
                />
                <span className="tool-result-domain">{domain}</span>
              </div>
              <div className="tool-result-title">{r.title}</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// --- Google Drive Search ---

function tryParseGoogleDriveResponse(result: unknown): GoogleDriveSearchResponse | null {
  if (!result || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  if (typeof obj.query === 'string' && Array.isArray(obj.results) && typeof obj.timestamp === 'number') {
    // Distinguish from WebSearchResponse by checking for Drive-specific fields
    const first = obj.results[0];
    if (!first || (first && typeof first === 'object' && 'fileName' in first)) {
      return obj as unknown as GoogleDriveSearchResponse;
    }
  }
  return null;
}

function getDriveFileIcon(mimeType: string): string {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('video')) return '🎬';
  if (mimeType.includes('audio')) return '🎵';
  if (mimeType.includes('folder')) return '📁';
  if (mimeType.includes('form')) return '📋';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️';
  return '📄';
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return dateStr;
  }
}

function GoogleDriveResultsList({ response }: { response: GoogleDriveSearchResponse }) {
  if (response.results.length === 0) {
    return (
      <div className="tool-results-header">
        No files found for &quot;{response.query}&quot;
      </div>
    );
  }

  return (
    <div className="tool-call-results">
      <div className="tool-results-header">
        {response.results.length} file{response.results.length !== 1 ? 's' : ''} for &quot;{response.query}&quot;
      </div>
      <div className="tool-results-list">
        {response.results.map((r, i) => (
          <a
            key={i}
            href={r.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="tool-result-item"
          >
            <div className="tool-result-header-row">
              <span className="tool-result-type-icon">{getDriveFileIcon(r.mimeType)}</span>
              <span className="tool-result-title">{r.fileName}</span>
            </div>
            <div className="tool-result-meta">
              {r.owner && <span>{r.owner}</span>}
              {r.owner && <span className="tool-result-meta-sep">·</span>}
              <span>{formatRelativeDate(r.modifiedTime)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// --- Memory Search ---

interface MemorySearchResponseData {
  __memory_search__: true;
  query: string;
  results: MemorySearchResult[];
}

function tryParseMemorySearchResponse(result: unknown): MemorySearchResponseData | null {
  if (!result || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  if (obj.__memory_search__ === true && typeof obj.query === 'string' && Array.isArray(obj.results)) {
    return obj as unknown as MemorySearchResponseData;
  }
  return null;
}

function formatTimestamp(ts: number): string {
  try {
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function MemorySearchResultsList({ response }: { response: MemorySearchResponseData }) {
  if (response.results.length === 0) {
    return (
      <div className="tool-results-header">
        No memories found for &quot;{response.query}&quot;
      </div>
    );
  }

  return (
    <div className="tool-call-results">
      <div className="tool-results-header">
        {response.results.length} memory match{response.results.length !== 1 ? 'es' : ''} for &quot;{response.query}&quot;
      </div>
      <div className="tool-results-list">
        {response.results.map((r, i) => (
          <div key={i} className="tool-result-item tool-result-item-static">
            <div className="tool-result-header-row">
              <span className="tool-result-type-icon">💬</span>
              <span className="tool-result-title tool-result-title-default">{r.conversationTitle}</span>
            </div>
            <div className="tool-result-meta">
              <span>{r.role === 'user' ? 'You' : 'Assistant'}</span>
              <span className="tool-result-meta-sep">·</span>
              <span>{formatTimestamp(r.timestamp)}</span>
              <span className="tool-result-meta-sep">·</span>
              <span className="tool-result-score">{Math.round(r.score * 100)}% match</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- RAG Search ---

interface RAGSearchResponseData {
  __rag_search__: true;
  query: string;
  results: RAGSearchResult[];
}

function tryParseRAGSearchResponse(result: unknown): RAGSearchResponseData | null {
  if (!result || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  if (obj.__rag_search__ === true && typeof obj.query === 'string' && Array.isArray(obj.results)) {
    return obj as unknown as RAGSearchResponseData;
  }
  return null;
}

function getDocumentIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf': return '📕';
    case 'doc': case 'docx': return '📝';
    case 'xls': case 'xlsx': case 'csv': return '📊';
    case 'ppt': case 'pptx': return '📽️';
    case 'txt': case 'log': return '📄';
    case 'md': case 'mdx': return '📓';
    case 'json': case 'xml': case 'yaml': case 'yml': return '📋';
    case 'html': case 'htm': return '🌐';
    case 'js': case 'ts': case 'py': case 'rb': case 'go': case 'rs': case 'java': case 'c': case 'cpp': return '💻';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return '🖼️';
    default: return '📄';
  }
}

function RAGSearchResultsList({ response }: { response: RAGSearchResponseData }) {
  if (response.results.length === 0) {
    return (
      <div className="tool-results-header">
        No documents found for &quot;{response.query}&quot;
      </div>
    );
  }

  return (
    <div className="tool-call-results">
      <div className="tool-results-header">
        {response.results.length} passage{response.results.length !== 1 ? 's' : ''} for &quot;{response.query}&quot;
      </div>
      <div className="tool-results-list">
        {response.results.map((r, i) => (
          <div key={i} className="tool-result-item tool-result-item-static">
            <div className="tool-result-header-row">
              <span className="tool-result-type-icon">{getDocumentIcon(r.documentName)}</span>
              <span className="tool-result-title tool-result-title-default">{r.documentName}</span>
            </div>
            <div className="tool-result-meta">
              <span>Chunk {r.position + 1}</span>
              <span className="tool-result-meta-sep">·</span>
              <span className="tool-result-score">{Math.round(r.score * 100)}% relevance</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  inline?: boolean;  // For inline display within message flow
}

function formatDuration(startedAt: number, completedAt?: number): string {
  const end = completedAt || Date.now();
  const duration = end - startedAt;
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(1)}s`;
}

function getStatusIcon(status: ToolCall['status']): string {
  switch (status) {
    case 'pending': return '○';
    case 'running': return '◐';
    case 'completed': return '✓';
    case 'error': return '✕';
  }
}

function getToolIcon(name: string): string {
  if (name === 'web_search') return '🔍';
  if (name === 'google_drive_search') return '📁';
  if (name === 'create_artifact') return '🎨';
  if (name === 'update_artifact') return '✏️';
  if (name === 'read_artifact') return '📄';
  if (name === 'execute_sql') return '🗄️';
  if (name === 'get_db_schema') return '📊';
  if (name.startsWith('builtin_')) return '🔧';
  if (name.startsWith('mcp_')) return '🔌';
  return '⚙️';
}

function getToolDisplayName(name: string): string {
  // Artifact tool display names
  if (name === 'create_artifact') return 'Create Artifact';
  if (name === 'update_artifact') return 'Update Artifact';
  if (name === 'read_artifact') return 'Read Artifact';

  // Remove prefixes for cleaner display
  let displayName = name;
  if (name.startsWith('builtin_')) {
    displayName = name.slice(8);
  } else if (name.startsWith('mcp_')) {
    // mcp_serverId_toolName -> serverId/toolName
    const parts = name.slice(4).split('_');
    if (parts.length >= 2) {
      displayName = `${parts[0]}/${parts.slice(1).join('_')}`;
    }
  }

  // Convert snake_case to Title Case
  return displayName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface SingleToolCallProps {
  toolCall: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
  inline?: boolean;
}

function SingleToolCall({ toolCall, isExpanded, onToggle, inline }: SingleToolCallProps) {
  const { name, params, status, result, error, startedAt, completedAt } = toolCall;
  const queryParam = params?.query as string | undefined;

  // Format result for display - handle both string and object results
  const formatResult = () => {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  };

  return (
    <div className={`tool-call-item tool-call-${status} ${inline ? 'tool-call-inline' : ''}`}>
      <button className="tool-call-header" onClick={onToggle}>
        <div className="tool-call-header-left">
          <span className={`tool-call-status-icon status-${status}`}>
            {getStatusIcon(status)}
          </span>
          <span className="tool-call-icon">{getToolIcon(name)}</span>
          <span className="tool-call-name">{getToolDisplayName(name)}</span>
          {queryParam && (
            <span className="tool-call-query">&quot;{queryParam}&quot;</span>
          )}
        </div>
        <div className="tool-call-header-right">
          {(status === 'running' || status === 'completed' || status === 'error') && (
            <span className="tool-call-duration">
              {formatDuration(startedAt, completedAt)}
            </span>
          )}
          <span className={`tool-call-expand ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="tool-call-details">
          {params && Object.keys(params).length > 0 && (
            <div className="tool-call-section">
              <div className="tool-call-section-title">Parameters</div>
              <pre className="tool-call-params">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}

          {status === 'error' && error && (
            <div className="tool-call-section tool-call-error">
              <div className="tool-call-section-title">Error</div>
              <div className="tool-call-error-message">{String(error)}</div>
            </div>
          )}

          {status === 'completed' && result !== undefined && result !== null && (
            <div className="tool-call-section">
              <div className="tool-call-section-title">Result</div>
              {(() => {
                // Check for structured search responses
                if (name === 'web_search') {
                  const webSearch = tryParseWebSearchResponse(result);
                  if (webSearch) return <WebSearchResultsList response={webSearch} />;
                }
                if (name === 'google_drive_search') {
                  const driveSearch = tryParseGoogleDriveResponse(result);
                  if (driveSearch) return <GoogleDriveResultsList response={driveSearch} />;
                }
                if (name === 'memory_search') {
                  const memorySearch = tryParseMemorySearchResponse(result);
                  if (memorySearch) return <MemorySearchResultsList response={memorySearch} />;
                }
                if (name === 'rag_search') {
                  const ragSearch = tryParseRAGSearchResponse(result);
                  if (ragSearch) return <RAGSearchResultsList response={ragSearch} />;
                }
                const formatted = formatResult();
                const sqlResult = tryParseSqlResult(formatted);
                if (sqlResult) {
                  return <SqlResultTable result={sqlResult} />;
                }
                return <pre className="tool-call-result-text">{formatted}</pre>;
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ToolCallDisplay({ toolCalls, inline = false }: ToolCallDisplayProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`tool-calls-container ${inline ? 'tool-calls-inline' : ''}`}>
      {!inline && (
        <div className="tool-calls-label">
          Tool{toolCalls.length > 1 ? 's' : ''} Used
        </div>
      )}
      {toolCalls.map(toolCall => (
        <SingleToolCall
          key={toolCall.id}
          toolCall={toolCall}
          isExpanded={expandedIds.has(toolCall.id)}
          onToggle={() => toggleExpand(toolCall.id)}
          inline={inline}
        />
      ))}
    </div>
  );
}
