'use client';

import { useState, useCallback } from 'react';
import { Artifact, ArtifactType } from '@/types';

interface ArtifactManagerProps {
  artifacts: Artifact[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (artifactId: string) => void;
  onRename: (artifactId: string, newTitle: string) => void;
  onDelete: (artifactId: string) => void;
}

const TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  html: 'HTML',
  react: 'React',
  markdown: 'Markdown',
  svg: 'SVG',
  mermaid: 'Diagram',
  document: 'Document',
  spreadsheet: 'Sheet',
  presentation: 'Slides',
};

const TYPE_ICONS: Record<ArtifactType, React.ReactNode> = {
  code: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  html: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  react: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
    </svg>
  ),
  markdown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  svg: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  mermaid: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h4m5 5H6a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
    </svg>
  ),
  spreadsheet: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4V4zm0 5h16M9 4v16m6-16v16" />
    </svg>
  ),
  presentation: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18v12H3V5zm8 12v2m-4 0h8" />
    </svg>
  ),
};

export function ArtifactManager({
  artifacts,
  isOpen,
  onClose,
  onSelect,
  onRename,
  onDelete,
}: ArtifactManagerProps) {
  const [filter, setFilter] = useState<ArtifactType | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredArtifacts = filter === 'all'
    ? artifacts
    : artifacts.filter(a => a.type === filter);

  const handleStartEdit = useCallback((artifact: Artifact) => {
    setEditingId(artifact.id);
    setEditTitle(artifact.title);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
      setEditingId(null);
      setEditTitle('');
    }
  }, [editingId, editTitle, onRename]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
  }, []);

  const handleExportAll = useCallback(() => {
    const json = JSON.stringify(artifacts, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'artifacts.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [artifacts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold">Artifacts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)]">
          <span className="text-sm text-gray-500">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ArtifactType | 'all')}
            className="text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background)]"
          >
            <option value="all">All types</option>
            <option value="code">Code</option>
            <option value="html">HTML</option>
            <option value="react">React</option>
            <option value="markdown">Markdown</option>
            <option value="svg">SVG</option>
            <option value="mermaid">Diagram</option>
            <option value="document">Document</option>
            <option value="spreadsheet">Spreadsheet</option>
            <option value="presentation">Presentation</option>
          </select>
          <div className="flex-1" />
          {artifacts.length > 0 && (
            <button
              onClick={handleExportAll}
              className="text-sm px-3 py-1 rounded border border-[var(--border-color)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Export All
            </button>
          )}
        </div>

        {/* Artifact list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredArtifacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {artifacts.length === 0
                ? 'No artifacts yet. Artifacts will appear here when created in conversations.'
                : 'No artifacts match the selected filter.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="text-gray-500">
                    {TYPE_ICONS[artifact.type]}
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === artifact.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="w-full px-2 py-1 border border-[var(--border-color)] rounded bg-[var(--background)] text-sm"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => onSelect(artifact.id)}
                        className="text-left w-full"
                      >
                        <p className="font-medium truncate">{artifact.title}</p>
                        <p className="text-xs text-gray-500">
                          {TYPE_LABELS[artifact.type]}
                          {artifact.language && ` (${artifact.language})`}
                          {' - '}
                          {new Date(artifact.updatedAt).toLocaleDateString()}
                        </p>
                      </button>
                    )}
                  </div>

                  <span className={`artifact-badge artifact-badge-${artifact.type} shrink-0`}>
                    {TYPE_LABELS[artifact.type]}
                  </span>

                  {editingId === artifact.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-green-500"
                        title="Save"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(artifact)}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        title="Rename"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(artifact.id)}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-500"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border-color)] text-sm text-gray-500">
          {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''} in this conversation
        </div>
      </div>
    </div>
  );
}
