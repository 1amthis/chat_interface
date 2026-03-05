'use client';

import { useState, useRef, useCallback } from 'react';
import { ChatSettings, PromptType } from '@/types';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import { PromptDiffView } from './PromptDiffView';

interface PromptLibraryProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onApplySystemPrompt: (content: string, target: 'global' | 'conversation') => void;
  onInsertUserTemplate: (content: string) => void;
  hasActiveConversation: boolean;
  onClose: () => void;
}

type Tab = 'edit' | 'history' | 'diff';

export function PromptLibrary({
  onApplySystemPrompt,
  onInsertUserTemplate,
  hasActiveConversation,
  onClose,
}: PromptLibraryProps) {
  const {
    filteredPrompts,
    selectedPrompt,
    selectedPromptId,
    filter,
    allTags,
    selectPrompt,
    createPrompt,
    updatePromptContent,
    updatePromptMetadata,
    removePrompt,
    duplicatePrompt,
    revertToVersion,
    updateFilter,
    handleExport,
    handleImport,
  } = usePromptLibrary();

  const [activeTab, setActiveTab] = useState<Tab>('edit');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editType, setEditType] = useState<PromptType>('system');
  const [changeMessage, setChangeMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [diffLeftIdx, setDiffLeftIdx] = useState(0);
  const [diffRightIdx, setDiffRightIdx] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Load prompt fields into edit state
  const loadPromptIntoEditor = useCallback(
    (promptId: string | null) => {
      selectPrompt(promptId);
      setIsCreating(false);
      if (promptId) {
        // We need to find the prompt from filtered or all
        const allPrompts = filteredPrompts;
        const p = allPrompts.find((p) => p.id === promptId);
        if (p) {
          setEditTitle(p.title);
          setEditContent(p.content);
          setEditDescription(p.description ?? '');
          setEditTags(p.tags?.join(', ') ?? '');
          setEditType(p.type);
          setChangeMessage('');
          setDiffLeftIdx(0);
          setDiffRightIdx(Math.max(0, p.versions.length - 1));
        }
      }
    },
    [selectPrompt, filteredPrompts]
  );

  const handleCreate = () => {
    setIsCreating(true);
    selectPrompt(null);
    setEditTitle('');
    setEditContent('');
    setEditDescription('');
    setEditTags('');
    setEditType('system');
    setChangeMessage('');
    setActiveTab('edit');
  };

  const handleSave = () => {
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (isCreating) {
      if (!editTitle.trim() || !editContent.trim()) return;
      const p = createPrompt(editType, editTitle.trim(), editContent, editDescription || undefined, tags.length ? tags : undefined);
      setIsCreating(false);
      selectPrompt(p.id);
    } else if (selectedPrompt) {
      // Check if content changed
      if (editContent !== selectedPrompt.content) {
        updatePromptContent(selectedPrompt.id, editContent, changeMessage || undefined);
        setChangeMessage('');
      }
      // Update metadata if changed
      const metaUpdates: { title?: string; description?: string; tags?: string[]; type?: PromptType } = {};
      if (editTitle.trim() !== selectedPrompt.title) metaUpdates.title = editTitle.trim();
      if ((editDescription || undefined) !== (selectedPrompt.description || undefined)) metaUpdates.description = editDescription || undefined;
      const newTags = tags.length ? tags : undefined;
      if (JSON.stringify(newTags) !== JSON.stringify(selectedPrompt.tags)) metaUpdates.tags = newTags;
      if (editType !== selectedPrompt.type) metaUpdates.type = editType;
      if (Object.keys(metaUpdates).length > 0) {
        updatePromptMetadata(selectedPrompt.id, metaUpdates);
      }
    }
  };

  const handleUse = () => {
    const content = selectedPrompt?.content ?? editContent;
    if (!content) return;
    const type = selectedPrompt?.type ?? editType;
    if (type === 'system') {
      onApplySystemPrompt(content, hasActiveConversation ? 'conversation' : 'global');
    } else {
      onInsertUserTemplate(content);
    }
  };

  const handleImportFile = () => {
    importRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const count = handleImport(reader.result as string);
        alert(`Imported ${count} new prompt(s).`);
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isDirty =
    selectedPrompt &&
    !isCreating &&
    (editContent !== selectedPrompt.content ||
      editTitle.trim() !== selectedPrompt.title ||
      (editDescription || undefined) !== (selectedPrompt.description || undefined) ||
      editType !== selectedPrompt.type ||
      JSON.stringify(
        editTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .length
          ? editTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined
      ) !== JSON.stringify(selectedPrompt.tags));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <h1 className="text-lg font-semibold">Prompt Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Export
          </button>
          <button
            onClick={handleImportFile}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Import
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel - prompt list */}
        <div className="w-80 border-r border-[var(--border-color)] flex flex-col">
          {/* Filters */}
          <div className="p-3 space-y-2 border-b border-[var(--border-color)]">
            <input
              type="text"
              placeholder="Search prompts..."
              value={filter.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <select
                value={filter.type}
                onChange={(e) => updateFilter({ type: e.target.value as PromptType | 'all' })}
                className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-primary)]"
              >
                <option value="all">All Types</option>
                <option value="system">System</option>
                <option value="user">User</option>
              </select>
              <select
                value={filter.tag ?? ''}
                onChange={(e) => updateFilter({ tag: e.target.value || null })}
                className="flex-1 px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-primary)]"
              >
                <option value="">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* New button */}
          <div className="p-3 border-b border-[var(--border-color)]">
            <button
              onClick={handleCreate}
              className="w-full px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              + New Prompt
            </button>
          </div>

          {/* Prompt list */}
          <div className="flex-1 overflow-y-auto">
            {filteredPrompts.length === 0 ? (
              <div className="p-4 text-sm text-[var(--text-secondary)] text-center">
                {filter.search || filter.type !== 'all' || filter.tag ? 'No matching prompts' : 'No prompts yet. Create one to get started.'}
              </div>
            ) : (
              filteredPrompts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    loadPromptIntoEditor(p.id);
                    setActiveTab('edit');
                  }}
                  className={`p-3 border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors ${
                    selectedPromptId === p.id && !isCreating ? 'bg-[var(--bg-secondary)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        p.type === 'system'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}
                    >
                      {p.type}
                    </span>
                    <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-[var(--text-secondary)] truncate mb-1">{p.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {p.tags?.map((t) => (
                      <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                        {t}
                      </span>
                    ))}
                    <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                      v{p.versions.length}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel - editor/history/diff */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedPrompt && !isCreating ? (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
              Select a prompt or create a new one
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center border-b border-[var(--border-color)]">
                {(['edit', 'history', 'diff'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    disabled={isCreating && tab !== 'edit'}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    } ${isCreating && tab !== 'edit' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'edit' && (
                  <div className="p-4 space-y-4">
                    {/* Title & Type */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Prompt title"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Type</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as PromptType)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
                        >
                          <option value="system">System</option>
                          <option value="user">User</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description</label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Brief description (optional)"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="coding, analysis, creative"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Content */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Content</label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Enter your prompt here..."
                        rows={12}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-y"
                      />
                    </div>

                    {/* Change message (only when editing existing) */}
                    {!isCreating && selectedPrompt && editContent !== selectedPrompt.content && (
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                          Change message (optional)
                        </label>
                        <input
                          type="text"
                          value={changeMessage}
                          onChange={(e) => setChangeMessage(e.target.value)}
                          placeholder="Describe what changed"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={isCreating && (!editTitle.trim() || !editContent.trim())}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCreating ? 'Create' : isDirty ? 'Save Changes' : 'Save'}
                      </button>

                      {!isCreating && selectedPrompt && (
                        <>
                          {(selectedPrompt.type === 'system' || editType === 'system') && (
                            <>
                              <button
                                onClick={() => onApplySystemPrompt(selectedPrompt.content, 'global')}
                                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                                title="Set as global system prompt"
                              >
                                Set Global
                              </button>
                              <button
                                onClick={() => onApplySystemPrompt(selectedPrompt.content, 'conversation')}
                                disabled={!hasActiveConversation}
                                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title={hasActiveConversation ? 'Set as conversation system prompt' : 'Open a conversation first'}
                              >
                                Set Conversation
                              </button>
                            </>
                          )}
                          {(selectedPrompt.type === 'user' || editType === 'user') && (
                            <button
                              onClick={handleUse}
                              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                              Insert into Chat
                            </button>
                          )}
                          <button
                            onClick={() => duplicatePrompt(selectedPrompt.id)}
                            className="px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                          >
                            Duplicate
                          </button>
                          {confirmDeleteId === selectedPrompt.id ? (
                            <div className="flex items-center gap-1 ml-auto">
                              <span className="text-xs text-red-500">Delete?</span>
                              <button
                                onClick={() => {
                                  removePrompt(selectedPrompt.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs rounded border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(selectedPrompt.id)}
                              className="px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'history' && selectedPrompt && (
                  <div className="p-4">
                    {selectedPrompt.versions.length === 0 ? (
                      <div className="text-sm text-[var(--text-secondary)] text-center py-8">No version history</div>
                    ) : (
                      <div className="space-y-2">
                        {[...selectedPrompt.versions].reverse().map((v, i) => {
                          const isLatest = i === 0;
                          return (
                            <div
                              key={v.id}
                              className="border border-[var(--border-color)] rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    Version {selectedPrompt.versions.length - i}
                                  </span>
                                  {isLatest && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                      current
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-[var(--text-secondary)]">
                                  {new Date(v.createdAt).toLocaleString()}
                                </span>
                              </div>
                              {v.message && (
                                <p className="text-xs text-[var(--text-secondary)] mb-2 italic">{v.message}</p>
                              )}
                              <pre className="text-xs bg-[var(--bg-secondary)] rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                                {v.content.length > 500 ? v.content.slice(0, 500) + '...' : v.content}
                              </pre>
                              {!isLatest && (
                                <button
                                  onClick={() => revertToVersion(selectedPrompt.id, v.id)}
                                  className="mt-2 px-3 py-1 text-xs rounded border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                  Revert to this version
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'diff' && selectedPrompt && (
                  <div className="flex flex-col h-full">
                    {selectedPrompt.versions.length < 2 ? (
                      <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-sm">
                        Need at least 2 versions to compare
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-3 border-b border-[var(--border-color)]">
                          <label className="text-xs text-[var(--text-secondary)]">Left:</label>
                          <select
                            value={diffLeftIdx}
                            onChange={(e) => setDiffLeftIdx(Number(e.target.value))}
                            className="px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-primary)]"
                          >
                            {selectedPrompt.versions.map((v, i) => (
                              <option key={v.id} value={i}>
                                v{i + 1} - {new Date(v.createdAt).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                          <label className="text-xs text-[var(--text-secondary)]">Right:</label>
                          <select
                            value={diffRightIdx}
                            onChange={(e) => setDiffRightIdx(Number(e.target.value))}
                            className="px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--bg-primary)]"
                          >
                            {selectedPrompt.versions.map((v, i) => (
                              <option key={v.id} value={i}>
                                v{i + 1} - {new Date(v.createdAt).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-h-0">
                          <PromptDiffView
                            leftContent={selectedPrompt.versions[diffLeftIdx]?.content ?? ''}
                            rightContent={selectedPrompt.versions[diffRightIdx]?.content ?? ''}
                            leftLabel={`Version ${diffLeftIdx + 1} - ${new Date(selectedPrompt.versions[diffLeftIdx]?.createdAt ?? 0).toLocaleString()}`}
                            rightLabel={`Version ${diffRightIdx + 1} - ${new Date(selectedPrompt.versions[diffRightIdx]?.createdAt ?? 0).toLocaleString()}`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
