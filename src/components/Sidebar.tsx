'use client';

import { useState, useMemo, useEffect } from 'react';
import { Conversation, Project, ProjectFile, PROJECT_COLORS, Provider, DEFAULT_MODELS } from '@/types';
import { getStorageStats, generateId } from '@/lib/storage';

interface SidebarProps {
  conversations: Conversation[];
  projects: Project[];
  currentId: string | null;
  currentProjectId: string | null;
  onSelect: (id: string) => void;
  onSelectProject: (projectId: string) => void;
  onNew: () => void;
  onNewInProject: (projectId: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  onCreateProject: (name: string, color: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onUpdateProjectInstructions: (id: string, instructions: string | undefined) => void;
  onUpdateProjectFiles: (id: string, files: ProjectFile[] | undefined) => void;
  onUpdateProjectProviderModel: (id: string, provider: Provider | undefined, model: string | undefined) => void;
  onMoveToProject: (conversationId: string, projectId: string | undefined) => void;
  onOpenKnowledgeBase: () => void;
  onOpenArtifactLibrary: () => void;
  onOpenModelsConfig: () => void;
  onOpenConnectorsConfig: () => void;
}

export function Sidebar({
  conversations,
  projects,
  currentId,
  currentProjectId,
  onSelect,
  onSelectProject,
  onNew,
  onNewInProject,
  onDelete,
  onOpenSettings,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onUpdateProjectInstructions,
  onUpdateProjectFiles,
  onUpdateProjectProviderModel,
  onMoveToProject,
  onOpenKnowledgeBase,
  onOpenArtifactLibrary,
  onOpenModelsConfig,
  onOpenConnectorsConfig,
}: SidebarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingProjectSettings, setEditingProjectSettings] = useState<{ id: string; name: string; instructions: string; files: ProjectFile[]; provider?: Provider; model?: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ conversationId: string; x: number; y: number } | null>(null);
  const [moveDropdownId, setMoveDropdownId] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storagePercentage, setStoragePercentage] = useState(0);

  // Update storage stats periodically
  useEffect(() => {
    const updateStorage = () => {
      const stats = getStorageStats();
      setStoragePercentage(Math.round(stats.percentage));
    };

    updateStorage();
    const interval = setInterval(updateStorage, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [conversations]);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      // Search in title
      if (conv.title.toLowerCase().includes(query)) return true;
      // Search in message content
      return conv.messages.some((msg) =>
        msg.content.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchQuery]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim(), newProjectColor);
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const handleRenameProject = (projectId: string) => {
    if (editingProjectName.trim()) {
      onRenameProject(projectId, editingProjectName.trim());
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    setContextMenu({ conversationId, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Group filtered conversations by project
  const unprojectConversations = filteredConversations.filter((c) => !c.projectId);
  const conversationsByProject = projects.reduce((acc, project) => {
    acc[project.id] = filteredConversations.filter((c) => c.projectId === project.id);
    return acc;
  }, {} as Record<string, Conversation[]>);

  const renderConversation = (conv: Conversation) => (
    <div
      key={conv.id}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-1 ${
        currentId === conv.id
          ? 'bg-[var(--border-color)]'
          : 'hover:bg-[var(--border-color)]/50'
      }`}
      onClick={() => onSelect(conv.id)}
      onContextMenu={(e) => handleContextMenu(e, conv.id)}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
      <span className="flex-1 truncate text-sm">{conv.title}</span>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMoveDropdownId(moveDropdownId === conv.id ? null : conv.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-500/20 rounded transition-opacity"
          title="Move to project"
        >
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </button>
        {moveDropdownId === conv.id && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoveDropdownId(null)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--background)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 min-w-[150px]">
              <div className="px-3 py-1 text-xs text-gray-500 font-medium">Move to project</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToProject(conv.id, undefined);
                  setMoveDropdownId(null);
                }}
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--border-color)] flex items-center gap-2 ${!conv.projectId ? 'bg-[var(--border-color)]/50' : ''}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                None
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveToProject(conv.id, project.id);
                    setMoveDropdownId(null);
                  }}
                  className={`w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--border-color)] flex items-center gap-2 ${conv.projectId === project.id ? 'bg-[var(--border-color)]/50' : ''}`}
                >
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: project.color }} />
                  {project.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conv.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
      >
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="w-64 h-screen bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex flex-col">
      <div className="p-3 space-y-2">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>

        {/* Search Input */}
        <div className="relative">
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
            placeholder="Search conversations..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* New Project Button */}
        <button
          onClick={() => setShowNewProject(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New project
        </button>

        {/* New Project Form */}
        {showNewProject && (
          <div className="p-2 bg-[var(--border-color)]/30 rounded-lg space-y-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full px-2 py-1 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setShowNewProject(false);
              }}
            />
            <div className="flex gap-1">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  className={`w-5 h-5 rounded-full ${newProjectColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewProject(false)}
                className="flex-1 px-2 py-1 text-xs border border-[var(--border-color)] rounded hover:bg-[var(--border-color)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {/* Projects */}
        {projects.map((project) => (
          <div key={project.id} className="mb-2">
            <div
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg ${currentProjectId === project.id ? 'bg-[var(--border-color)]' : 'hover:bg-[var(--border-color)]/50'}`}
            >
              <svg
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProject(project.id);
                }}
                className={`w-3 h-3 transition-transform cursor-pointer ${expandedProjects.has(project.id) ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <div
                onClick={() => onSelectProject(project.id)}
                className="w-3 h-3 rounded-sm cursor-pointer"
                style={{ backgroundColor: project.color }}
              />
              {editingProjectId === project.id ? (
                <input
                  type="text"
                  value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => handleRenameProject(project.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameProject(project.id);
                    if (e.key === 'Escape') {
                      setEditingProjectId(null);
                      setEditingProjectName('');
                    }
                  }}
                  className="flex-1 px-1 text-sm bg-[var(--background)] border border-[var(--border-color)] rounded"
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => onSelectProject(project.id)}
                  className="flex-1 truncate text-sm font-medium cursor-pointer hover:opacity-80"
                >
                  {project.name}
                </span>
              )}
              <span className="text-xs text-gray-500">{conversationsByProject[project.id]?.length || 0}</span>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewInProject(project.id);
                  }}
                  className="p-0.5 hover:bg-green-500/20 text-green-600 rounded"
                  title="New conversation in project"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProjectSettings({
                      id: project.id,
                      name: project.name,
                      instructions: project.instructions || '',
                      files: project.files || [],
                      provider: project.provider,
                      model: project.model,
                    });
                  }}
                  className="p-0.5 hover:bg-[var(--border-color)] rounded"
                  title="Project settings"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProjectId(project.id);
                    setEditingProjectName(project.name);
                  }}
                  className="p-0.5 hover:bg-[var(--border-color)] rounded"
                  title="Rename project"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project.id);
                  }}
                  className="p-0.5 hover:bg-red-500/20 rounded"
                  title="Delete project"
                >
                  <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {expandedProjects.has(project.id) && (
              <div className="ml-4 mt-1">
                {conversationsByProject[project.id]?.length ? (
                  conversationsByProject[project.id].map(renderConversation)
                ) : (
                  <p className="text-xs text-gray-500 px-3 py-1">No conversations</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Uncategorized conversations */}
        {projects.length > 0 && unprojectConversations.length > 0 && (
          <div className="mt-2 mb-1">
            <span className="px-2 text-xs text-gray-500 font-medium">Uncategorized</span>
          </div>
        )}
        {unprojectConversations.map(renderConversation)}

        {/* No search results message */}
        {searchQuery && filteredConversations.length === 0 && (
          <div className="px-3 py-4 text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No conversations found</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Context Menu for moving to folder */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 bg-[var(--background)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1 text-xs text-gray-500 font-medium">Move to project</div>
            <button
              onClick={() => {
                onMoveToProject(contextMenu.conversationId, undefined);
                closeContextMenu();
              }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--border-color)] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              None
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  onMoveToProject(contextMenu.conversationId, project.id);
                  closeContextMenu();
                }}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--border-color)] flex items-center gap-2"
              >
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: project.color }} />
                {project.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Project Settings Modal */}
      {editingProjectSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingProjectSettings(null)}>
          <div className="bg-[var(--background)] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Project Settings: {editingProjectSettings.name}</h3>

            {/* Instructions Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Project Instructions
                <span className="text-xs text-gray-500 ml-2">(Merged with global system prompt)</span>
              </label>
              <textarea
                value={editingProjectSettings.instructions}
                onChange={(e) => setEditingProjectSettings({
                  ...editingProjectSettings,
                  instructions: e.target.value,
                })}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] min-h-[100px]"
                placeholder="Additional instructions for all conversations in this project..."
              />
            </div>

            {/* Provider/Model Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Default Provider & Model
                <span className="text-xs text-gray-500 ml-2">(For new conversations in this project)</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={editingProjectSettings.provider || ''}
                  onChange={(e) => {
                    const newProvider = e.target.value as Provider | '';
                    setEditingProjectSettings({
                      ...editingProjectSettings,
                      provider: newProvider || undefined,
                      model: newProvider ? DEFAULT_MODELS[newProvider as Provider][0] : undefined,
                    });
                  }}
                  className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)]"
                >
                  <option value="">Use global default</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="mistral">Mistral</option>
                  <option value="cerebras">Cerebras</option>
                </select>
                {editingProjectSettings.provider && (
                  <select
                    value={editingProjectSettings.model || ''}
                    onChange={(e) => setEditingProjectSettings({
                      ...editingProjectSettings,
                      model: e.target.value || undefined,
                    })}
                    className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)]"
                  >
                    {DEFAULT_MODELS[editingProjectSettings.provider].map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Files Section */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reference Files
                <span className="text-xs text-gray-500 ml-2">(Attached to all conversations)</span>
              </label>
              <div className="space-y-2">
                {editingProjectSettings.files.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-2 bg-[var(--border-color)]/30 rounded">
                    <span className="flex-1 text-sm truncate">{file.name}</span>
                    <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                    <button
                      onClick={() => {
                        setEditingProjectSettings({
                          ...editingProjectSettings,
                          files: editingProjectSettings.files.filter(f => f.id !== file.id),
                        });
                      }}
                      className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-[var(--border-color)] rounded-lg cursor-pointer hover:bg-[var(--border-color)]/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm">Add file</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,text/*,.pdf,.doc,.docx,.txt,.md,.json,.xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          const newFile: ProjectFile = {
                            id: generateId(),
                            type: file.type.startsWith('image/') ? 'image' : 'file',
                            name: file.name,
                            mimeType: file.type,
                            data: base64,
                            size: file.size,
                            addedAt: Date.now(),
                          };
                          setEditingProjectSettings({
                            ...editingProjectSettings,
                            files: [...editingProjectSettings.files, newFile],
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingProjectSettings(null)}
                className="px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--border-color)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateProjectInstructions(editingProjectSettings.id, editingProjectSettings.instructions || undefined);
                  onUpdateProjectFiles(editingProjectSettings.id, editingProjectSettings.files.length > 0 ? editingProjectSettings.files : undefined);
                  onUpdateProjectProviderModel(editingProjectSettings.id, editingProjectSettings.provider, editingProjectSettings.model);
                  setEditingProjectSettings(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-[var(--border-color)] space-y-2">
        {/* Storage indicator */}
        {storagePercentage > 0 && (
          <div className="px-3 py-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Storage</span>
              <span className={storagePercentage > 80 ? 'text-orange-500 font-medium' : 'text-gray-500'}>
                {storagePercentage}%
              </span>
            </div>
            <div className="w-full h-1.5 mt-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  storagePercentage > 90
                    ? 'bg-red-500'
                    : storagePercentage > 80
                    ? 'bg-orange-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(storagePercentage, 100)}%` }}
              />
            </div>
            {storagePercentage > 80 && (
              <p className="mt-1 text-[11px] text-orange-600 dark:text-orange-400">
                High usage
              </p>
            )}
          </div>
        )}

        <button
          onClick={onOpenKnowledgeBase}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--border-color)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Knowledge Base
        </button>
        <button
          onClick={onOpenArtifactLibrary}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--border-color)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h3l2-2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
          </svg>
          Artifacts
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-[var(--border-color)] transition-colors"
            aria-expanded={showMoreMenu}
            aria-haspopup="menu"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              More
            </span>
            <svg className={`w-3 h-3 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-[var(--background)] border border-[var(--border-color)] rounded-lg shadow-lg py-1">
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenModelsConfig();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--border-color)]"
                  role="menuitem"
                >
                  Models
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenConnectorsConfig();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--border-color)]"
                  role="menuitem"
                >
                  Connectors
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--border-color)]"
                  role="menuitem"
                >
                  Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
