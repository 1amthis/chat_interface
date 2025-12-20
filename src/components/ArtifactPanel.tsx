'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Artifact, ArtifactType } from '@/types';
import { ArtifactPreview } from './ArtifactPreview';

interface ArtifactPanelProps {
  artifact: Artifact | undefined;
  width: number; // percentage
  onClose: () => void;
  onResize: (width: number) => void;
  onRename: (artifactId: string, newTitle: string) => void;
  onDownload: (artifact: Artifact) => void;
}

const TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  html: 'HTML',
  react: 'React',
  markdown: 'Markdown',
  svg: 'SVG',
  mermaid: 'Diagram',
};

const FILE_EXTENSIONS: Record<ArtifactType, string> = {
  code: 'txt',
  html: 'html',
  react: 'jsx',
  markdown: 'md',
  svg: 'svg',
  mermaid: 'mmd',
};

function getFileExtension(artifact: Artifact): string {
  if (artifact.language) {
    const langMap: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      sql: 'sql',
      json: 'json',
      yaml: 'yaml',
      xml: 'xml',
      css: 'css',
      scss: 'scss',
      html: 'html',
      shell: 'sh',
      bash: 'sh',
    };
    return langMap[artifact.language.toLowerCase()] || artifact.language;
  }
  return FILE_EXTENSIONS[artifact.type];
}

export function ArtifactPanel({
  artifact,
  width,
  onClose,
  onResize,
  onRename,
  onDownload,
}: ArtifactPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Handle resize dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();

      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;
      const clampedWidth = Math.min(Math.max(newWidth, 20), 80);
      onResize(clampedWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  const handleResizeStart = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleCopy = useCallback(async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact]);

  const handleDownload = useCallback(() => {
    if (!artifact) return;
    const ext = getFileExtension(artifact);
    const filename = `${artifact.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onDownload(artifact);
  }, [artifact, onDownload]);

  const handleStartEdit = useCallback(() => {
    if (!artifact) return;
    setEditTitle(artifact.title);
    setIsEditing(true);
  }, [artifact]);

  const handleSaveEdit = useCallback(() => {
    if (!artifact || !editTitle.trim()) return;
    onRename(artifact.id, editTitle.trim());
    setIsEditing(false);
  }, [artifact, editTitle, onRename]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditTitle('');
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          handleCancelEdit();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, handleCancelEdit, onClose]);

  if (!artifact) {
    return null;
  }

  const showCodeToggle = ['html', 'react', 'svg', 'mermaid', 'markdown'].includes(artifact.type);

  return (
    <div
      className="artifact-panel"
      style={{ width: `${width}%` }}
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="artifact-panel-resize-handle"
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="flex-1 px-2 py-1 border border-[var(--border-color)] rounded bg-[var(--background)] text-sm"
              autoFocus
            />
          ) : (
            <h3
              className="font-medium truncate cursor-pointer hover:text-blue-500"
              onClick={handleStartEdit}
              title="Click to rename"
            >
              {artifact.title}
            </h3>
          )}
          <span className={`artifact-badge artifact-badge-${artifact.type} shrink-0`}>
            {TYPE_LABELS[artifact.type]}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 text-xs border border-[var(--border-color)] rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* View mode toggle */}
      {showCodeToggle && (
        <div className="flex border-b border-[var(--border-color)]">
          <button
            onClick={() => setViewMode('preview')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'preview'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'code'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Code
          </button>
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'code' || artifact.type === 'code' ? (
          <ArtifactPreview
            artifact={{ ...artifact, type: 'code' }}
            versionIndex={selectedVersionIndex}
          />
        ) : (
          <ArtifactPreview artifact={artifact} versionIndex={selectedVersionIndex} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-color)] bg-[var(--background)]">
        <div className="flex items-center gap-2">
          {artifact.versions.length > 1 && (
            <select
              value={selectedVersionIndex ?? 'current'}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedVersionIndex(val === 'current' ? undefined : parseInt(val, 10));
              }}
              className="text-xs px-2 py-1 border border-[var(--border-color)] rounded bg-[var(--background)]"
            >
              <option value="current">Current</option>
              {artifact.versions.map((v, i) => (
                <option key={v.id} value={i}>
                  v{i + 1} - {new Date(v.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs border border-[var(--border-color)] rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
