'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Conversation, ChatSettings, DEFAULT_SETTINGS, DEFAULT_MODELS, Provider, Attachment, TokenUsage, Project, WebSearchResponse, GoogleDriveSearchResponse, ToolCall, ToolSource, ContentBlock, Artifact, ArtifactContentBlock, ReasoningContentBlock } from '@/types';
import type { ToolExecutionResult } from '@/lib/providers';
import {
  getConversations,
  saveConversation,
  deleteConversation,
  getSettings,
  saveSettings,
  generateId,
  generateTitle,
  getProjects,
} from '@/lib/storage';
import { mergeSystemPrompts, buildArtifactSystemPrompt, isArtifactTool } from '@/lib/providers';
import { processStreamingChunk } from '@/lib/artifact-parser';
import { MAX_TOOL_RECURSION_DEPTH } from '@/lib/constants';
import { Sidebar } from './Sidebar';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SettingsModal } from './SettingsModal';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ProjectDashboard } from './ProjectDashboard';
import { ArtifactPanel } from './ArtifactPanel';
import { useTheme } from './ThemeProvider';
import {
  useArtifacts,
  useProjects,
  useToolExecution,
  useScrollManagement,
} from '@/hooks';

export function Chat() {
  // Core state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [sessionUsage, setSessionUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [streamingContentBlocks, setStreamingContentBlocks] = useState<ContentBlock[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageRef = useRef<HTMLDivElement>(null);
  const { setTheme } = useTheme();

  // Custom hooks
  const {
    messagesEndRef,
    mainRef,
    showScrollToBottom,
    scrollToBottom,
  } = useScrollManagement();

  const {
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
  } = useArtifacts({
    currentConversation,
    setCurrentConversation,
    setConversations,
  });

  const {
    handleCreateProject,
    handleDeleteProject,
    handleRenameProject,
    handleUpdateProjectInstructions,
    handleUpdateProjectFiles,
    handleUpdateProjectProviderModel,
    handleMoveToProject,
  } = useProjects({
    projects,
    setProjects,
    setConversations,
    currentConversation,
    setCurrentConversation,
  });

  const {
    searchStatus,
    setSearchStatus,
    performSearch,
    performDriveSearch,
    performMemorySearch,
    performRAGSearch,
    performMCPToolCall,
    performArtifactToolCall,
    generateToolCallId,
  } = useToolExecution({
    settings,
    setSettings,
  });

  useEffect(() => {
    setConversations(getConversations());
    setProjects(getProjects());
    setSettings(getSettings());

    // Check for OAuth callback results
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const authError = urlParams.get('auth_error');

    if (authSuccess === 'google_drive') {
      // Reload settings to get the new tokens saved by the OAuth callback
      setSettings(getSettings());
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (authError) {
      console.error('Google Drive auth error:', authError);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Scroll to bottom when selecting a conversation
  const prevConversationId = useRef<string | null>(null);
  useEffect(() => {
    if (currentConversation && currentConversation.id !== prevConversationId.current) {
      prevConversationId.current = currentConversation.id;
      // Only scroll to bottom when switching conversations, not during streaming
      if (!isLoading) {
        requestAnimationFrame(() => scrollToBottom(false));
      }
    }
  }, [currentConversation, isLoading, scrollToBottom]);

  const handleNewChat = useCallback(() => {
    setCurrentProjectId(null);
    setCurrentConversation(null);
    setStreamingContent('');
    setLastUsage(null);
    setSessionUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    resetArtifactPanel();
  }, [resetArtifactPanel]);

  const handleNewChatInProject = useCallback((projectId: string) => {
    // Get project to check for project-specific provider/model
    const project = projects.find((p) => p.id === projectId);
    const provider = project?.provider || settings.provider;
    const model = project?.model || settings.model;

    // Create a new conversation already associated with the project
    const newConversation: Conversation = {
      id: generateId(),
      title: 'New conversation',
      messages: [],
      provider,
      model,
      projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setCurrentProjectId(null);
    setCurrentConversation(newConversation);
    setStreamingContent('');
    setLastUsage(null);
    setSessionUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    resetArtifactPanel();
  }, [projects, settings.provider, settings.model, resetArtifactPanel]);

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setCurrentProjectId(null);
      setCurrentConversation(conv);
      setStreamingContent('');
      setLastUsage(null);
      setSessionUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
      resetArtifactPanel();
    }
  }, [conversations, resetArtifactPanel]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    setConversations(getConversations());
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setLastUsage(null);
      setSessionUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    }
  }, [currentConversation?.id]);

  const handleSaveSettings = useCallback((newSettings: ChatSettings) => {
    saveSettings(newSettings);
    setSettings(newSettings);
    if (newSettings.theme !== settings.theme) {
      setTheme(newSettings.theme);
    }
  }, [settings.theme, setTheme]);

  const handleProviderChange = useCallback((provider: Provider) => {
    const newSettings = {
      ...settings,
      provider,
      model: DEFAULT_MODELS[provider][0],
    };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleModelChange = useCallback((model: string) => {
    const newSettings = { ...settings, model };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const handleToggleWebSearch = useCallback(() => {
    const newSettings = { ...settings, webSearchEnabled: !settings.webSearchEnabled };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleToggleGoogleDrive = useCallback(() => {
    const newSettings = { ...settings, googleDriveEnabled: !settings.googleDriveEnabled };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handlePickDriveFile = useCallback(() => {
    // For now, show an alert. In a full implementation, this would open a Google Drive picker
    // The Google Drive Picker API requires additional setup and a separate API key
    alert('Google Drive file picker coming soon! For now, use the Google Drive search feature to find and reference files in your conversations.');
  }, []);

  const handleSelectProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    setCurrentConversation(null);
    setStreamingContent('');
    setLastUsage(null);
    setSessionUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    resetArtifactPanel();
  }, [resetArtifactPanel]);

  // Core function to stream a response for a given conversation
  const streamResponse = useCallback(async (
    conv: Conversation,
    searchResults?: WebSearchResponse,
    existingToolCalls?: ToolCall[],
    driveSearchResults?: GoogleDriveSearchResponse,
    toolExecutions?: ToolExecutionResult[],
    accumulatedContentBlocks?: ContentBlock[],
    recursionDepth: number = 0
  ): Promise<void> => {
    // Prevent infinite tool call loops
    if (recursionDepth >= MAX_TOOL_RECURSION_DEPTH) {
      console.warn(`Tool call limit reached (${MAX_TOOL_RECURSION_DEPTH} calls). Stopping to prevent infinite loop.`);

      // Save accumulated content and tool calls instead of silently returning
      const limitBlocks: ContentBlock[] = accumulatedContentBlocks ? [...accumulatedContentBlocks] : [];
      limitBlocks.push({
        type: 'text',
        text: `\n\n[Tool call limit reached (${MAX_TOOL_RECURSION_DEPTH} calls). Stopping to prevent infinite loop.]`,
      });

      const fullContent = limitBlocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('');

      const limitToolCalls = existingToolCalls ? [...existingToolCalls] : [];

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: fullContent,
        contentBlocks: limitBlocks.length > 0 ? limitBlocks : undefined,
        toolCalls: limitToolCalls.length > 0 ? limitToolCalls : undefined,
        timestamp: Date.now(),
      };

      const existingArtifacts = conv.artifacts || [];
      const allArtifacts = [...existingArtifacts, ...streamingArtifactsRef.current];

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, assistantMessage],
        artifacts: allArtifacts.length > 0 ? allArtifacts : undefined,
        updatedAt: Date.now(),
      };

      setCurrentConversation(updatedConv);
      saveConversation(updatedConv);
      setConversations(getConversations());
      setStreamingContent('');
      setStreamingContentBlocks([]);
      setCurrentToolCalls([]);
      resetStreamingState();
      setIsLoading(false);
      return;
    }

    setCurrentConversation(conv);
    saveConversation(conv);
    setConversations(getConversations());
    setIsLoading(true);

    // Initialize or continue with existing content blocks
    const contentBlocksAccumulator: ContentBlock[] = accumulatedContentBlocks ? [...accumulatedContentBlocks] : [];
    setStreamingContentBlocks(contentBlocksAccumulator);

    // For backwards compatibility, also track full text content
    const existingTextContent = contentBlocksAccumulator
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('');
    setStreamingContent(existingTextContent);

    // Initialize or continue with existing tool calls
    const toolCallsAccumulator: ToolCall[] = existingToolCalls ? [...existingToolCalls] : [];
    setCurrentToolCalls(toolCallsAccumulator);

    try {
      abortControllerRef.current = new AbortController();
      // Combine user abort with a 5-minute streaming timeout
      const timeoutSignal = AbortSignal.timeout(300000); // 5 minutes
      const combinedSignal = AbortSignal.any([
        abortControllerRef.current.signal,
        timeoutSignal,
      ]);

      // Find project for this conversation
      const currentProject = conv.projectId
        ? projects.find(p => p.id === conv.projectId)
        : undefined;

      // Merge system prompts: global + project + conversation
      const baseSystemPrompt = mergeSystemPrompts(
        settings.systemPrompt,
        currentProject?.instructions,
        conv.systemPrompt
      );

      // Append artifact tool instructions (with list of existing artifacts)
      const allCurrentArtifacts = [...(conv.artifacts || []), ...streamingArtifactsRef.current];
      const artifactPrompt = buildArtifactSystemPrompt(allCurrentArtifacts.length > 0 ? allCurrentArtifacts : undefined);
      const mergedSystemPrompt = artifactPrompt
        ? (baseSystemPrompt ? `${baseSystemPrompt}\n\n${artifactPrompt}` : artifactPrompt)
        : baseSystemPrompt;

      // Add project files to first user message
      const messagesWithProjectFiles = conv.messages.map((m, idx) => {
        if (idx === 0 && m.role === 'user' && currentProject?.files) {
          return {
            role: m.role,
            content: m.content,
            attachments: m.attachments,
            projectFiles: currentProject.files,
          };
        }
        return {
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        };
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesWithProjectFiles,
          settings,
          systemPrompt: mergedSystemPrompt,
          webSearchEnabled: settings.webSearchEnabled,
          searchResults,
          googleDriveEnabled: settings.googleDriveEnabled && !!settings.googleDriveAccessToken,
          driveSearchResults,
          memorySearchEnabled: settings.memorySearchEnabled,
          ragEnabled: settings.ragEnabled,
          toolExecutions,
        }),
        signal: combinedSignal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      // Track current text block being streamed
      let currentTextContent = '';
      // Track current reasoning block being streamed
      let currentReasoningContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              // If we have reasoning pending, flush it first before adding content
              if (currentReasoningContent) {
                contentBlocksAccumulator.push({ type: 'reasoning', reasoning: currentReasoningContent } as ReasoningContentBlock);
                currentReasoningContent = '';
              }

              // Process content through artifact parser
              const parseResult = processStreamingChunk(
                parsed.content,
                artifactParseStateRef.current
              );
              artifactParseStateRef.current = parseResult.state;

              // If we completed an artifact, add it to the artifacts list
              if (parseResult.completedArtifact) {
                const newArtifact: Artifact = {
                  id: generateId(),
                  type: parseResult.completedArtifact.type,
                  title: parseResult.completedArtifact.title,
                  content: parseResult.completedArtifact.content,
                  language: parseResult.completedArtifact.language,
                  versions: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                streamingArtifactsRef.current = [...streamingArtifactsRef.current, newArtifact];

                // Add any text before the artifact
                if (currentTextContent.trim()) {
                  contentBlocksAccumulator.push({ type: 'text', text: currentTextContent });
                }
                currentTextContent = '';

                // Add artifact content block
                contentBlocksAccumulator.push({
                  type: 'artifact',
                  artifactId: newArtifact.id,
                } as ArtifactContentBlock);
              }

              // Add displayable text to currentTextContent
              if (parseResult.displayText) {
                currentTextContent += parseResult.displayText;
              }

              // Update streaming display with current text appended to accumulated blocks
              const displayBlocks: ContentBlock[] = [
                ...contentBlocksAccumulator,
                ...(currentTextContent ? [{ type: 'text' as const, text: currentTextContent }] : [])
              ];
              setStreamingContentBlocks(displayBlocks);
              // Also update legacy streamingContent for backwards compatibility
              const fullText = displayBlocks
                .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                .map(b => b.text)
                .join('');
              setStreamingContent(fullText);
            }
            // Handle reasoning tokens from o-series models as content blocks
            if (parsed.reasoning) {
              // If we have text content pending, flush it first before starting reasoning
              if (currentTextContent && !currentReasoningContent) {
                contentBlocksAccumulator.push({ type: 'text', text: currentTextContent });
                currentTextContent = '';
              }
              currentReasoningContent += parsed.reasoning;

              // Update streaming display with current reasoning appended
              const displayBlocks: ContentBlock[] = [
                ...contentBlocksAccumulator,
                ...(currentReasoningContent ? [{ type: 'reasoning' as const, reasoning: currentReasoningContent }] : []),
                ...(currentTextContent ? [{ type: 'text' as const, text: currentTextContent }] : [])
              ];
              setStreamingContentBlocks(displayBlocks);
            }
            if (parsed.usage) {
              const usage = parsed.usage as TokenUsage;
              setLastUsage(usage);
              setSessionUsage((prev) => ({
                inputTokens: prev.inputTokens + usage.inputTokens,
                outputTokens: prev.outputTokens + usage.outputTokens,
                totalTokens: prev.totalTokens + usage.totalTokens,
                cachedTokens: (prev.cachedTokens || 0) + (usage.cachedTokens || 0) || undefined,
                reasoningTokens: (prev.reasoningTokens || 0) + (usage.reasoningTokens || 0) || undefined,
              }));
            }
            // Handle single tool call
            if (parsed.tool_call) {
              const toolName = parsed.tool_call.name;
              // Original tool name (may include prefixes like mcp_serverId_) - needed for Anthropic API
              const originalToolName = typeof parsed.tool_call.originalName === 'string'
                ? parsed.tool_call.originalName
                : toolName;
              const toolParams = parsed.tool_call.params;
              const toolSource = parsed.tool_call.source as ToolSource | undefined;
              const toolServerId = parsed.tool_call.serverId;
              const toolCallId =
                typeof parsed.tool_call.id === 'string' && parsed.tool_call.id ? parsed.tool_call.id : generateToolCallId();
              const anthropicThinkingSignature =
                typeof parsed.tool_call.thinkingSignature === 'string' ? parsed.tool_call.thinkingSignature : undefined;
              const anthropicThinking = anthropicThinkingSignature ? currentReasoningContent : undefined;

              // Create tool call entry with running status
              const toolCall: ToolCall = {
                id: toolCallId,
                name: toolName,
                params: toolParams,
                status: 'running',
                startedAt: Date.now(),
                source: toolSource,
                serverId: toolServerId,
              };
              toolCallsAccumulator.push(toolCall);
              setCurrentToolCalls([...toolCallsAccumulator]);

              // Add reasoning before tool call as a content block (if any)
              if (currentReasoningContent) {
                contentBlocksAccumulator.push({ type: 'reasoning', reasoning: currentReasoningContent } as ReasoningContentBlock);
                currentReasoningContent = '';
              }
              // Add text before tool call as a content block (if any)
              if (currentTextContent) {
                contentBlocksAccumulator.push({ type: 'text', text: currentTextContent });
                currentTextContent = '';
              }
              // Add tool call as a content block
              contentBlocksAccumulator.push({ type: 'tool_call', toolCall });
              setStreamingContentBlocks([...contentBlocksAccumulator]);

              // Handle based on source
              if (toolSource === 'mcp' || toolSource === 'builtin') {
                // MCP or builtin tool call
                const mcpResult = await performMCPToolCall(toolName, toolParams, toolSource, toolServerId);

                // Update the tool call in the accumulator
                const toolCallIndex = toolCallsAccumulator.findIndex(tc => tc.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: mcpResult.isError ? 'error' as const : 'completed' as const,
                    result: mcpResult.result,
                    error: mcpResult.isError ? mcpResult.result : undefined,
                    completedAt: Date.now(),
                  };
                  toolCallsAccumulator[toolCallIndex] = updatedToolCall;
                  setCurrentToolCalls([...toolCallsAccumulator]);

                  // Update the content block with the completed tool call
                  const blockIndex = contentBlocksAccumulator.findIndex(
                    b => b.type === 'tool_call' && b.toolCall.id === toolCall.id
                  );
                  if (blockIndex !== -1) {
                    contentBlocksAccumulator[blockIndex] = { type: 'tool_call', toolCall: updatedToolCall };
                    setStreamingContentBlocks([...contentBlocksAccumulator]);
                  }
                }

                // Create proper tool execution result for the API
                const toolExecution: ToolExecutionResult = {
                  toolCallId: toolCall.id,
                  toolName,
                  originalToolName, // Include prefixed name for Anthropic API
                  toolParams,
                  result: mcpResult.result,
                  isError: mcpResult.isError,
                  anthropicThinkingSignature,
                  anthropicThinking,
                  geminiThoughtSignature: anthropicThinkingSignature, // Same field for Gemini 3
                };

                // Recursively call with accumulated tool executions so model sees full history
                const allExecs = [...(toolExecutions || []), toolExecution];
                await streamResponse(conv, undefined, toolCallsAccumulator, undefined, allExecs, contentBlocksAccumulator, recursionDepth + 1);
                return;
              } else if (isArtifactTool(toolName)) {
                // Artifact tool call - execute client-side
                const allCurrentArtifacts = [...(conv.artifacts || []), ...streamingArtifactsRef.current];
                const artifactResult = performArtifactToolCall(toolName, toolParams, allCurrentArtifacts);

                // Handle new/updated artifacts
                if (artifactResult.newArtifact) {
                  streamingArtifactsRef.current = [...streamingArtifactsRef.current, artifactResult.newArtifact];
                  // Add artifact content block so it appears in the message
                  contentBlocksAccumulator.push({
                    type: 'artifact',
                    artifactId: artifactResult.newArtifact.id,
                  } as ArtifactContentBlock);
                }
                if (artifactResult.updatedArtifact) {
                  // Update the artifact in streamingArtifactsRef or conv.artifacts
                  const updatedId = artifactResult.updatedArtifact.id;
                  const streamIdx = streamingArtifactsRef.current.findIndex(a => a.id === updatedId);
                  if (streamIdx !== -1) {
                    streamingArtifactsRef.current = streamingArtifactsRef.current.map(a =>
                      a.id === updatedId ? artifactResult.updatedArtifact! : a
                    );
                  } else {
                    // Artifact was from conv.artifacts - promote to streaming artifacts with updated content
                    const existingArtifacts = (conv.artifacts || []).map(a =>
                      a.id === updatedId ? artifactResult.updatedArtifact! : a
                    );
                    conv = { ...conv, artifacts: existingArtifacts };
                  }
                  // Add artifact content block so the updated artifact appears inline
                  contentBlocksAccumulator.push({
                    type: 'artifact',
                    artifactId: updatedId,
                  } as ArtifactContentBlock);
                }

                // Update the tool call status in the accumulator
                const toolCallIndex = toolCallsAccumulator.findIndex(tc => tc.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: artifactResult.isError ? 'error' as const : 'completed' as const,
                    result: artifactResult.result,
                    error: artifactResult.isError ? artifactResult.result : undefined,
                    completedAt: Date.now(),
                  };
                  toolCallsAccumulator[toolCallIndex] = updatedToolCall;
                  setCurrentToolCalls([...toolCallsAccumulator]);

                  const blockIndex = contentBlocksAccumulator.findIndex(
                    b => b.type === 'tool_call' && b.toolCall.id === toolCall.id
                  );
                  if (blockIndex !== -1) {
                    contentBlocksAccumulator[blockIndex] = { type: 'tool_call', toolCall: updatedToolCall };
                  }
                  setStreamingContentBlocks([...contentBlocksAccumulator]);
                }

                // Create tool execution result for the API
                const toolExecution: ToolExecutionResult = {
                  toolCallId: toolCall.id,
                  toolName,
                  originalToolName,
                  toolParams,
                  result: artifactResult.result,
                  isError: artifactResult.isError,
                  anthropicThinkingSignature,
                  anthropicThinking,
                  geminiThoughtSignature: anthropicThinkingSignature,
                };

                const allExecs = [...(toolExecutions || []), toolExecution];
                await streamResponse(conv, undefined, toolCallsAccumulator, undefined, allExecs, contentBlocksAccumulator, recursionDepth + 1);
                return;
              } else if (toolName === 'web_search' || toolName === 'google_drive_search' || toolName === 'memory_search' || toolName === 'rag_search') {
                // Web search, Google Drive search, or Memory search - handle as proper tool results
                const searchQuery = toolParams.query as string;

                let searchResult: WebSearchResponse | GoogleDriveSearchResponse | null = null;
                let formattedResult = '';
                let isError = false;

                if (toolName === 'web_search') {
                  searchResult = await performSearch(searchQuery);
                  if (searchResult) {
                    // Format web search results as tool result text
                    const webResult = searchResult as WebSearchResponse;
                    if (webResult.results.length === 0) {
                      formattedResult = `Web search for "${webResult.query}" returned no results.`;
                    } else {
                      formattedResult = `Web search results for "${webResult.query}":\n\n`;
                      webResult.results.forEach((r, i) => {
                        formattedResult += `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}\n\n`;
                      });
                      formattedResult += `\nThese are the search results. Please use the information above to answer the user's question. Do not search again unless the user asks a new question.`;
                    }
                  } else {
                    formattedResult = 'Web search failed. Please try again.';
                    isError = true;
                  }
                } else if (toolName === 'google_drive_search') {
                  searchResult = await performDriveSearch(searchQuery);
                  if (searchResult) {
                    // Format drive search results as tool result text
                    const driveResult = searchResult as GoogleDriveSearchResponse;
                    if (driveResult.results.length === 0) {
                      formattedResult = `Google Drive search for "${driveResult.query}" returned no files.`;
                    } else {
                      formattedResult = `Google Drive search results for "${driveResult.query}":\n\n`;
                      driveResult.results.forEach((r, i) => {
                        formattedResult += `[${i + 1}] ${r.fileName} (${r.mimeType})\n`;
                        formattedResult += `    Modified: ${r.modifiedTime}\n`;
                        if (r.owner) formattedResult += `    Owner: ${r.owner}\n`;
                        formattedResult += `    Link: ${r.webViewLink}\n\n`;
                      });
                    }
                  } else {
                    formattedResult = 'Google Drive search failed. Please try again.';
                    isError = true;
                  }
                } else if (toolName === 'memory_search') {
                  const memoryResult = await performMemorySearch(searchQuery, conv.id);
                  if (memoryResult) {
                    formattedResult = memoryResult.formatted;
                  } else {
                    formattedResult = 'Memory search failed. Please try again.';
                    isError = true;
                  }
                } else if (toolName === 'rag_search') {
                  const ragResult = await performRAGSearch(searchQuery);
                  if (ragResult) {
                    formattedResult = ragResult.formatted;
                  } else {
                    formattedResult = 'Document search failed. Please try again.';
                    isError = true;
                  }
                }

                // Update tool call with result
                const toolCallIndex = toolCallsAccumulator.findIndex(tc => tc.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: isError ? 'error' as const : 'completed' as const,
                    result: searchResult || formattedResult,
                    error: isError ? formattedResult : undefined,
                    completedAt: Date.now(),
                  };
                  toolCallsAccumulator[toolCallIndex] = updatedToolCall;
                  setCurrentToolCalls([...toolCallsAccumulator]);

                  // Update the content block with the completed tool call
                  const blockIndex = contentBlocksAccumulator.findIndex(
                    b => b.type === 'tool_call' && b.toolCall.id === toolCall.id
                  );
                  if (blockIndex !== -1) {
                    contentBlocksAccumulator[blockIndex] = { type: 'tool_call', toolCall: updatedToolCall };
                    setStreamingContentBlocks([...contentBlocksAccumulator]);
                  }
                }

                // Create proper tool execution result (same as MCP tools)
                const toolExecution: ToolExecutionResult = {
                  toolCallId: toolCall.id,
                  toolName,
                  originalToolName, // Include prefixed name for Anthropic API
                  toolParams,
                  result: formattedResult,
                  isError,
                  anthropicThinkingSignature,
                  anthropicThinking,
                  geminiThoughtSignature: anthropicThinkingSignature, // Same field for Gemini 3
                };

                // Recursively call with accumulated tool executions so model sees full history
                const allExecs = [...(toolExecutions || []), toolExecution];
                await streamResponse(conv, undefined, toolCallsAccumulator, undefined, allExecs, contentBlocksAccumulator, recursionDepth + 1);
                return;
              }
            }

            // Handle multiple parallel tool calls - all as proper tool executions
            if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
              const allToolExecutions: ToolExecutionResult[] = [];

              // Add text before tool calls as a content block (if any)
              if (currentTextContent) {
                contentBlocksAccumulator.push({ type: 'text', text: currentTextContent });
                currentTextContent = '';
              }

              // Create tool call entries for all calls
              const newToolCalls: ToolCall[] = parsed.tool_calls.map(
                (tc: { id: string; name: string; params: Record<string, unknown>; source?: ToolSource; serverId?: string }) => ({
                  id: tc.id || generateToolCallId(),
                  name: tc.name,
                  params: tc.params,
                  status: 'running' as const,
                  startedAt: Date.now(),
                  source: tc.source,
                  serverId: tc.serverId,
                })
              );
              toolCallsAccumulator.push(...newToolCalls);
              setCurrentToolCalls([...toolCallsAccumulator]);

              // Add all tool calls as content blocks
              for (const toolCall of newToolCalls) {
                contentBlocksAccumulator.push({ type: 'tool_call', toolCall });
              }
              setStreamingContentBlocks([...contentBlocksAccumulator]);

              // Process all tool calls in parallel
              const toolCallPromises = parsed.tool_calls.map(async (
                tc: {
                  id: string;
                  name: string;
                  originalName?: string;
                  params: Record<string, unknown>;
                  source?: ToolSource;
                  serverId?: string;
                  thoughtSignature?: string;
                },
                i: number
              ) => {
                const toolCall = newToolCalls[i];
                let formattedResult = '';
                let isError = false;

                try {
                  if (tc.name === 'web_search') {
                    const result = await performSearch(tc.params.query as string);
                    if (result && result.results.length > 0) {
                      formattedResult = `Web search results for "${result.query}":\n\n`;
                      result.results.forEach((r, idx) => {
                        formattedResult += `[${idx + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}\n\n`;
                      });
                    } else {
                      formattedResult = `Web search for "${tc.params.query}" returned no results.`;
                    }
                  } else if (tc.name === 'google_drive_search') {
                    const result = await performDriveSearch(tc.params.query as string);
                    if (result && result.results.length > 0) {
                      formattedResult = `Google Drive search results for "${result.query}":\n\n`;
                      result.results.forEach((r, idx) => {
                        formattedResult += `[${idx + 1}] ${r.fileName} (${r.mimeType})\n`;
                        formattedResult += `    Modified: ${r.modifiedTime}\n`;
                        if (r.owner) formattedResult += `    Owner: ${r.owner}\n`;
                        formattedResult += `    Link: ${r.webViewLink}\n\n`;
                      });
                    } else {
                      formattedResult = `Google Drive search for "${tc.params.query}" returned no files.`;
                    }
                  } else if (tc.name === 'memory_search') {
                    const result = await performMemorySearch(tc.params.query as string, conv.id);
                    if (result) {
                      formattedResult = result.formatted;
                    } else {
                      formattedResult = 'Memory search failed.';
                      isError = true;
                    }
                  } else if (tc.name === 'rag_search') {
                    const result = await performRAGSearch(tc.params.query as string);
                    if (result) {
                      formattedResult = result.formatted;
                    } else {
                      formattedResult = 'Document search failed.';
                      isError = true;
                    }
                  } else if (isArtifactTool(tc.name)) {
                    const allCurrentArtifacts = [...(conv.artifacts || []), ...streamingArtifactsRef.current];
                    const artifactResult = performArtifactToolCall(tc.name, tc.params, allCurrentArtifacts);
                    formattedResult = artifactResult.result;
                    isError = artifactResult.isError;

                    if (artifactResult.newArtifact) {
                      streamingArtifactsRef.current = [...streamingArtifactsRef.current, artifactResult.newArtifact];
                    }
                    if (artifactResult.updatedArtifact) {
                      const updatedId = artifactResult.updatedArtifact.id;
                      const streamIdx = streamingArtifactsRef.current.findIndex(a => a.id === updatedId);
                      if (streamIdx !== -1) {
                        streamingArtifactsRef.current = streamingArtifactsRef.current.map(a =>
                          a.id === updatedId ? artifactResult.updatedArtifact! : a
                        );
                      } else {
                        const existingArtifacts = (conv.artifacts || []).map(a =>
                          a.id === updatedId ? artifactResult.updatedArtifact! : a
                        );
                        conv = { ...conv, artifacts: existingArtifacts };
                      }
                    }
                  } else if (tc.source === 'mcp' || tc.source === 'builtin') {
                    const mcpResult = await performMCPToolCall(tc.name, tc.params, tc.source, tc.serverId);
                    formattedResult = mcpResult.result;
                    isError = mcpResult.isError;
                  }
                } catch (err) {
                  formattedResult = err instanceof Error ? err.message : 'Tool call failed';
                  isError = true;
                }

                return { toolCall, tc, formattedResult, isError };
              });

              const results = await Promise.all(toolCallPromises);

              // Batch state updates after all promises resolve
              for (const { toolCall, tc, formattedResult, isError } of results) {
                const toolCallIndex = toolCallsAccumulator.findIndex(t => t.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: isError ? 'error' as const : 'completed' as const,
                    result: formattedResult,
                    error: isError ? formattedResult : undefined,
                    completedAt: Date.now(),
                  };
                  toolCallsAccumulator[toolCallIndex] = updatedToolCall;

                  const blockIndex = contentBlocksAccumulator.findIndex(
                    b => b.type === 'tool_call' && b.toolCall.id === toolCall.id
                  );
                  if (blockIndex !== -1) {
                    contentBlocksAccumulator[blockIndex] = { type: 'tool_call', toolCall: updatedToolCall };
                  }
                }

                // Add artifact content block for create/update artifact tool calls
                if (isArtifactTool(tc.name) && !isError) {
                  try {
                    const resultData = JSON.parse(formattedResult);
                    if (resultData.artifact_id && (tc.name === 'create_artifact' || tc.name === 'update_artifact')) {
                      contentBlocksAccumulator.push({
                        type: 'artifact',
                        artifactId: resultData.artifact_id,
                      } as ArtifactContentBlock);
                    }
                  } catch {
                    // Ignore parse errors
                  }
                }

                allToolExecutions.push({
                  toolCallId: toolCall.id,
                  toolName: tc.name,
                  originalToolName: tc.originalName || tc.name,
                  toolParams: tc.params,
                  result: formattedResult,
                  isError,
                  geminiThoughtSignature: tc.thoughtSignature,
                });
              }

              // Update UI once after all tool calls complete
              setCurrentToolCalls([...toolCallsAccumulator]);
              setStreamingContentBlocks([...contentBlocksAccumulator]);

              // If we have any tool executions, continue with them
              // Pass content blocks to preserve text and tool calls before the recursive call
              if (allToolExecutions.length > 0) {
                const allExecs = [...(toolExecutions || []), ...allToolExecutions];
                await streamResponse(conv, undefined, toolCallsAccumulator, undefined, allExecs, contentBlocksAccumulator, recursionDepth + 1);
                return;
              }
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      // Add any remaining reasoning as a content block
      if (currentReasoningContent) {
        contentBlocksAccumulator.push({ type: 'reasoning', reasoning: currentReasoningContent } as ReasoningContentBlock);
      }
      // Add any remaining text as a final content block
      if (currentTextContent) {
        contentBlocksAccumulator.push({ type: 'text', text: currentTextContent });
      }

      // Build full content from all text blocks for backwards compatibility
      const fullContent = contentBlocksAccumulator
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('');

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: fullContent,
        contentBlocks: contentBlocksAccumulator.length > 0 ? contentBlocksAccumulator : undefined,
        toolCalls: toolCallsAccumulator.length > 0 ? toolCallsAccumulator : undefined,
        timestamp: Date.now(),
      };

      // Merge any new artifacts with existing ones
      const existingArtifacts = conv.artifacts || [];
      const allArtifacts = [...existingArtifacts, ...streamingArtifactsRef.current];

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, assistantMessage],
        artifacts: allArtifacts.length > 0 ? allArtifacts : undefined,
        updatedAt: Date.now(),
      };

      setCurrentConversation(updatedConv);
      saveConversation(updatedConv);
      setConversations(getConversations());
      setStreamingContent('');
      setStreamingContentBlocks([]);
      setCurrentToolCalls([]);
      resetStreamingState();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Capture all streaming state before clearing
        setStreamingContentBlocks((currentBlocks) => {
          setStreamingContent((currentContent) => {
            setCurrentToolCalls((currentTools) => {
              // Only save if there's actual content
              if (currentContent || currentBlocks.length > 0 || currentTools.length > 0) {
                const assistantMessage: Message = {
                  id: generateId(),
                  role: 'assistant',
                  content: currentContent,
                  contentBlocks: currentBlocks.length > 0 ? currentBlocks : undefined,
                  toolCalls: currentTools.length > 0 ? currentTools : undefined,
                  timestamp: Date.now(),
                };
                const updatedConv: Conversation = {
                  ...conv,
                  messages: [...conv.messages, assistantMessage],
                  updatedAt: Date.now(),
                };
                setCurrentConversation(updatedConv);
                saveConversation(updatedConv);
                setConversations(getConversations());
              }
              return [];
            });
            return '';
          });
          return [];
        });
      } else {
        console.error('Chat error:', error);
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${(error as Error).message}`,
          timestamp: Date.now(),
        };
        const updatedConv: Conversation = {
          ...conv,
          messages: [...conv.messages, errorMessage],
          updatedAt: Date.now(),
        };
        setCurrentConversation(updatedConv);
        saveConversation(updatedConv);
        setConversations(getConversations());
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setStreamingContentBlocks([]);
      setSearchStatus(null);
      setCurrentToolCalls([]);
      resetStreamingState();
    }
  }, [settings, projects, performSearch, performDriveSearch, performMemorySearch, performRAGSearch, performMCPToolCall, performArtifactToolCall, resetStreamingState, artifactParseStateRef, generateToolCallId, setSearchStatus, streamingArtifactsRef]);

  const handleSend = useCallback(async (content: string, attachments: Attachment[] = []) => {
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: Date.now(),
    };

    let conv: Conversation;
    if (currentConversation) {
      conv = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage],
        updatedAt: Date.now(),
      };
    } else {
      conv = {
        id: generateId(),
        title: generateTitle(content),
        messages: [userMessage],
        provider: settings.provider,
        model: settings.model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    await streamResponse(conv);
  }, [currentConversation, settings, streamResponse]);

  const handleSendInProject = useCallback(async (projectId: string, content: string, attachments: Attachment[] = []) => {
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: Date.now(),
    };

    // Get project to check for project-specific provider/model
    const project = projects.find((p) => p.id === projectId);
    const provider = project?.provider || settings.provider;
    const model = project?.model || settings.model;

    // Create a new conversation for this project
    const conv: Conversation = {
      id: generateId(),
      title: generateTitle(content),
      messages: [userMessage],
      provider,
      model,
      projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Switch away from project dashboard to show the conversation
    setCurrentProjectId(null);
    await streamResponse(conv);
  }, [projects, settings.provider, settings.model, streamResponse]);

  // Regenerate the last assistant response
  const handleRegenerate = useCallback(async () => {
    if (!currentConversation || currentConversation.messages.length < 2) return;

    const messages = currentConversation.messages;
    const lastMessage = messages[messages.length - 1];

    // Only regenerate if the last message is from assistant
    if (lastMessage.role !== 'assistant') return;

    // Remove the last assistant message and regenerate
    const conv: Conversation = {
      ...currentConversation,
      messages: messages.slice(0, -1),
      updatedAt: Date.now(),
    };

    await streamResponse(conv);
  }, [currentConversation, streamResponse]);

  // Edit a user message and resend from that point
  const handleEdit = useCallback(async (messageId: string, newContent: string) => {
    if (!currentConversation) return;

    const messageIndex = currentConversation.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const originalMessage = currentConversation.messages[messageIndex];
    if (originalMessage.role !== 'user') return;

    // Create updated message with new content but keep attachments
    const updatedMessage: Message = {
      ...originalMessage,
      content: newContent,
      timestamp: Date.now(),
    };

    // Truncate conversation at edit point and replace user message
    const conv: Conversation = {
      ...currentConversation,
      messages: [...currentConversation.messages.slice(0, messageIndex), updatedMessage],
      updatedAt: Date.now(),
    };

    await streamResponse(conv);
  }, [currentConversation, streamResponse]);

  // Find the last assistant message index
  const lastAssistantMessageIndex = currentConversation?.messages
    ? currentConversation.messages.map((m, i) => ({ role: m.role, index: i }))
        .filter((m) => m.role === 'assistant')
        .pop()?.index ?? -1
    : -1;

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        projects={projects}
        currentId={currentConversation?.id ?? null}
        currentProjectId={currentProjectId}
        onSelect={handleSelectConversation}
        onSelectProject={handleSelectProject}
        onNew={handleNewChat}
        onNewInProject={handleNewChatInProject}
        onDelete={handleDeleteConversation}
        onOpenSettings={() => setShowSettings(true)}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onUpdateProjectInstructions={handleUpdateProjectInstructions}
        onUpdateProjectFiles={handleUpdateProjectFiles}
        onUpdateProjectProviderModel={handleUpdateProjectProviderModel}
        onMoveToProject={handleMoveToProject}
      />

      <div
        className="flex-1 flex flex-col h-screen transition-all duration-200"
        style={artifactPanelOpen ? { marginRight: `${artifactPanelWidth}%` } : undefined}
      >
        <header className="h-14 border-b border-[var(--border-color)] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h1 className="font-medium">
              {currentProjectId
                ? projects.find(p => p.id === currentProjectId)?.name || 'Project'
                : (currentConversation?.title || 'New chat')}
            </h1>
            {settings.webSearchEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Web
              </span>
            )}
            {settings.googleDriveEnabled && settings.googleDriveAccessToken && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm.79 1h8l5.14 10L17.5 21h-11l-4.14-6.5 5.14-10z"/>
                </svg>
                Drive
              </span>
            )}
          </div>
          {!currentProjectId && (
            <div className="flex items-center gap-4">
              <TokenUsageDisplay usage={lastUsage} sessionUsage={sessionUsage} />
              <div className="flex items-center gap-2">
                <select
                  value={settings.provider}
                  onChange={(e) => handleProviderChange(e.target.value as Provider)}
                  className="text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background)]"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google (Gemini)</option>
                  <option value="mistral">Mistral</option>
                  <option value="cerebras">Cerebras</option>
                </select>
                <select
                  value={settings.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background)] max-w-[180px]"
                >
                  {DEFAULT_MODELS[settings.provider].map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto relative">
          {currentProjectId ? (
            <ProjectDashboard
              project={projects.find(p => p.id === currentProjectId)!}
              conversations={conversations.filter(c => c.projectId === currentProjectId)}
              onSelectConversation={handleSelectConversation}
              onSendMessage={(message, attachments) => handleSendInProject(currentProjectId, message, attachments)}
              onUpdateInstructions={(instructions) =>
                handleUpdateProjectInstructions(currentProjectId, instructions)
              }
              onUpdateFiles={(files) =>
                handleUpdateProjectFiles(currentProjectId, files)
              }
              onDeleteConversation={handleDeleteConversation}
              isLoading={isLoading}
              onStop={handleStop}
              webSearchEnabled={settings.webSearchEnabled}
              onToggleWebSearch={handleToggleWebSearch}
              googleDriveEnabled={settings.googleDriveEnabled}
              onToggleGoogleDrive={handleToggleGoogleDrive}
              googleDriveConnected={!!settings.googleDriveAccessToken}
              onPickDriveFile={handlePickDriveFile}
            />
          ) : currentConversation?.messages.length ? (
            <>
              {currentConversation.messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  artifacts={currentConversation.artifacts}
                  isLastAssistantMessage={index === lastAssistantMessageIndex}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                  onRegenerate={handleRegenerate}
                  onSelectArtifact={handleSelectArtifact}
                />
              ))}
              {(streamingContent || streamingContentBlocks.length > 0 || currentToolCalls.length > 0) ? (
                <div ref={streamingMessageRef}>
                  <ChatMessage
                    message={{
                      id: 'streaming',
                      role: 'assistant',
                      content: streamingContent,
                      contentBlocks: streamingContentBlocks.length > 0 ? streamingContentBlocks : undefined,
                      toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
                      timestamp: Date.now(),
                    }}
                    artifacts={[...(currentConversation?.artifacts || []), ...streamingArtifactsRef.current]}
                    onSelectArtifact={handleSelectArtifact}
                  />
                </div>
              ) : isLoading && (
                <ThinkingIndicator status={searchStatus || undefined} />
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <h2 className="text-2xl font-semibold mb-2">How can I help you today?</h2>
                <p className="text-sm">Send a message to start a conversation</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {!currentProjectId && (
          <div className="relative">
            {/* Scroll to bottom button */}
            {showScrollToBottom && (
              <button
                onClick={() => scrollToBottom()}
                className="absolute -top-12 left-1/2 -translate-x-1/2 p-2 bg-[var(--background)] border border-[var(--border-color)] rounded-full shadow-lg hover:bg-[var(--hover-bg)] transition-all z-10"
                aria-label="Scroll to bottom"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
            )}
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              onStop={handleStop}
              webSearchEnabled={settings.webSearchEnabled}
              onToggleWebSearch={handleToggleWebSearch}
              googleDriveEnabled={settings.googleDriveEnabled}
              onToggleGoogleDrive={handleToggleGoogleDrive}
              googleDriveConnected={!!settings.googleDriveAccessToken}
              onPickDriveFile={handlePickDriveFile}
            />
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Artifact Panel */}
      {artifactPanelOpen && (
        <ArtifactPanel
          artifact={
            currentConversation?.artifacts?.find(a => a.id === selectedArtifactId) ||
            streamingArtifactsRef.current.find(a => a.id === selectedArtifactId)
          }
          width={artifactPanelWidth}
          onClose={handleCloseArtifactPanel}
          onResize={setArtifactPanelWidth}
          onRename={handleRenameArtifact}
          onDownload={handleDownloadArtifact}
        />
      )}
    </div>
  );
}
