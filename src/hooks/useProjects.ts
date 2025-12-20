/**
 * Hook for managing project state and actions
 */

import { useCallback } from 'react';
import { Project, ProjectFile, Provider, Conversation } from '@/types';
import {
  generateId,
  getProjects,
  saveProject,
  deleteProject as deleteProjectStorage,
  getConversations,
  updateConversationProject,
} from '@/lib/storage';

export interface UseProjectsOptions {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  setConversations: (convs: Conversation[]) => void;
  currentConversation: Conversation | null;
  setCurrentConversation: (conv: Conversation | null) => void;
}

export interface UseProjectsReturn {
  handleCreateProject: (name: string, color: string) => void;
  handleDeleteProject: (id: string) => void;
  handleRenameProject: (id: string, name: string) => void;
  handleUpdateProjectInstructions: (id: string, instructions: string | undefined) => void;
  handleUpdateProjectFiles: (id: string, files: ProjectFile[] | undefined) => void;
  handleUpdateProjectProviderModel: (id: string, provider: Provider | undefined, model: string | undefined) => void;
  handleMoveToProject: (conversationId: string, projectId: string | undefined) => void;
}

export function useProjects({
  projects,
  setProjects,
  setConversations,
  currentConversation,
  setCurrentConversation,
}: UseProjectsOptions): UseProjectsReturn {
  const handleCreateProject = useCallback((name: string, color: string) => {
    const project: Project = {
      id: generateId(),
      name,
      color,
      createdAt: Date.now(),
    };
    saveProject(project);
    setProjects(getProjects());
  }, [setProjects]);

  const handleDeleteProject = useCallback((id: string) => {
    deleteProjectStorage(id);
    setProjects(getProjects());
    setConversations(getConversations());
  }, [setProjects, setConversations]);

  const handleRenameProject = useCallback((id: string, name: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      saveProject({ ...project, name });
      setProjects(getProjects());
    }
  }, [projects, setProjects]);

  const handleUpdateProjectInstructions = useCallback((id: string, instructions: string | undefined) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      saveProject({ ...project, instructions });
      setProjects(getProjects());
    }
  }, [projects, setProjects]);

  const handleUpdateProjectFiles = useCallback((id: string, files: ProjectFile[] | undefined) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      saveProject({ ...project, files });
      setProjects(getProjects());
    }
  }, [projects, setProjects]);

  const handleUpdateProjectProviderModel = useCallback((id: string, provider: Provider | undefined, model: string | undefined) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      saveProject({ ...project, provider, model });
      setProjects(getProjects());
    }
  }, [projects, setProjects]);

  const handleMoveToProject = useCallback((conversationId: string, projectId: string | undefined) => {
    updateConversationProject(conversationId, projectId);
    setConversations(getConversations());
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(currentConversation ? { ...currentConversation, projectId } : null);
    }
  }, [currentConversation, setCurrentConversation, setConversations]);

  return {
    handleCreateProject,
    handleDeleteProject,
    handleRenameProject,
    handleUpdateProjectInstructions,
    handleUpdateProjectFiles,
    handleUpdateProjectProviderModel,
    handleMoveToProject,
  };
}
