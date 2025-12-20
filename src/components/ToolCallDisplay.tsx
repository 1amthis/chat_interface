'use client';

import { useState } from 'react';
import { ToolCall } from '@/types';

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
  if (name.startsWith('builtin_')) return '🔧';
  if (name.startsWith('mcp_')) return '🔌';
  return '⚙️';
}

function getToolDisplayName(name: string): string {
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
              <pre className="tool-call-result-text">
                {formatResult()}
              </pre>
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
