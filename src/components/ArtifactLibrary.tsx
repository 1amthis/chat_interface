'use client';

import { useMemo, useState } from 'react';
import { ARTIFACT_TYPES, Artifact, ArtifactType, Conversation, Project } from '@/types';

interface ArtifactLibraryProps {
  conversations: Conversation[];
  projects: Project[];
  onOpenArtifact: (conversationId: string, artifactId: string) => void;
  onClose: () => void;
}

interface ArtifactLibraryEntry {
  artifact: Artifact;
  conversationId: string;
  conversationTitle: string;
  projectName?: string;
}

const TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  html: 'HTML',
  react: 'React',
  markdown: 'Markdown',
  svg: 'SVG',
  mermaid: 'Diagram',
  document: 'Document',
  spreadsheet: 'Spreadsheet',
  presentation: 'Presentation',
};

export function ArtifactLibrary({
  conversations,
  projects,
  onOpenArtifact,
  onClose,
}: ArtifactLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | 'all'>('all');

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);

  const entries = useMemo(() => {
    const all: ArtifactLibraryEntry[] = [];
    conversations.forEach((conversation) => {
      (conversation.artifacts || []).forEach((artifact) => {
        all.push({
          artifact,
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          projectName: conversation.projectId ? projectNameById.get(conversation.projectId) : undefined,
        });
      });
    });

    return all.sort((a, b) => b.artifact.updatedAt - a.artifact.updatedAt);
  }, [conversations, projectNameById]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.artifact.type !== typeFilter) {
        return false;
      }

      if (!query) return true;

      const inTitle = entry.artifact.title.toLowerCase().includes(query);
      const inConversation = entry.conversationTitle.toLowerCase().includes(query);
      const inProject = entry.projectName?.toLowerCase().includes(query) || false;
      const inLanguage = entry.artifact.language?.toLowerCase().includes(query) || false;

      return inTitle || inConversation || inProject || inLanguage;
    });
  }, [entries, searchQuery, typeFilter]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h3l2-2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">Artifact Library</h1>
              <p className="text-sm text-gray-500">
                {entries.length} artifact{entries.length !== 1 ? 's' : ''} across {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </p>
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-emerald-50/50 dark:bg-emerald-900/10">
            <p className="text-xs text-gray-500">Total artifacts</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </div>
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-blue-50/50 dark:bg-blue-900/10">
            <p className="text-xs text-gray-500">Artifact types</p>
            <p className="text-2xl font-bold">{new Set(entries.map(e => e.artifact.type)).size}</p>
          </div>
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-violet-50/50 dark:bg-violet-900/10">
            <p className="text-xs text-gray-500">Filtered</p>
            <p className="text-2xl font-bold">{filteredEntries.length}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by artifact title, conversation, project, language..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ArtifactType | 'all')}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--background)]"
          >
            <option value="all">All types</option>
            {ARTIFACT_TYPES.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-[var(--border-color)] rounded-lg text-gray-500">
            {entries.length === 0
              ? 'No artifacts yet. Create artifacts in a conversation and they will appear here.'
              : 'No artifacts match your filters.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => (
              <div
                key={`${entry.conversationId}:${entry.artifact.id}`}
                className="border border-[var(--border-color)] rounded-lg p-4 hover:bg-[var(--border-color)]/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{entry.artifact.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      In: {entry.conversationTitle}
                      {entry.projectName ? ` · Project: ${entry.projectName}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Updated: {new Date(entry.artifact.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`artifact-badge artifact-badge-${entry.artifact.type}`}>
                      {TYPE_LABELS[entry.artifact.type]}
                    </span>
                    <button
                      onClick={() => onOpenArtifact(entry.conversationId, entry.artifact.id)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
