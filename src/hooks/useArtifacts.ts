/**
 * Hook for managing artifact panel state and actions
 */

import { useState, useCallback, useRef } from 'react';
import { Artifact, Conversation } from '@/types';
import { createStreamingState, StreamingArtifactState } from '@/lib/artifact-parser';
import { saveConversation, getConversations } from '@/lib/storage';

export interface UseArtifactsOptions {
  currentConversation: Conversation | null;
  setCurrentConversation: (conv: Conversation | null) => void;
  setConversations: (convs: Conversation[]) => void;
}

export interface UseArtifactsReturn {
  // State
  artifactPanelOpen: boolean;
  selectedArtifactId: string | null;
  artifactPanelWidth: number;
  artifactParseStateRef: React.MutableRefObject<StreamingArtifactState>;
  streamingArtifactsRef: React.MutableRefObject<Artifact[]>;

  // Actions
  handleSelectArtifact: (artifactId: string) => void;
  handleCloseArtifactPanel: () => void;
  handleRenameArtifact: (artifactId: string, newTitle: string) => void;
  handleDownloadArtifact: (artifact: Artifact) => void;
  setArtifactPanelWidth: (width: number) => void;
  resetArtifactPanel: () => void;
  resetStreamingState: () => void;
}

export function useArtifacts({
  currentConversation,
  setCurrentConversation,
  setConversations,
}: UseArtifactsOptions): UseArtifactsReturn {
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [artifactPanelWidth, setArtifactPanelWidth] = useState(40);

  const artifactParseStateRef = useRef<StreamingArtifactState>(createStreamingState());
  const streamingArtifactsRef = useRef<Artifact[]>([]);

  const handleSelectArtifact = useCallback((artifactId: string) => {
    setSelectedArtifactId(artifactId);
    setArtifactPanelOpen(true);
  }, []);

  const handleCloseArtifactPanel = useCallback(() => {
    setArtifactPanelOpen(false);
  }, []);

  const handleRenameArtifact = useCallback((artifactId: string, newTitle: string) => {
    if (!currentConversation) return;
    const updatedArtifacts = currentConversation.artifacts?.map(a =>
      a.id === artifactId
        ? { ...a, title: newTitle, updatedAt: Date.now() }
        : a
    );
    const updatedConv = { ...currentConversation, artifacts: updatedArtifacts, updatedAt: Date.now() };
    setCurrentConversation(updatedConv);
    saveConversation(updatedConv);
    setConversations(getConversations());
  }, [currentConversation, setCurrentConversation, setConversations]);

  const handleDownloadArtifact = useCallback((artifact: Artifact) => {
    console.log('Downloaded artifact:', artifact.title);
  }, []);

  const resetArtifactPanel = useCallback(() => {
    setArtifactPanelOpen(false);
    setSelectedArtifactId(null);
  }, []);

  const resetStreamingState = useCallback(() => {
    artifactParseStateRef.current = createStreamingState();
    streamingArtifactsRef.current = [];
  }, []);

  return {
    artifactPanelOpen,
    selectedArtifactId,
    artifactPanelWidth,
    artifactParseStateRef,
    streamingArtifactsRef,
    handleSelectArtifact,
    handleCloseArtifactPanel,
    handleRenameArtifact,
    handleDownloadArtifact,
    setArtifactPanelWidth,
    resetArtifactPanel,
    resetStreamingState,
  };
}
