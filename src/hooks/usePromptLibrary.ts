'use client';

import { useState, useMemo, useCallback } from 'react';
import { Prompt, PromptType } from '@/types';
import { getPrompts, savePrompt, deletePrompt as deletePromptStorage, exportPrompts, importPrompts, generateId } from '@/lib/storage';

export interface PromptFilter {
  type: PromptType | 'all';
  search: string;
  tag: string | null;
}

export function usePromptLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>(() => getPrompts());
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PromptFilter>({ type: 'all', search: '', tag: null });

  const filteredPrompts = useMemo(() => {
    let result = prompts;
    if (filter.type !== 'all') {
      result = result.filter((p) => p.type === filter.type);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    if (filter.tag) {
      result = result.filter((p) => p.tags?.includes(filter.tag!));
    }
    return result;
  }, [prompts, filter]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    prompts.forEach((p) => p.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [prompts]);

  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId]
  );

  const createPrompt = useCallback(
    (type: PromptType, title: string, content: string, description?: string, tags?: string[]) => {
      const now = Date.now();
      const prompt: Prompt = {
        id: generateId(),
        type,
        title,
        content,
        description,
        tags,
        versions: [{ id: generateId(), content, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      savePrompt(prompt);
      setPrompts(getPrompts());
      setSelectedPromptId(prompt.id);
      return prompt;
    },
    []
  );

  const updatePromptContent = useCallback(
    (id: string, content: string, changeMessage?: string) => {
      const prompt = getPrompts().find((p) => p.id === id);
      if (!prompt) return;
      const now = Date.now();
      const version = { id: generateId(), content, createdAt: now, message: changeMessage };
      const updated: Prompt = {
        ...prompt,
        content,
        versions: [...prompt.versions, version],
        updatedAt: now,
      };
      savePrompt(updated);
      setPrompts(getPrompts());
    },
    []
  );

  const updatePromptMetadata = useCallback(
    (id: string, updates: { title?: string; description?: string; tags?: string[]; type?: PromptType }) => {
      const prompt = getPrompts().find((p) => p.id === id);
      if (!prompt) return;
      const updated: Prompt = { ...prompt, ...updates, updatedAt: Date.now() };
      savePrompt(updated);
      setPrompts(getPrompts());
    },
    []
  );

  const removePrompt = useCallback(
    (id: string) => {
      deletePromptStorage(id);
      setPrompts(getPrompts());
      if (selectedPromptId === id) setSelectedPromptId(null);
    },
    [selectedPromptId]
  );

  const duplicatePrompt = useCallback(
    (id: string) => {
      const prompt = getPrompts().find((p) => p.id === id);
      if (!prompt) return null;
      const now = Date.now();
      const dup: Prompt = {
        ...prompt,
        id: generateId(),
        title: `${prompt.title} (copy)`,
        versions: [{ id: generateId(), content: prompt.content, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      savePrompt(dup);
      setPrompts(getPrompts());
      setSelectedPromptId(dup.id);
      return dup;
    },
    []
  );

  const revertToVersion = useCallback(
    (promptId: string, versionId: string) => {
      const prompt = getPrompts().find((p) => p.id === promptId);
      if (!prompt) return;
      const version = prompt.versions.find((v) => v.id === versionId);
      if (!version) return;
      const now = Date.now();
      const revertVersion = {
        id: generateId(),
        content: version.content,
        createdAt: now,
        message: `Reverted to version from ${new Date(version.createdAt).toLocaleString()}`,
      };
      const updated: Prompt = {
        ...prompt,
        content: version.content,
        versions: [...prompt.versions, revertVersion],
        updatedAt: now,
      };
      savePrompt(updated);
      setPrompts(getPrompts());
    },
    []
  );

  const handleExport = useCallback(() => {
    const json = exportPrompts();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompts.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback((json: string) => {
    const count = importPrompts(json);
    setPrompts(getPrompts());
    return count;
  }, []);

  const updateFilter = useCallback((partial: Partial<PromptFilter>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    prompts,
    filteredPrompts,
    selectedPrompt,
    selectedPromptId,
    filter,
    allTags,
    selectPrompt: setSelectedPromptId,
    createPrompt,
    updatePromptContent,
    updatePromptMetadata,
    removePrompt,
    duplicatePrompt,
    revertToVersion,
    updateFilter,
    handleExport,
    handleImport,
  };
}
