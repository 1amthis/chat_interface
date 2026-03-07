'use client';

import { useState, useMemo, useEffect } from 'react';
import { Conversation, Project, ProjectFile, PROJECT_COLORS, Provider, DEFAULT_MODELS } from '@/types';
import { getStorageStats, generateId } from '@/lib/storage';

type SidebarView = 'chat' | 'knowledge-base' | 'artifact-library' | 'models' | 'connectors' | 'prompt-library' | 'settings';

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
  onOpenPromptLibrary: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  activeView?: SidebarView;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))}m`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))}h`;
  }
  if (diff < 7 * day) {
    return `${Math.max(1, Math.round(diff / day))}d`;
  }

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

function SectionLabel({ label, count, action }: { label: string; count?: number; action?: JSX.Element | null }) {
  return (
    <div className="mb-1.5 flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</span>
        {count !== undefined && (
          <span className="rounded-full border border-[var(--border-color)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-gray-500">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function getNavButtonClass(isActive: boolean): string {
  if (isActive) {
    return 'border-blue-200 bg-blue-50/80 text-blue-700 shadow-sm dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-300';
  }
  return 'border-transparent text-[var(--foreground)] hover:border-[var(--border-color)] hover:bg-[var(--background)]/80';
}

function getCompactNavButtonClass(isActive: boolean): string {
  const base = getNavButtonClass(isActive);
  return `${base} flex min-h-[3rem] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-center text-[10px] leading-tight`;
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
  onOpenPromptLibrary,
  mobileOpen = false,
  onCloseMobile,
  activeView = 'chat',
}: SidebarProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingProjectSettings, setEditingProjectSettings] = useState<{ id: string; name: string; instructions: string; files: ProjectFile[]; provider?: Provider; model?: string } | null>(null);
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
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

  const closeMobile = () => {
    onCloseMobile?.();
  };

  // Group filtered conversations by project
  const unprojectConversations = filteredConversations.filter((c) => !c.projectId);
  const conversationsByProject = projects.reduce((acc, project) => {
    acc[project.id] = filteredConversations.filter((c) => c.projectId === project.id);
    return acc;
  }, {} as Record<string, Conversation[]>);
  const visibleProjects = searchQuery.trim()
    ? projects.filter((project) => (conversationsByProject[project.id]?.length || 0) > 0)
    : projects;
  const shouldShowStorageWarning = storagePercentage >= 80;

  const renderConversation = (conv: Conversation) => {
    const isActive = currentId === conv.id;
    const updatedLabel = formatRelativeTime(conv.updatedAt);

    return (
      <div
        key={conv.id}
        className={`group mb-1 rounded-lg border px-2.5 py-2 transition-colors ${
          isActive
            ? 'border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-800/60 dark:bg-blue-950/20'
            : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--background)]/80'
        }`}
        onClick={() => {
          onSelect(conv.id);
          closeMobile();
        }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">{conv.title}</span>
              <span className="shrink-0 pt-0.5 text-[11px] text-gray-500">{updatedLabel}</span>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConversationMenuId(conversationMenuId === conv.id ? null : conv.id);
              }}
              className="rounded-md p-1 text-gray-500 transition-colors hover:bg-[var(--border-color)] hover:text-[var(--foreground)]"
              title="Conversation options"
              aria-label={`Options for ${conv.title}`}
              aria-expanded={conversationMenuId === conv.id}
              aria-haspopup="menu"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                />
              </svg>
            </button>
            {conversationMenuId === conv.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setConversationMenuId(null)} />
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-lg border border-[var(--border-color)] bg-[var(--background)] py-1 shadow-lg">
                  <div className="px-3 py-1 text-xs font-medium text-gray-500">Move to project</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToProject(conv.id, undefined);
                      setConversationMenuId(null);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--border-color)] ${!conv.projectId ? 'bg-[var(--border-color)]/50' : ''}`}
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
                        setConversationMenuId(null);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--border-color)] ${conv.projectId === project.id ? 'bg-[var(--border-color)]/50' : ''}`}
                    >
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: project.color }} />
                      {project.name}
                    </button>
                  ))}
                  <div className="my-1 border-t border-[var(--border-color)]" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                      setConversationMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-500/10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete conversation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-[min(20rem,calc(100vw-1.5rem))] flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] transition-transform duration-200 md:static md:z-0 md:h-screen md:w-72 ${
        mobileOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="md:hidden flex items-center justify-between border-b border-[var(--border-color)] px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Workspace</p>
          <p className="text-xs text-gray-500">Chats, projects, and settings</p>
        </div>
        <button
          onClick={closeMobile}
          className="p-1.5 rounded-lg hover:bg-[var(--border-color)] transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 border-b border-[var(--border-color)] px-3 py-2.5">
        <button
          onClick={() => {
            onNew();
            closeMobile();
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--border-color)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>

        {/* Search Input */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
            placeholder="Search chats..."
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background)] py-2 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2.5">
          <div className="mb-4">
              <SectionLabel
                label="Projects"
                count={visibleProjects.length}
                action={
                  <button
                    onClick={() => setShowNewProject((prev) => !prev)}
                    className="rounded-md p-1 text-gray-500 transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                    aria-label={showNewProject ? 'Close new project form' : 'Create project'}
                    title={showNewProject ? 'Close new project form' : 'Create project'}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showNewProject ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
                    </svg>
                  </button>
                }
              />

              {showNewProject && (
                <div className="mb-2 rounded-lg bg-[var(--border-color)]/30 p-2 space-y-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="w-full rounded border border-[var(--border-color)] bg-[var(--background)] px-2 py-1.5 text-sm"
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
                        className={`h-4 w-4 rounded-full ${newProjectColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateProject}
                      className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewProject(false)}
                      className="flex-1 rounded border border-[var(--border-color)] px-2 py-1.5 text-xs hover:bg-[var(--border-color)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {visibleProjects.length > 0 && (
                <div className="space-y-1.5">
                  {visibleProjects.map((project) => {
                    const projectConversationCount = conversationsByProject[project.id]?.length || 0;
                    const isExpanded = searchQuery.trim()
                      ? projectConversationCount > 0 || expandedProjects.has(project.id)
                      : expandedProjects.has(project.id);

                    return (
                      <div key={project.id}>
                        <div
                          className={`group rounded-lg border px-2.5 py-2 transition-colors ${
                            currentProjectId === project.id
                              ? 'border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-800/60 dark:bg-blue-950/20'
                              : 'border-transparent hover:border-[var(--border-color)] hover:bg-[var(--background)]/80'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProject(project.id);
                              }}
                              className={`mt-0.5 rounded-md p-0.5 text-gray-500 transition-transform hover:bg-[var(--border-color)] ${isExpanded ? 'rotate-90' : ''}`}
                              aria-label={isExpanded ? 'Collapse project' : 'Expand project'}
                            >
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>

                            <div className="min-w-0 flex-1">
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
                                  className="w-full rounded border border-[var(--border-color)] bg-[var(--background)] px-2 py-1 text-sm"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    onSelectProject(project.id);
                                    closeMobile();
                                  }}
                                  className="w-full min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project.color }} />
                                    <span className="truncate text-[13px] font-semibold leading-5">{project.name}</span>
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-gray-500">
                                    <span className="shrink-0">
                                      {projectConversationCount} chat{projectConversationCount === 1 ? '' : 's'}
                                    </span>
                                    {project.model && <span className="min-w-0 truncate">• {project.model}</span>}
                                  </div>
                                </button>
                              )}
                            </div>

                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectMenuId(projectMenuId === project.id ? null : project.id);
                                }}
                                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-[var(--border-color)] hover:text-[var(--foreground)]"
                                title="Project options"
                                aria-label={`Options for ${project.name}`}
                                aria-expanded={projectMenuId === project.id}
                                aria-haspopup="menu"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 6.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                                  />
                                </svg>
                              </button>
                              {projectMenuId === project.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setProjectMenuId(null)} />
                                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[190px] rounded-lg border border-[var(--border-color)] bg-[var(--background)] py-1 shadow-lg">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNewInProject(project.id);
                                        setProjectMenuId(null);
                                        closeMobile();
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--border-color)]"
                                    >
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      New conversation
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
                                        setProjectMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--border-color)]"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      Project settings
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProjectId(project.id);
                                        setEditingProjectName(project.name);
                                        setProjectMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--border-color)]"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Rename project
                                    </button>
                                    <div className="my-1 border-t border-[var(--border-color)]" />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteProject(project.id);
                                        setProjectMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete project
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="ml-4 mt-1.5 border-l border-[var(--border-color)] pl-2.5">
                            {projectConversationCount > 0 ? (
                              conversationsByProject[project.id].map(renderConversation)
                            ) : (
                              <p className="px-1 py-1 text-xs text-gray-500">
                                {searchQuery.trim() ? 'No matching conversations' : 'No conversations yet'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <SectionLabel label="Chats" count={unprojectConversations.length} />
              {unprojectConversations.length > 0 ? (
                <div className="space-y-1">
                  {unprojectConversations.map(renderConversation)}
                </div>
              ) : searchQuery ? (
                filteredConversations.length === 0 ? (
                  <div className="px-3 py-4 text-center text-gray-500">
                    <svg className="mx-auto mb-2 h-8 w-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm">No conversations found</p>
                    <p className="mt-1 text-xs">Try a different search term</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border-color)] px-3 py-3 text-[13px] text-gray-500">
                    Matching conversations are grouped inside projects above.
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border-color)] px-3 py-3 text-[13px] text-gray-500">
                  Start a new chat or create a project to organize ongoing work.
                </div>
              )}
            </div>
        </div>

      </div>

      <div className="border-t border-[var(--border-color)] bg-[var(--background)]/55 px-2.5 py-2">
        {shouldShowStorageWarning && (
          <div className="mb-2 rounded-lg border border-orange-200 bg-orange-50/80 px-2.5 py-1.5 text-[11px] text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
            <div className="flex items-center justify-between">
              <span className="font-medium">Storage</span>
              <span>{storagePercentage}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-orange-100 dark:bg-orange-900/40">
              <div
                className={`h-full ${storagePercentage > 90 ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(storagePercentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              onOpenKnowledgeBase();
              closeMobile();
            }}
            className={getCompactNavButtonClass(activeView === 'knowledge-base')}
            title="Knowledge base"
            aria-label="Open knowledge base"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="truncate">Knowledge</span>
          </button>
          <button
            onClick={() => {
              onOpenPromptLibrary();
              closeMobile();
            }}
            className={getCompactNavButtonClass(activeView === 'prompt-library')}
            title="Prompts"
            aria-label="Open prompt library"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span className="truncate">Prompts</span>
          </button>
          <button
            onClick={() => {
              onOpenArtifactLibrary();
              closeMobile();
            }}
            className={getCompactNavButtonClass(activeView === 'artifact-library')}
            title="Artifacts"
            aria-label="Open artifact library"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h3l2-2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">Artifacts</span>
          </button>
          <button
            onClick={() => {
              onOpenModelsConfig();
              closeMobile();
            }}
            className={getCompactNavButtonClass(activeView === 'models')}
            title="Models"
            aria-label="Open models configuration"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">Models</span>
          </button>
          <button
            onClick={() => {
              onOpenConnectorsConfig();
              closeMobile();
            }}
            className={getCompactNavButtonClass(activeView === 'connectors')}
            title="Connectors"
            aria-label="Open connectors configuration"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="truncate">Connectors</span>
          </button>
          <button
            onClick={() => {
              onOpenSettings();
              closeMobile();
            }}
            className={getCompactNavButtonClass(activeView === 'settings')}
            title="Settings"
            aria-label="Open settings"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">Settings</span>
          </button>
        </div>
      </div>

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

    </div>
  );
}
