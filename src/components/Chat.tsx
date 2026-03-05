'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Message, Conversation, ChatSettings, DEFAULT_SETTINGS, DEFAULT_MODELS, Provider, Attachment, TokenUsage, Project, WebSearchResponse, GoogleDriveSearchResponse, ToolCall, ToolSource, ContentBlock, Artifact, ArtifactContentBlock, ReasoningContentBlock, ContextBreakdown, AskQuestionOption, AskQuestionPrompt, AskQuestionToolResult } from '@/types';
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
  addUsageRecord,
} from '@/lib/storage';
import { buildArtifactSystemPrompt, buildCitationSystemPrompt, buildEffectiveSystemPrompt, isArtifactTool, isOpenAIReasoningModel } from '@/lib/providers';
import { getActivePath, getSiblings, getDefaultLeaf, ensureTreeStructure } from '@/lib/conversation-tree';
import { processStreamingChunk } from '@/lib/artifact-parser';
import { MAX_TOOL_RECURSION_DEPTH } from '@/lib/constants';
import { Sidebar } from './Sidebar';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SettingsModal } from './SettingsModal';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ProjectDashboard } from './ProjectDashboard';
import { KnowledgeBase } from './KnowledgeBase';
import { ArtifactLibrary } from './ArtifactLibrary';
import { ModelsConfig } from './ModelsConfig';
import { ConnectorsConfig } from './ConnectorsConfig';
import { PromptLibrary } from './PromptLibrary';
import { ArtifactPanel } from './ArtifactPanel';
import { ContextInspector } from './ContextInspector';
import { SystemPromptInspector } from './SystemPromptInspector';
import { NotificationTray } from './NotificationTray';
import { useTheme } from './ThemeProvider';
import {
  useArtifacts,
  useProjects,
  useToolExecution,
  useScrollManagement,
} from '@/hooks';

function isOpenAINonDisableableReasoningModel(model: string): boolean {
  return /^(o1|o2|o3)(\b|[.-])/.test(model) || /^o4-mini(\b|[.-])/.test(model);
}

function getOpenAIThinkingOffEffort(model: string): 'none' | 'minimal' | null {
  if (isOpenAINonDisableableReasoningModel(model)) {
    // o4-mini and o3-or-lower can't be truly "off"
    return null;
  }

  const isGpt51Or52 = /^gpt-5\.(1|2)(\b|[.-])/.test(model);
  if (isGpt51Or52) {
    return 'none';
  }

  const isGpt5Family = /^gpt-5(\b|[.-])/.test(model);
  if (isGpt5Family) {
    return 'minimal';
  }

  return 'none';
}

function supportsThinkingToggle(provider: Provider, model: string): boolean {
  if (provider === 'openai') {
    return isOpenAIReasoningModel(model) && getOpenAIThinkingOffEffort(model) !== null;
  }

  if (provider === 'anthropic') {
    // Extended thinking requires Claude 3.5+/4.x models
    return /^claude-(opus|sonnet|haiku)-(4|3[\.-][5-9])/.test(model);
  }

  if (provider === 'google') {
    return model.includes('gemini-2.5') || model.includes('gemini-3');
  }

  return false;
}

function isThinkingEnabled(settings: ChatSettings, provider: Provider, model: string): boolean {
  if (!supportsThinkingToggle(provider, model)) return false;

  if (provider === 'openai') {
    const offEffort = getOpenAIThinkingOffEffort(model);
    if (!offEffort) return true;
    return (settings.openaiReasoningEffort || 'medium') !== offEffort;
  }

  if (provider === 'anthropic') {
    return !!settings.anthropicThinkingEnabled;
  }

  if (provider === 'google') {
    return !!settings.googleThinkingEnabled;
  }

  return false;
}

function countToolExecutions(
  toolExecutions: ToolExecutionResult[] | undefined,
  toolName: string
): number {
  if (!toolExecutions || toolExecutions.length === 0) return 0;
  return toolExecutions.filter((execution) => execution.toolName === toolName).length;
}

function isToolCallEnabled(
  toolName: string,
  toolSource: ToolSource | undefined,
  settings: ChatSettings,
  googleDriveConnected: boolean
): boolean {
  if (toolName === 'web_search') return !!settings.webSearchEnabled;
  if (toolName === 'google_drive_search') return !!settings.googleDriveEnabled && googleDriveConnected;
  if (toolName === 'memory_search') return !!settings.memorySearchEnabled;
  if (toolName === 'rag_search') return !!settings.ragEnabled;
  if (isArtifactTool(toolName)) return settings.artifactsEnabled !== false;
  if (toolSource === 'mcp') return !!settings.mcpEnabled;
  return true;
}

function getDisabledToolMessage(toolName: string): string {
  switch (toolName) {
    case 'web_search':
      return 'Web search is currently disabled from the chat toolbar.';
    case 'google_drive_search':
      return 'Google Drive search is currently disabled from the chat toolbar.';
    case 'memory_search':
      return 'Memory search is currently disabled from the chat toolbar.';
    case 'rag_search':
      return 'Document search is currently disabled from the chat toolbar.';
    case 'create_artifact':
    case 'update_artifact':
    case 'read_artifact':
      return 'Artifact tools are currently disabled from the chat toolbar.';
    default:
      return `Tool "${toolName}" is currently disabled from the chat toolbar.`;
  }
}

function formatWebSearchResultsForToolResponse(result: WebSearchResponse, citationBatch?: number): string {
  if (result.results.length === 0) {
    return `Web search for "${result.query}" returned no results.`;
  }

  let formatted = `Web search results for "${result.query}":\n\n`;
  result.results.forEach((r, i) => {
    const citationKey = citationBatch
      ? `web-${citationBatch}-${i + 1}`
      : `web-${i + 1}`;
    formatted += `[${citationKey}] ${r.title}\n`;
    formatted += `    URL: ${r.url}\n`;
    if (r.source) {
      formatted += `    Source: ${r.source}\n`;
    }
    formatted += `    Snippet: ${r.snippet}\n\n`;
  });
  formatted += 'Citation requirements for your next answer:\n';
  formatted += `- If you use a result, cite it inline with its key (example: ${citationBatch ? '[web-1-1]' : '[web-1]'}).\n`;
  formatted += '- End with a "Sources" section that lists only cited [web-#] (or [web-#-#]) entries and their URLs.\n';
  formatted += '- Do not invent citations.\n';
  return formatted;
}

function parseAskQuestionOptions(value: unknown): AskQuestionOption[] {
  if (!Array.isArray(value)) return [];

  const options: AskQuestionOption[] = [];
  for (const option of value) {
    if (typeof option === 'string') {
      const label = option.trim();
      if (label) options.push({ label });
      continue;
    }

    if (!option || typeof option !== 'object') continue;
    const optionObj = option as Record<string, unknown>;
    const label = typeof optionObj.label === 'string' ? optionObj.label.trim() : '';
    if (!label) continue;

    const description = typeof optionObj.description === 'string'
      ? optionObj.description.trim()
      : undefined;

    options.push({ label, ...(description ? { description } : {}) });
  }

  return options.slice(0, 4);
}

function normalizeAskQuestionPrompts(params: Record<string, unknown>): AskQuestionPrompt[] {
  const prompts: AskQuestionPrompt[] = [];

  if (Array.isArray(params.questions)) {
    for (const rawQuestion of params.questions) {
      if (!rawQuestion || typeof rawQuestion !== 'object') continue;
      const questionObj = rawQuestion as Record<string, unknown>;

      const question = typeof questionObj.question === 'string'
        ? questionObj.question.trim()
        : '';
      if (!question) continue;

      const header = typeof questionObj.header === 'string'
        ? questionObj.header.trim()
        : undefined;
      const multiSelect = typeof questionObj.multiSelect === 'boolean'
        ? questionObj.multiSelect
        : undefined;
      const options = parseAskQuestionOptions(questionObj.options);

      prompts.push({
        question,
        ...(header ? { header } : {}),
        ...(multiSelect !== undefined ? { multiSelect } : {}),
        options,
      });
    }
  }

  // Backward compatibility for single-question shape: { question, options?, header?, multiSelect? }
  if (prompts.length === 0 && typeof params.question === 'string') {
    const question = params.question.trim();
    if (question) {
      const header = typeof params.header === 'string' ? params.header.trim() : undefined;
      const multiSelect = typeof params.multiSelect === 'boolean' ? params.multiSelect : undefined;
      const options = parseAskQuestionOptions(params.options);
      prompts.push({
        question,
        ...(header ? { header } : {}),
        ...(multiSelect !== undefined ? { multiSelect } : {}),
        options,
      });
    }
  }

  return prompts.slice(0, 4);
}

function formatAskQuestionForMessage(prompts: AskQuestionPrompt[]): string {
  const lines: string[] = ['I need your input before I can continue:'];

  prompts.forEach((prompt, index) => {
    lines.push('');

    const heading = prompt.header?.trim() || `Question ${index + 1}`;
    lines.push(`${index + 1}. ${heading}`);
    lines.push(prompt.question);

    if (prompt.options.length > 0) {
      prompt.options.forEach((option, optionIndex) => {
        const letter = String.fromCharCode(65 + optionIndex);
        const suffix = option.description ? ` — ${option.description}` : '';
        lines.push(`   ${letter}) ${option.label}${suffix}`);
      });
    }

    if (prompt.multiSelect) {
      lines.push('   You can select multiple options.');
    }
  });

  lines.push('');
  lines.push('Reply with your choice(s) and any extra details.');

  return lines.join('\n');
}

function executeAskQuestionTool(
  params: Record<string, unknown>
): { isError: boolean; structuredResult: AskQuestionToolResult | null; formattedResult: string; messageText?: string } {
  const prompts = normalizeAskQuestionPrompts(params);
  if (prompts.length === 0) {
    return {
      isError: true,
      structuredResult: null,
      formattedResult: 'Error: ask_question requires a non-empty question (or questions array).',
    };
  }

  const structuredResult: AskQuestionToolResult = {
    __ask_question__: true,
    status: 'awaiting_user_input',
    questions: prompts,
  };

  return {
    isError: false,
    structuredResult,
    formattedResult: JSON.stringify(structuredResult),
    messageText: formatAskQuestionForMessage(prompts),
  };
}

function parseAskQuestionToolResult(result: unknown): AskQuestionToolResult | null {
  if (result && typeof result === 'object') {
    const maybeResult = result as Partial<AskQuestionToolResult>;
    if (
      maybeResult.__ask_question__ === true &&
      maybeResult.status === 'awaiting_user_input' &&
      Array.isArray(maybeResult.questions)
    ) {
      return maybeResult as AskQuestionToolResult;
    }
  }

  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      if (parsed && typeof parsed === 'object') {
        return parseAskQuestionToolResult(parsed);
      }
    } catch {
      // ignore JSON parsing errors
    }
  }

  return null;
}

function getPendingAskQuestionFromMessage(message: Message | null | undefined): AskQuestionToolResult | null {
  if (!message || message.role !== 'assistant') return null;

  const orderedToolCalls = message.contentBlocks
    ?.filter((block): block is { type: 'tool_call'; toolCall: ToolCall } => block.type === 'tool_call')
    .map((block) => block.toolCall);

  const toolCalls = orderedToolCalls && orderedToolCalls.length > 0
    ? orderedToolCalls
    : message.toolCalls || [];

  for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
    const toolCall = toolCalls[i];
    if (toolCall.name !== 'ask_question' || toolCall.status !== 'completed') continue;
    const parsed = parseAskQuestionToolResult(toolCall.result);
    if (parsed) return parsed;
  }

  return null;
}

export function Chat() {
  // Core state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [showArtifactLibrary, setShowArtifactLibrary] = useState(false);
  const [showModelsConfig, setShowModelsConfig] = useState(false);
  const [showConnectorsConfig, setShowConnectorsConfig] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [pendingTemplateText, setPendingTemplateText] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [streamingContentBlocks, setStreamingContentBlocks] = useState<ContentBlock[]>([]);
  const [contextBreakdown, setContextBreakdown] = useState<ContextBreakdown | null>(null);
  const [showContextInspector, setShowContextInspector] = useState(false);
  const [showSystemPromptInspector, setShowSystemPromptInspector] = useState(false);
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
    currentProjectId,
    setCurrentProjectId,
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

  // Computed: active branch path for display and API calls
  const displayMessages = useMemo(() => {
    if (!currentConversation) return [];
    return getActivePath(currentConversation.messages, currentConversation.activeLeafId);
  }, [currentConversation]);

  // Computed: branch info for each displayed message (siblings count/index)
  const branchInfoMap = useMemo(() => {
    if (!currentConversation) return new Map<string, { siblings: Message[]; index: number }>();
    const map = new Map<string, { siblings: Message[]; index: number }>();
    for (const msg of displayMessages) {
      map.set(msg.id, getSiblings(currentConversation.messages, msg.id));
    }
    return map;
  }, [currentConversation, displayMessages]);

  const pendingAskQuestion = useMemo(() => {
    if (displayMessages.length === 0) return null;
    const lastMessage = displayMessages[displayMessages.length - 1];
    return getPendingAskQuestionFromMessage(lastMessage);
  }, [displayMessages]);

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

  // Keyboard shortcut for system prompt inspector
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setShowSystemPromptInspector(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentProjectId(null);
    setCurrentConversation(null);
    setShowKnowledgeBase(false);
    setShowArtifactLibrary(false);
    setShowModelsConfig(false);
    setShowConnectorsConfig(false);
    setShowPromptLibrary(false);
    setStreamingContent('');
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
    setShowKnowledgeBase(false);
    setShowArtifactLibrary(false);
    setShowModelsConfig(false);
    setShowConnectorsConfig(false);
    setStreamingContent('');
    resetArtifactPanel();
  }, [projects, settings.provider, settings.model, resetArtifactPanel]);

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setCurrentProjectId(null);
      setCurrentConversation(conv);
      setShowKnowledgeBase(false);
      setShowArtifactLibrary(false);
      setShowModelsConfig(false);
      setShowConnectorsConfig(false);
      setShowPromptLibrary(false);
      setStreamingContent('');
      resetArtifactPanel();
    }
  }, [conversations, resetArtifactPanel]);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    setConversations(getConversations());
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
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
    const allModels = [
      ...DEFAULT_MODELS[provider],
      ...(settings.customModels?.[provider] || []),
    ];
    const newSettings = {
      ...settings,
      provider,
      model: allModels[0],
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

  const handleToggleMemorySearch = useCallback(() => {
    const newSettings = { ...settings, memorySearchEnabled: !settings.memorySearchEnabled };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleToggleRAG = useCallback(() => {
    const newSettings = { ...settings, ragEnabled: !settings.ragEnabled };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleToggleArtifacts = useCallback(() => {
    const currentlyEnabled = settings.artifactsEnabled !== false;
    const newSettings = { ...settings, artifactsEnabled: !currentlyEnabled };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleToggleMCP = useCallback(() => {
    const newSettings = { ...settings, mcpEnabled: !settings.mcpEnabled };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [settings]);

  const handleToggleThinking = useCallback((provider: Provider, model: string) => {
    if (!supportsThinkingToggle(provider, model)) return;

    let nextSettings = settings;

    if (provider === 'openai') {
      const currentEffort = settings.openaiReasoningEffort || 'medium';
      const offEffort = getOpenAIThinkingOffEffort(model);
      if (!offEffort) return;
      const isEnabled = currentEffort !== offEffort;
      nextSettings = {
        ...settings,
        openaiReasoningEffort: isEnabled ? offEffort : 'medium',
      };
    } else if (provider === 'anthropic') {
      nextSettings = {
        ...settings,
        anthropicThinkingEnabled: !settings.anthropicThinkingEnabled,
        anthropicThinkingBudgetTokens: settings.anthropicThinkingBudgetTokens || 1024,
      };
    } else if (provider === 'google') {
      const enabling = !settings.googleThinkingEnabled;
      const isGemini3 = model.includes('gemini-3');
      nextSettings = {
        ...settings,
        googleThinkingEnabled: enabling,
        googleThinkingLevel: isGemini3
          ? (settings.googleThinkingLevel || 'medium')
          : settings.googleThinkingLevel,
        googleThinkingBudget: !isGemini3
          ? (settings.googleThinkingBudget ?? -1)
          : settings.googleThinkingBudget,
      };
    }

    saveSettings(nextSettings);
    setSettings(nextSettings);
  }, [settings]);

  const handleOpenArtifactLibrary = useCallback(() => {
    setShowArtifactLibrary(true);
    setShowKnowledgeBase(false);
    setShowModelsConfig(false);
    setShowConnectorsConfig(false);
    setShowPromptLibrary(false);
    setCurrentConversation(null);
    setCurrentProjectId(null);
    resetArtifactPanel();
  }, [resetArtifactPanel]);

  const handleOpenArtifactFromLibrary = useCallback((conversationId: string, artifactId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    setShowArtifactLibrary(false);
    setShowKnowledgeBase(false);
    setShowModelsConfig(false);
    setShowConnectorsConfig(false);
    setCurrentProjectId(null);
    setCurrentConversation(conv);
    setStreamingContent('');
    resetArtifactPanel();

    requestAnimationFrame(() => {
      handleSelectArtifact(artifactId);
    });
  }, [conversations, handleSelectArtifact, resetArtifactPanel]);

  const handleSelectProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    setCurrentConversation(null);
    setShowKnowledgeBase(false);
    setShowArtifactLibrary(false);
    setShowModelsConfig(false);
    setShowConnectorsConfig(false);
    setShowPromptLibrary(false);
    setStreamingContent('');
    resetArtifactPanel();
  }, [resetArtifactPanel]);

  const activeProject = useMemo(
    () => (currentProjectId ? projects.find(p => p.id === currentProjectId) : undefined),
    [currentProjectId, projects]
  );

  const promptInspectorProject = useMemo(() => {
    const projectId = currentConversation?.projectId || currentProjectId;
    return projectId ? projects.find((p) => p.id === projectId) : undefined;
  }, [currentConversation?.projectId, currentProjectId, projects]);

  const promptInspectorSections = useMemo(() => {
    const sections: { label: string; content?: string }[] = [
      { label: 'Global Prompt', content: settings.systemPrompt?.trim() || undefined },
      { label: 'Project Instructions', content: promptInspectorProject?.instructions?.trim() || undefined },
      { label: 'Conversation Prompt', content: currentConversation?.systemPrompt?.trim() || undefined },
    ];

    const artifactPrompt = settings.artifactsEnabled !== false
      ? buildArtifactSystemPrompt(currentConversation?.artifacts)
      : undefined;
    const citationPrompt = buildCitationSystemPrompt(settings.webSearchEnabled, settings.ragEnabled);

    sections.push(
      { label: 'Artifact Instructions (auto)', content: artifactPrompt },
      { label: 'Citation Instructions (auto)', content: citationPrompt }
    );

    return sections;
  }, [
    settings.systemPrompt,
    settings.artifactsEnabled,
    settings.webSearchEnabled,
    settings.ragEnabled,
    promptInspectorProject?.instructions,
    currentConversation?.systemPrompt,
    currentConversation?.artifacts,
  ]);

  const effectiveSystemPrompt = useMemo(() => {
    return buildEffectiveSystemPrompt({
      globalPrompt: settings.systemPrompt,
      projectInstructions: promptInspectorProject?.instructions,
      conversationPrompt: currentConversation?.systemPrompt,
      artifactsEnabled: settings.artifactsEnabled,
      existingArtifacts: currentConversation?.artifacts,
      webSearchEnabled: settings.webSearchEnabled,
      ragEnabled: settings.ragEnabled,
    });
  }, [
    settings.systemPrompt,
    settings.artifactsEnabled,
    settings.webSearchEnabled,
    settings.ragEnabled,
    promptInspectorProject?.instructions,
    currentConversation?.systemPrompt,
    currentConversation?.artifacts,
  ]);

  const activeProjectProvider = activeProject?.provider || settings.provider;
  const activeProjectModel = activeProject?.model || settings.model;
  const activeProjectModels = [
    ...DEFAULT_MODELS[activeProjectProvider],
    ...(settings.customModels?.[activeProjectProvider] || []),
  ];

  const globalThinkingSupported = supportsThinkingToggle(settings.provider, settings.model);
  const globalThinkingEnabled = isThinkingEnabled(settings, settings.provider, settings.model);
  const projectThinkingSupported = supportsThinkingToggle(activeProjectProvider, activeProjectModel);
  const projectThinkingEnabled = isThinkingEnabled(settings, activeProjectProvider, activeProjectModel);

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
    // Compute parent ID for the assistant message from the active path
    const activePathForStream = getActivePath(conv.messages, conv.activeLeafId);
    const parentForAssistant = activePathForStream.length > 0
      ? activePathForStream[activePathForStream.length - 1].id
      : null;

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

      const limitProject = conv.projectId
        ? projects.find(p => p.id === conv.projectId)
        : undefined;
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: fullContent,
        contentBlocks: limitBlocks.length > 0 ? limitBlocks : undefined,
        toolCalls: limitToolCalls.length > 0 ? limitToolCalls : undefined,
        timestamp: Date.now(),
        model: limitProject?.model || settings.model,
        parentId: parentForAssistant,
      };

      const existingArtifacts = conv.artifacts || [];
      const allArtifacts = [...existingArtifacts, ...streamingArtifactsRef.current];

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, assistantMessage],
        artifacts: allArtifacts.length > 0 ? allArtifacts : undefined,
        activeLeafId: assistantMessage.id,
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

    // Track per-message usage and context breakdown (outside try for catch access)
    let capturedUsage: TokenUsage | null = null;
    let capturedBreakdown: ContextBreakdown | null = null;

    // Find project for this conversation (outside try for catch access)
    const currentProject = conv.projectId
      ? projects.find(p => p.id === conv.projectId)
      : undefined;

    try {
      abortControllerRef.current = new AbortController();
      // Combine user abort with a 5-minute streaming timeout
      const timeoutSignal = AbortSignal.timeout(300000); // 5 minutes
      const combinedSignal = AbortSignal.any([
        abortControllerRef.current.signal,
        timeoutSignal,
      ]);

      const allCurrentArtifacts = [...(conv.artifacts || []), ...streamingArtifactsRef.current];
      const mergedSystemPrompt = buildEffectiveSystemPrompt({
        globalPrompt: settings.systemPrompt,
        projectInstructions: currentProject?.instructions,
        conversationPrompt: conv.systemPrompt,
        artifactsEnabled: settings.artifactsEnabled,
        existingArtifacts: allCurrentArtifacts.length > 0 ? allCurrentArtifacts : undefined,
        webSearchEnabled: settings.webSearchEnabled,
        ragEnabled: settings.ragEnabled,
      });

      // Use active path (not all messages) for the API request
      const messagesWithProjectFiles = activePathForStream.map((m, idx) => {
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
          artifactsEnabled: settings.artifactsEnabled,
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
      // Buffer SSE chunks to handle event boundaries correctly
      let sseBuffer = '';
      // ask_question should end this assistant turn and wait for user response
      let shouldFinalizeAfterUserQuestion = false;

      while (true) {
        const { done, value } = await reader.read();
        sseBuffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true });

        // Normalize CRLF and flush any trailing event on stream end.
        sseBuffer = sseBuffer.replace(/\r/g, '');
        if (done) {
          sseBuffer += '\n\n';
        }

        const dataEvents: string[] = [];
        let boundaryIndex = sseBuffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const eventChunk = sseBuffer.slice(0, boundaryIndex);
          sseBuffer = sseBuffer.slice(boundaryIndex + 2);
          boundaryIndex = sseBuffer.indexOf('\n\n');

          if (!eventChunk.trim()) continue;
          const dataLines = eventChunk
            .split('\n')
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6));
          if (dataLines.length === 0) continue;
          dataEvents.push(dataLines.join('\n'));
        }

        for (const data of dataEvents) {
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
            if (parsed.context_breakdown) {
              capturedBreakdown = parsed.context_breakdown as ContextBreakdown;
              setContextBreakdown(capturedBreakdown);
            }
            if (parsed.usage) {
              const usage = parsed.usage as TokenUsage;
              capturedUsage = usage;
              // Record usage for cost tracking
              addUsageRecord({
                provider: (currentProject?.provider || settings.provider) as Provider,
                model: currentProject?.model || settings.model,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cacheReadTokens: usage.cachedTokens || 0,
                reasoningTokens: usage.reasoningTokens || 0,
                timestamp: Date.now(),
                conversationId: conv.id,
              });
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

              const toolEnabled = isToolCallEnabled(
                toolName,
                toolSource,
                settings,
                !!settings.googleDriveAccessToken
              );
              if (!toolEnabled) {
                const disabledMessage = getDisabledToolMessage(toolName);
                const toolCallIndex = toolCallsAccumulator.findIndex(tc => tc.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: 'error' as const,
                    result: disabledMessage,
                    error: disabledMessage,
                    completedAt: Date.now(),
                  };
                  toolCallsAccumulator[toolCallIndex] = updatedToolCall;
                  setCurrentToolCalls([...toolCallsAccumulator]);

                  const blockIndex = contentBlocksAccumulator.findIndex(
                    b => b.type === 'tool_call' && b.toolCall.id === toolCall.id
                  );
                  if (blockIndex !== -1) {
                    contentBlocksAccumulator[blockIndex] = { type: 'tool_call', toolCall: updatedToolCall };
                    setStreamingContentBlocks([...contentBlocksAccumulator]);
                  }
                }

                const toolExecution: ToolExecutionResult = {
                  toolCallId: toolCall.id,
                  toolName,
                  originalToolName,
                  toolParams,
                  result: disabledMessage,
                  isError: true,
                  anthropicThinkingSignature,
                  anthropicThinking,
                  geminiThoughtSignature: anthropicThinkingSignature,
                };
                const allExecs = [...(toolExecutions || []), toolExecution];
                await streamResponse(conv, undefined, toolCallsAccumulator, undefined, allExecs, contentBlocksAccumulator, recursionDepth + 1);
                return;
              }

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
              } else if (toolName === 'ask_question') {
                const askQuestionResult = executeAskQuestionTool(toolParams);

                const toolCallIndex = toolCallsAccumulator.findIndex(tc => tc.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: askQuestionResult.isError ? 'error' as const : 'completed' as const,
                    result: askQuestionResult.structuredResult || askQuestionResult.formattedResult,
                    error: askQuestionResult.isError ? askQuestionResult.formattedResult : undefined,
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
                }

                if (askQuestionResult.isError) {
                  const toolExecution: ToolExecutionResult = {
                    toolCallId: toolCall.id,
                    toolName,
                    originalToolName,
                    toolParams,
                    result: askQuestionResult.formattedResult,
                    isError: true,
                    anthropicThinkingSignature,
                    anthropicThinking,
                    geminiThoughtSignature: anthropicThinkingSignature,
                  };

                  const allExecs = [...(toolExecutions || []), toolExecution];
                  await streamResponse(conv, undefined, toolCallsAccumulator, undefined, allExecs, contentBlocksAccumulator, recursionDepth + 1);
                  return;
                }

                if (askQuestionResult.messageText) {
                  contentBlocksAccumulator.push({ type: 'text', text: askQuestionResult.messageText });
                }

                setStreamingContentBlocks([...contentBlocksAccumulator]);
                const fullText = contentBlocksAccumulator
                  .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                  .map(b => b.text)
                  .join('');
                setStreamingContent(fullText);

                shouldFinalizeAfterUserQuestion = true;
                break;
              } else if (toolName === 'web_search' || toolName === 'google_drive_search' || toolName === 'memory_search' || toolName === 'rag_search') {
                // Web search, Google Drive search, or Memory search - handle as proper tool results
                const searchQuery = toolParams.query as string;
                const priorWebSearchCount = countToolExecutions(toolExecutions, 'web_search');
                const priorRagSearchCount = countToolExecutions(toolExecutions, 'rag_search');

                let searchResult: WebSearchResponse | GoogleDriveSearchResponse | Record<string, unknown> | null = null;
                let formattedResult = '';
                let isError = false;

                if (toolName === 'web_search') {
                  const citationBatch = priorWebSearchCount + 1;
                  searchResult = await performSearch(searchQuery);
                  if (searchResult) {
                    // Format web search results as tool result text
                    const webResult = searchResult as WebSearchResponse;
                    formattedResult = formatWebSearchResultsForToolResponse(webResult, citationBatch);
                    searchResult = {
                      ...webResult,
                      citationBatch,
                    };
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
                    searchResult = { __memory_search__: true, query: searchQuery, results: memoryResult.results };
                  } else {
                    formattedResult = 'Memory search failed. Please try again.';
                    isError = true;
                  }
                } else if (toolName === 'rag_search') {
                  const citationBatch = priorRagSearchCount + 1;
                  const ragResult = await performRAGSearch(searchQuery, citationBatch);
                  if (ragResult) {
                    formattedResult = ragResult.formatted;
                    searchResult = {
                      __rag_search__: true,
                      citationBatch,
                      query: searchQuery,
                      results: ragResult.results,
                    };
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
              const priorWebSearchCount = countToolExecutions(toolExecutions, 'web_search');
              const priorRagSearchCount = countToolExecutions(toolExecutions, 'rag_search');
              let nextWebSearchBatch = priorWebSearchCount;
              let nextRagSearchBatch = priorRagSearchCount;
              const citationBatchByToolCallId = new Map<string, number>();
              parsed.tool_calls.forEach((
                tc: { name: string },
                idx: number
              ) => {
                const currentToolCallId = newToolCalls[idx]?.id;
                if (!currentToolCallId) return;
                if (tc.name === 'web_search') {
                  nextWebSearchBatch += 1;
                  citationBatchByToolCallId.set(currentToolCallId, nextWebSearchBatch);
                } else if (tc.name === 'rag_search') {
                  nextRagSearchBatch += 1;
                  citationBatchByToolCallId.set(currentToolCallId, nextRagSearchBatch);
                }
              });

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
                let askMessageText: string | undefined;

                let structuredResult: unknown = null;
                const toolEnabled = isToolCallEnabled(
                  tc.name,
                  tc.source,
                  settings,
                  !!settings.googleDriveAccessToken
                );
                if (!toolEnabled) {
                  return {
                    toolCall,
                    tc,
                    formattedResult: getDisabledToolMessage(tc.name),
                    isError: true,
                    structuredResult: null,
                    askMessageText: undefined,
                  };
                }

                try {
                  if (tc.name === 'web_search') {
                    const citationBatch = citationBatchByToolCallId.get(toolCall.id);
                    const result = await performSearch(tc.params.query as string);
                    if (result && result.results.length > 0) {
                      structuredResult = {
                        ...result,
                        citationBatch,
                      };
                      formattedResult = formatWebSearchResultsForToolResponse(result, citationBatch);
                    } else {
                      formattedResult = `Web search for "${tc.params.query}" returned no results.`;
                    }
                  } else if (tc.name === 'google_drive_search') {
                    const result = await performDriveSearch(tc.params.query as string);
                    if (result && result.results.length > 0) {
                      structuredResult = result;
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
                      structuredResult = { __memory_search__: true, query: tc.params.query, results: result.results };
                    } else {
                      formattedResult = 'Memory search failed.';
                      isError = true;
                    }
                  } else if (tc.name === 'rag_search') {
                    const citationBatch = citationBatchByToolCallId.get(toolCall.id);
                    const result = await performRAGSearch(tc.params.query as string, citationBatch);
                    if (result) {
                      formattedResult = result.formatted;
                      structuredResult = {
                        __rag_search__: true,
                        citationBatch,
                        query: tc.params.query,
                        results: result.results,
                      };
                    } else {
                      formattedResult = 'Document search failed.';
                      isError = true;
                    }
                  } else if (tc.name === 'ask_question') {
                    const askQuestionResult = executeAskQuestionTool(tc.params);
                    formattedResult = askQuestionResult.formattedResult;
                    isError = askQuestionResult.isError;
                    structuredResult = askQuestionResult.structuredResult;
                    askMessageText = askQuestionResult.messageText;
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

                return { toolCall, tc, formattedResult, isError, structuredResult, askMessageText };
              });

              const results = await Promise.all(toolCallPromises);

              let askQuestionMessage: string | null = null;
              let hasSuccessfulAskQuestion = false;

              // Batch state updates after all promises resolve
              for (const { toolCall, tc, formattedResult, isError, structuredResult, askMessageText } of results) {
                const toolCallIndex = toolCallsAccumulator.findIndex(t => t.id === toolCall.id);
                if (toolCallIndex !== -1) {
                  const updatedToolCall = {
                    ...toolCall,
                    status: isError ? 'error' as const : 'completed' as const,
                    result: structuredResult || formattedResult,
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

                if (tc.name === 'ask_question' && !isError) {
                  hasSuccessfulAskQuestion = true;
                  if (!askQuestionMessage && askMessageText) {
                    askQuestionMessage = askMessageText;
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

                if (!(tc.name === 'ask_question' && !isError)) {
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
              }

              if (hasSuccessfulAskQuestion && askQuestionMessage) {
                contentBlocksAccumulator.push({ type: 'text', text: askQuestionMessage });
              }

              // Update UI once after all tool calls complete
              setCurrentToolCalls([...toolCallsAccumulator]);
              setStreamingContentBlocks([...contentBlocksAccumulator]);
              const fullText = contentBlocksAccumulator
                .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                .map(b => b.text)
                .join('');
              setStreamingContent(fullText);

              if (hasSuccessfulAskQuestion) {
                shouldFinalizeAfterUserQuestion = true;
                break;
              }

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

        if (shouldFinalizeAfterUserQuestion) {
          try {
            await reader.cancel();
          } catch {
            // Ignore cancellation errors
          }
          break;
        }

        if (done) break;
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
        usage: capturedUsage || undefined,
        model: currentProject?.model || settings.model,
        contextBreakdown: capturedBreakdown || undefined,
        parentId: parentForAssistant,
      };

      // Merge any new artifacts with existing ones
      const existingArtifacts = conv.artifacts || [];
      const allArtifacts = [...existingArtifacts, ...streamingArtifactsRef.current];

      const updatedConv: Conversation = {
        ...conv,
        messages: [...conv.messages, assistantMessage],
        artifacts: allArtifacts.length > 0 ? allArtifacts : undefined,
        activeLeafId: assistantMessage.id,
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
                  usage: capturedUsage || undefined,
                  model: currentProject?.model || settings.model,
                  contextBreakdown: capturedBreakdown || undefined,
                  parentId: parentForAssistant,
                };
                const updatedConv: Conversation = {
                  ...conv,
                  messages: [...conv.messages, assistantMessage],
                  activeLeafId: assistantMessage.id,
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
          parentId: parentForAssistant,
        };
        const updatedConv: Conversation = {
          ...conv,
          messages: [...conv.messages, errorMessage],
          activeLeafId: errorMessage.id,
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
    // Determine parent from the active branch
    const activePath = currentConversation
      ? getActivePath(currentConversation.messages, currentConversation.activeLeafId)
      : [];
    const parentId = activePath.length > 0 ? activePath[activePath.length - 1].id : null;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: Date.now(),
      parentId,
    };

    let conv: Conversation;
    if (currentConversation) {
      conv = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage],
        activeLeafId: userMessage.id,
        updatedAt: Date.now(),
      };
    } else {
      conv = {
        id: generateId(),
        title: generateTitle(content),
        messages: [userMessage],
        provider: settings.provider,
        model: settings.model,
        activeLeafId: userMessage.id,
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
      parentId: null,
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
      activeLeafId: userMessage.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Switch away from project dashboard to show the conversation
    setCurrentProjectId(null);
    await streamResponse(conv);
  }, [projects, settings.provider, settings.model, streamResponse]);

  // Regenerate the last assistant response (non-destructive: creates a sibling)
  const handleRegenerate = useCallback(async () => {
    if (!currentConversation || displayMessages.length < 2) return;

    const lastDisplay = displayMessages[displayMessages.length - 1];
    if (lastDisplay.role !== 'assistant') return;

    // Ensure tree structure for legacy conversations
    const messages = ensureTreeStructure(currentConversation.messages);

    // Point activeLeafId at the parent user message
    // streamResponse will create a new assistant child = sibling of the old response
    const conv: Conversation = {
      ...currentConversation,
      messages,
      activeLeafId: lastDisplay.parentId ?? undefined,
      updatedAt: Date.now(),
    };

    await streamResponse(conv);
  }, [currentConversation, displayMessages, streamResponse]);

  // Edit a user message (non-destructive: creates a sibling branch)
  const handleEdit = useCallback(async (messageId: string, newContent: string) => {
    if (!currentConversation) return;

    // Ensure tree structure for legacy conversations
    const messages = ensureTreeStructure(currentConversation.messages);
    const original = messages.find(m => m.id === messageId);
    if (!original || original.role !== 'user') return;

    // Create a sibling user message (same parent as original)
    const newUserMessage: Message = {
      id: generateId(),
      role: 'user',
      content: newContent,
      attachments: original.attachments,
      parentId: original.parentId,
      timestamp: Date.now(),
    };

    const conv: Conversation = {
      ...currentConversation,
      messages: [...messages, newUserMessage],
      activeLeafId: newUserMessage.id,
      updatedAt: Date.now(),
    };

    await streamResponse(conv);
  }, [currentConversation, streamResponse]);

  // Switch to a sibling branch
  const handleSwitchBranch = useCallback((messageId: string, direction: 'prev' | 'next') => {
    if (!currentConversation) return;
    const { siblings, index } = getSiblings(currentConversation.messages, messageId);
    const newIdx = direction === 'prev' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return;

    const newLeafId = getDefaultLeaf(currentConversation.messages, siblings[newIdx].id);
    const updatedConv = { ...currentConversation, activeLeafId: newLeafId };
    setCurrentConversation(updatedConv);
    saveConversation(updatedConv);
    setConversations(getConversations());
  }, [currentConversation]);

  // Find the last assistant message index in the displayed path
  const lastAssistantMessageIndex = displayMessages.length > 0
    ? displayMessages.map((m, i) => ({ role: m.role, index: i }))
        .filter((m) => m.role === 'assistant')
        .pop()?.index ?? -1
    : -1;

  const isMainChatSurface =
    !showKnowledgeBase && !showArtifactLibrary && !showModelsConfig && !showConnectorsConfig && !showPromptLibrary;

  const headerTitle = showPromptLibrary
    ? 'Prompt Library'
    : showModelsConfig
    ? 'Models & Providers'
    : showConnectorsConfig
    ? 'Connectors'
    : showArtifactLibrary
    ? 'Artifact Library'
    : showKnowledgeBase
    ? 'Knowledge Base'
    : currentProjectId
    ? projects.find(p => p.id === currentProjectId)?.name || 'Project'
    : (currentConversation?.title || 'New chat');

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
        onOpenKnowledgeBase={() => {
          setShowKnowledgeBase(true);
          setShowArtifactLibrary(false);
          setShowModelsConfig(false);
          setShowConnectorsConfig(false);
          setShowPromptLibrary(false);
          setCurrentConversation(null);
          setCurrentProjectId(null);
          resetArtifactPanel();
        }}
        onOpenArtifactLibrary={() => {
          handleOpenArtifactLibrary();
        }}
        onOpenModelsConfig={() => {
          setShowModelsConfig(true);
          setShowArtifactLibrary(false);
          setShowKnowledgeBase(false);
          setShowConnectorsConfig(false);
          setShowPromptLibrary(false);
          setCurrentConversation(null);
          setCurrentProjectId(null);
          resetArtifactPanel();
        }}
        onOpenConnectorsConfig={() => {
          setShowConnectorsConfig(true);
          setShowArtifactLibrary(false);
          setShowModelsConfig(false);
          setShowKnowledgeBase(false);
          setShowPromptLibrary(false);
          setCurrentConversation(null);
          setCurrentProjectId(null);
          resetArtifactPanel();
        }}
        onOpenPromptLibrary={() => {
          setShowPromptLibrary(true);
          setShowArtifactLibrary(false);
          setShowModelsConfig(false);
          setShowConnectorsConfig(false);
          setShowKnowledgeBase(false);
          setCurrentConversation(null);
          setCurrentProjectId(null);
          resetArtifactPanel();
        }}
      />

      <div
        className="flex-1 flex flex-col h-screen transition-all duration-200"
        style={artifactPanelOpen ? { marginRight: `${artifactPanelWidth}%` } : undefined}
      >
        <header className="h-14 border-b border-[var(--border-color)] px-3 sm:px-4">
          <div className="flex h-full min-w-0 items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-sm font-medium sm:text-base">{headerTitle}</h1>

            {isMainChatSurface && !currentProjectId && (
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setShowContextInspector(true)}
                  disabled={!contextBreakdown}
                  className="shrink-0 text-xs px-2 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--border-color)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Open context inspector"
                >
                  Context
                </button>

                <select
                  value={settings.provider}
                  onChange={(e) => handleProviderChange(e.target.value as Provider)}
                  className="shrink-0 w-[120px] text-xs sm:text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background)]"
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
                  className="shrink-0 w-[170px] sm:w-[220px] text-xs sm:text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background)]"
                >
                  {[
                    ...DEFAULT_MODELS[settings.provider],
                    ...(settings.customModels?.[settings.provider] || []),
                  ].map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto relative">
          {showPromptLibrary ? (
            <PromptLibrary
              settings={settings}
              onSettingsChange={(partial) => {
                const newSettings = { ...settings, ...partial };
                handleSaveSettings(newSettings);
              }}
              onApplySystemPrompt={(content, target) => {
                if (target === 'global') {
                  handleSaveSettings({ ...settings, systemPrompt: content });
                } else if (currentConversation) {
                  const updated = { ...currentConversation, systemPrompt: content, updatedAt: Date.now() };
                  setCurrentConversation(updated);
                  saveConversation(updated);
                  setConversations(getConversations());
                }
                setShowPromptLibrary(false);
              }}
              onInsertUserTemplate={(content) => {
                setShowPromptLibrary(false);
                setPendingTemplateText(content);
              }}
              hasActiveConversation={!!currentConversation}
              onClose={() => setShowPromptLibrary(false)}
            />
          ) : showModelsConfig ? (
            <ModelsConfig
              settings={settings}
              onSettingsChange={(partial) => {
                const newSettings = { ...settings, ...partial };
                handleSaveSettings(newSettings);
              }}
              onClose={() => setShowModelsConfig(false)}
            />
          ) : showConnectorsConfig ? (
            <ConnectorsConfig
              settings={settings}
              onSettingsChange={(partial) => {
                const newSettings = { ...settings, ...partial };
                handleSaveSettings(newSettings);
              }}
              onClose={() => setShowConnectorsConfig(false)}
            />
          ) : showArtifactLibrary ? (
            <ArtifactLibrary
              conversations={conversations}
              projects={projects}
              onOpenArtifact={handleOpenArtifactFromLibrary}
              onClose={() => setShowArtifactLibrary(false)}
            />
          ) : showKnowledgeBase ? (
            <KnowledgeBase
              conversations={conversations}
              settings={settings}
              onSettingsChange={(partial) => {
                const newSettings = { ...settings, ...partial };
                handleSaveSettings(newSettings);
              }}
              onClose={() => setShowKnowledgeBase(false)}
            />
          ) : currentProjectId && activeProject ? (
            <ProjectDashboard
              key={activeProject.id}
              project={activeProject}
              conversations={conversations.filter(c => c.projectId === currentProjectId)}
              onSelectConversation={handleSelectConversation}
              onSendMessage={(message, attachments) => handleSendInProject(currentProjectId, message, attachments)}
              onUpdateInstructions={(instructions) =>
                handleUpdateProjectInstructions(currentProjectId, instructions)
              }
              onUpdateFiles={(files) =>
                handleUpdateProjectFiles(currentProjectId, files)
              }
              isLoading={isLoading}
              onStop={handleStop}
              webSearchEnabled={settings.webSearchEnabled}
              onToggleWebSearch={handleToggleWebSearch}
              googleDriveEnabled={settings.googleDriveEnabled}
              onToggleGoogleDrive={handleToggleGoogleDrive}
              googleDriveConnected={!!settings.googleDriveAccessToken}
              memorySearchEnabled={settings.memorySearchEnabled}
              onToggleMemorySearch={handleToggleMemorySearch}
              ragEnabled={settings.ragEnabled}
              onToggleRAG={handleToggleRAG}
              artifactsEnabled={settings.artifactsEnabled}
              onToggleArtifacts={handleToggleArtifacts}
              mcpEnabled={settings.mcpEnabled}
              onToggleMCP={handleToggleMCP}
              currentProvider={activeProjectProvider}
              currentModel={activeProjectModel}
              onModelChange={handleModelChange}
              onProviderChange={handleProviderChange}
              availableModels={activeProjectModels}
              customModels={settings.customModels}
              thinkingSupported={projectThinkingSupported}
              thinkingEnabled={projectThinkingEnabled}
              onToggleThinking={() => handleToggleThinking(activeProjectProvider, activeProjectModel)}
            />
          ) : displayMessages.length ? (
            <>
              {displayMessages.map((message, index) => {
                const branchInfo = branchInfoMap.get(message.id);
                const siblingCount = branchInfo?.siblings.length ?? 1;
                const siblingIndex = branchInfo?.index ?? 0;
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    artifacts={currentConversation?.artifacts}
                    isLastAssistantMessage={index === lastAssistantMessageIndex}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onRegenerate={handleRegenerate}
                    onSelectArtifact={handleSelectArtifact}
                    onOpenContextInspector={(breakdown) => {
                      setContextBreakdown(breakdown);
                      setShowContextInspector(true);
                    }}
                    siblingCount={siblingCount}
                    siblingIndex={siblingIndex}
                    onSwitchBranch={handleSwitchBranch}
                  />
                );
              })}
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

        {!currentProjectId && !showKnowledgeBase && !showArtifactLibrary && !showModelsConfig && !showConnectorsConfig && !showPromptLibrary && (
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
              pendingAskQuestion={pendingAskQuestion}
              onStop={handleStop}
              webSearchEnabled={settings.webSearchEnabled}
              onToggleWebSearch={handleToggleWebSearch}
              googleDriveEnabled={settings.googleDriveEnabled}
              onToggleGoogleDrive={handleToggleGoogleDrive}
              googleDriveConnected={!!settings.googleDriveAccessToken}
              memorySearchEnabled={settings.memorySearchEnabled}
              onToggleMemorySearch={handleToggleMemorySearch}
              ragEnabled={settings.ragEnabled}
              onToggleRAG={handleToggleRAG}
              artifactsEnabled={settings.artifactsEnabled}
              onToggleArtifacts={handleToggleArtifacts}
              mcpEnabled={settings.mcpEnabled}
              onToggleMCP={handleToggleMCP}
              currentProvider={settings.provider}
              currentModel={settings.model}
              onModelChange={handleModelChange}
              onProviderChange={handleProviderChange}
              availableModels={[
                ...DEFAULT_MODELS[settings.provider],
                ...(settings.customModels?.[settings.provider] || []),
              ]}
              customModels={settings.customModels}
              thinkingSupported={globalThinkingSupported}
              thinkingEnabled={globalThinkingEnabled}
              onToggleThinking={() => handleToggleThinking(settings.provider, settings.model)}
              pendingTemplate={pendingTemplateText}
              onTemplateConsumed={() => setPendingTemplateText(null)}
              onApplySystemPrompt={(content) => {
                if (currentConversation) {
                  const updated = { ...currentConversation, systemPrompt: content, updatedAt: Date.now() };
                  setCurrentConversation(updated);
                  saveConversation(updated);
                  setConversations(getConversations());
                }
              }}
              hasCustomSystemPrompt={!!currentConversation?.systemPrompt}
              onClearSystemPrompt={() => {
                if (currentConversation) {
                  const updated = { ...currentConversation, systemPrompt: undefined, updatedAt: Date.now() };
                  setCurrentConversation(updated);
                  saveConversation(updated);
                  setConversations(getConversations());
                }
              }}
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

      {showSystemPromptInspector && (
        <SystemPromptInspector
          prompt={effectiveSystemPrompt}
          sections={promptInspectorSections}
          onClose={() => setShowSystemPromptInspector(false)}
        />
      )}

      <NotificationTray />

      {/* Context Inspector */}
      {showContextInspector && contextBreakdown && (
        <ContextInspector
          breakdown={contextBreakdown}
          onClose={() => setShowContextInspector(false)}
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
