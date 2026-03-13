'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect, useMemo, useCallback, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Attachment, Provider, Prompt, AskQuestionToolResult, AskQuestionPrompt } from '@/types';
import { generateId, getPrompts } from '@/lib/storage';
import {
  formatFileSize,
  fileToBase64,
  isImageType,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
  modelSupportsVision,
  getVisionSuggestion,
} from '@/lib/utils';
import { notify } from '@/lib/notifications';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  pendingAskQuestion?: AskQuestionToolResult | null;
  onStop?: () => void;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  googleDriveEnabled?: boolean;
  onToggleGoogleDrive?: () => void;
  googleDriveConnected?: boolean;
  memorySearchEnabled?: boolean;
  onToggleMemorySearch?: () => void;
  ragEnabled?: boolean;
  onToggleRAG?: () => void;
  onOpenKnowledgeBase?: () => void;
  artifactsEnabled?: boolean;
  onToggleArtifacts?: () => void;
  mcpEnabled?: boolean;
  onToggleMCP?: () => void;
  currentProvider: Provider;
  currentModel: string;
  onModelChange?: (model: string) => void;
  onProviderChange?: (provider: Provider) => void;
  availableModels?: string[];
  customModels?: Partial<Record<Provider, string[]>>;
  thinkingSupported?: boolean;
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  pendingTemplate?: string | null;
  onTemplateConsumed?: () => void;
  onApplySystemPrompt?: (content: string) => void;
  hasCustomSystemPrompt?: boolean;
  onClearSystemPrompt?: () => void;
}

interface AskQuestionQuickReplyProps {
  questionSet: AskQuestionToolResult;
  isLoading: boolean;
  onSubmit: (answer: string) => void;
}

function AskQuestionQuickReply({ questionSet, isLoading, onSubmit }: AskQuestionQuickReplyProps) {
  const [askQuestionSelections, setAskQuestionSelections] = useState<Record<number, number[]>>({});
  const [askQuestionDetails, setAskQuestionDetails] = useState('');

  const toggleAskQuestionOption = (questionIndex: number, optionIndex: number, multiSelect: boolean) => {
    setAskQuestionSelections((prev) => {
      const current = prev[questionIndex] || [];
      let next: number[];

      if (multiSelect) {
        next = current.includes(optionIndex)
          ? current.filter((index) => index !== optionIndex)
          : [...current, optionIndex];
      } else {
        next = current.includes(optionIndex) ? [] : [optionIndex];
      }

      return {
        ...prev,
        [questionIndex]: next,
      };
    });
  };

  const formatAskQuestionAnswer = (questions: AskQuestionPrompt[]): string => {
    const lines: string[] = [];

    questions.forEach((question, questionIndex) => {
      const selectedOptionIndexes = askQuestionSelections[questionIndex] || [];
      const selectedLabels = selectedOptionIndexes
        .map((optionIndex) => question.options[optionIndex]?.label)
        .filter((label): label is string => typeof label === 'string' && label.length > 0);

      if (selectedLabels.length === 0) return;

      const heading = question.header || `Question ${questionIndex + 1}`;
      lines.push(`${heading}: ${selectedLabels.join(', ')}`);
    });

    if (askQuestionDetails.trim()) {
      lines.push(`Additional details: ${askQuestionDetails.trim()}`);
    }

    return lines.join('\n');
  };

  const handleAskQuestionSubmit = () => {
    const answer = formatAskQuestionAnswer(questionSet.questions);
    if (!answer.trim()) {
      notify('Select at least one option or provide additional details.', 'warning');
      return;
    }
    onSubmit(answer);
  };

  return (
    <div className="px-4 py-3 border-b border-[var(--border-color)] bg-blue-50/60 dark:bg-blue-900/15">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
          Answer Clarifying Questions
        </p>
        <span className="text-xs text-blue-700 dark:text-blue-400">
          {questionSet.questions.length} question{questionSet.questions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {questionSet.questions.map((question, questionIndex) => {
          const selectedOptionIndexes = askQuestionSelections[questionIndex] || [];
          return (
            <div key={questionIndex} className="rounded-lg border border-blue-200/80 dark:border-blue-800/60 bg-[var(--background)]/80 p-2.5">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-0.5">
                {question.header || `Question ${questionIndex + 1}`}
              </div>
              <p className="text-sm mb-2">{question.question}</p>

              {question.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = selectedOptionIndexes.includes(optionIndex);
                    return (
                      <button
                        key={`${questionIndex}-${optionIndex}`}
                        type="button"
                        onClick={() => toggleAskQuestionOption(questionIndex, optionIndex, !!question.multiSelect)}
                        disabled={isLoading}
                        className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border-color)] hover:border-blue-400'
                        }`}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {question.multiSelect && (
                <p className="text-[11px] text-gray-500 mt-1">Multiple selections allowed</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <textarea
          value={askQuestionDetails}
          onChange={(event) => setAskQuestionDetails(event.target.value)}
          rows={2}
          disabled={isLoading}
          placeholder="Optional details..."
          className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--background)] px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAskQuestionSubmit}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Send selected answer
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatInput({
  onSend,
  isLoading,
  pendingAskQuestion,
  onStop,
  webSearchEnabled,
  onToggleWebSearch,
  googleDriveEnabled,
  onToggleGoogleDrive,
  googleDriveConnected,
  memorySearchEnabled,
  onToggleMemorySearch,
  ragEnabled,
  onToggleRAG,
  onOpenKnowledgeBase,
  artifactsEnabled,
  onToggleArtifacts,
  mcpEnabled,
  onToggleMCP,
  currentProvider,
  currentModel,
  onModelChange,
  onProviderChange,
  availableModels,
  customModels,
  thinkingSupported,
  thinkingEnabled,
  onToggleThinking,
  pendingTemplate,
  onTemplateConsumed,
  onApplySystemPrompt,
  hasCustomSystemPrompt,
  onClearSystemPrompt,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dismissedVisionContext, setDismissedVisionContext] = useState<string | null>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [promptSearch, setPromptSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const promptPickerRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const lastAppliedTemplateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingTemplate || pendingTemplate === lastAppliedTemplateRef.current) return;

    lastAppliedTemplateRef.current = pendingTemplate;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setInput(pendingTemplate);
      onTemplateConsumed?.();
      textareaRef.current?.focus();
    });

    return () => {
      cancelled = true;
    };
  }, [pendingTemplate, onTemplateConsumed]);

  useEffect(() => {
    if (!pendingTemplate) {
      lastAppliedTemplateRef.current = null;
    }
  }, [pendingTemplate]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Click-outside for attach menu
  useEffect(() => {
    if (!showAttachMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (attachMenuRef.current && !attachMenuRef.current.contains(target)) {
        setShowAttachMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAttachMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAttachMenu]);

  // Click-outside for prompt picker
  useEffect(() => {
    if (!showPromptPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (promptPickerRef.current && !promptPickerRef.current.contains(target)) {
        setShowPromptPicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPromptPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showPromptPicker]);

  useEffect(() => {
    if (!showToolsMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(target)) {
        setShowToolsMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowToolsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showToolsMenu]);

  // Vision awareness
  const hasImages = useMemo(
    () => attachments.some((a) => a.type === 'image'),
    [attachments],
  );
  const supportsVision = useMemo(
    () => modelSupportsVision(currentModel, currentProvider),
    [currentModel, currentProvider],
  );
  const currentVisionContext = useMemo(
    () => `${currentProvider}:${currentModel}`,
    [currentProvider, currentModel],
  );
  const visionBannerDismissed = dismissedVisionContext === currentVisionContext;
  const visionSuggestion = useMemo(
    () =>
      hasImages && !supportsVision
        ? getVisionSuggestion(
            currentProvider,
            currentModel,
            availableModels || [],
            customModels,
          )
        : null,
    [hasImages, supportsVision, currentProvider, currentModel, availableModels, customModels],
  );

  const enabledToolCount = useMemo(() => {
    let count = 0;
    if (webSearchEnabled) count += 1;
    if (googleDriveEnabled && googleDriveConnected) count += 1;
    if (memorySearchEnabled) count += 1;
    if (ragEnabled) count += 1;
    if (artifactsEnabled !== false) count += 1;
    if (mcpEnabled) count += 1;
    if (thinkingEnabled && thinkingSupported) count += 1;
    return count;
  }, [
    webSearchEnabled,
    googleDriveEnabled,
    googleDriveConnected,
    memorySearchEnabled,
    ragEnabled,
    artifactsEnabled,
    mcpEnabled,
    thinkingEnabled,
    thinkingSupported,
  ]);

  const attachmentContextCount = useMemo(() => {
    let count = attachments.length;
    if (hasCustomSystemPrompt) count += 1;
    return count;
  }, [attachments.length, hasCustomSystemPrompt]);
  const prompts = useMemo(
    () => (showPromptPicker ? getPrompts() : []),
    [showPromptPicker],
  );
  const filteredPrompts = useMemo(() => {
    if (!promptSearch) return prompts;
    const q = promptSearch.toLowerCase();
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [prompts, promptSearch]);

  const handleSelectPrompt = useCallback(
    (prompt: Prompt) => {
      if (prompt.type === 'user') {
        setInput(prompt.content);
        textareaRef.current?.focus();
      } else {
        onApplySystemPrompt?.(prompt.content);
      }
      setPromptSearch('');
      setShowPromptPicker(false);
    },
    [onApplySystemPrompt]
  );

  const artifactsToolsEnabled = artifactsEnabled !== false;
  const handleAskQuestionSubmit = (answer: string) => {
    onSend(answer, []);
    setInput('');
    setAttachments([]);
    setShowToolsMenu(false);
  };

  const handleSubmit = () => {
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSend(input.trim(), attachments);
      setInput('');
      setAttachments([]);
      setShowToolsMenu(false);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Shared file processing used by file input, paste, and drag-and-drop
  const processFiles = useCallback(async (files: File[]) => {
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        notify(`File "${file.name}" is too large. Maximum size is 20MB.`, 'warning');
        continue;
      }

      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        notify(`File type "${file.type || 'unknown'}" is not supported.`, 'warning');
        continue;
      }

      const base64 = await fileToBase64(file);

      newAttachments.push({
        id: generateId(),
        type: isImageType(file.type) ? 'image' : 'file',
        name: file.name,
        mimeType: file.type,
        data: base64,
        size: file.size,
      });
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await processFiles(Array.from(files));
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      await processFiles(imageFiles);
    }
  };

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const handleVisionSwitch = () => {
    if (!visionSuggestion) return;
    if (visionSuggestion.isCrossProvider) {
      onProviderChange?.(visionSuggestion.provider);
    }
    onModelChange?.(visionSuggestion.model);
  };

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--background)] p-4">
      <div className="max-w-3xl mx-auto">
        {/* Drag-and-drop container */}
        <div
          className="relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-20 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/80 dark:bg-blue-900/30 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-blue-600 dark:text-blue-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm font-medium">Drop files here</span>
              </div>
            </div>
          )}

          <div className="bg-[var(--user-bubble)] border border-[var(--border-color)] rounded-2xl shadow-sm">
            {/* Attachment Previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 p-3 border-b border-[var(--border-color)]">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative group animate-attachment-in"
                  >
                    {attachment.type === 'image' ? (
                      <div className="w-28 h-28 relative rounded-xl overflow-hidden shadow-sm border border-[var(--border-color)]">
                        <img
                          src={`data:${attachment.mimeType};base64,${attachment.data}`}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="max-w-[240px] px-4 py-3 flex items-center gap-2 bg-[var(--background)] border border-[var(--border-color)] rounded-xl shadow-sm">
                        <svg className="w-6 h-6 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Remove attachment"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Vision warning banner */}
            {hasImages && !supportsVision && !visionBannerDismissed && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="flex-1">
                  <strong>{currentModel}</strong> doesn&apos;t support images.
                  {visionSuggestion && (
                    <> Switch to {visionSuggestion.displayName}?</>
                  )}
                </span>
                {visionSuggestion && (
                  <button
                    onClick={handleVisionSwitch}
                    className="px-2.5 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                  >
                    Switch
                  </button>
                )}
                <button
                  onClick={() => setDismissedVisionContext(currentVisionContext)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {pendingAskQuestion && pendingAskQuestion.questions.length > 0 && (
              <AskQuestionQuickReply
                key={JSON.stringify(pendingAskQuestion.questions)}
                questionSet={pendingAskQuestion}
                isLoading={isLoading}
                onSubmit={handleAskQuestionSubmit}
              />
            )}

            {/* Textarea */}
            <div className="px-4 py-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Message..."
                rows={1}
                className="w-full resize-none bg-transparent outline-none max-h-[200px]"
                disabled={isLoading}
              />
            </div>

            {/* Bottom toolbar */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[var(--border-color)] bg-[var(--background)]/50 rounded-b-2xl">
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES.join(',')}
                onChange={(e) => { handleFileSelect(e); setShowAttachMenu(false); }}
                className="hidden"
              />
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept={IMAGE_ACCEPT}
                onChange={(e) => { handleFileSelect(e); setShowAttachMenu(false); }}
                className="hidden"
              />

              {/* Attach menu (files, images, prompts) */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  onClick={() => {
                    setShowAttachMenu((prev) => !prev);
                    setPromptSearch('');
                    setShowPromptPicker(false);
                  }}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                    attachmentContextCount > 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)]'
                  }`}
                  title="Attach files, images, or prompts"
                  aria-expanded={showAttachMenu}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Attach</span>
                  {attachmentContextCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)]/80 border border-[var(--border-color)]">
                      {attachmentContextCount}
                    </span>
                  )}
                </button>

                {showAttachMenu && !showPromptPicker && (
                  <div className="absolute left-0 bottom-full mb-2 z-30 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--background)] shadow-xl py-1">
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--border-color)]/60 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attach File
                    </button>
                    <button
                      onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--border-color)]/60 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Attach Image
                    </button>
                    <div className="my-1 border-t border-[var(--border-color)]" />
                    <button
                      onClick={() => {
                        setPromptSearch('');
                        setShowAttachMenu(false);
                        setShowPromptPicker(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--border-color)]/60 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                      </svg>
                      Use Prompt
                    </button>
                  </div>
                )}

                {/* Prompt picker (sub-menu) */}
                {showPromptPicker && (
                  <div ref={promptPickerRef} className="absolute left-0 bottom-full mb-2 z-30 w-80 max-h-96 rounded-xl border border-[var(--border-color)] bg-[var(--background)] shadow-xl flex flex-col">
                    <div className="flex items-center gap-2 p-2 border-b border-[var(--border-color)]">
                      <button
                        onClick={() => {
                          setPromptSearch('');
                          setShowPromptPicker(false);
                          setShowAttachMenu(true);
                        }}
                        className="p-1 rounded hover:bg-[var(--border-color)] transition-colors"
                        title="Back"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <input
                        type="text"
                        placeholder="Search prompts..."
                        value={promptSearch}
                        onChange={(e) => setPromptSearch(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {filteredPrompts.length === 0 ? (
                        <div className="p-4 text-sm text-[var(--text-secondary)] text-center">
                          {prompts.length === 0 ? 'No prompts yet. Create one in the Prompt Library.' : 'No matching prompts.'}
                        </div>
                      ) : (
                        filteredPrompts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectPrompt(p)}
                            className="w-full text-left px-3 py-2.5 hover:bg-[var(--border-color)]/60 transition-colors border-b border-[var(--border-color)] last:border-b-0"
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  p.type === 'system'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}
                              >
                                {p.type}
                              </span>
                              <span className="text-sm font-medium truncate">{p.title}</span>
                            </div>
                            {p.description && (
                              <p className="text-xs text-[var(--text-secondary)] truncate">{p.description}</p>
                            )}
                            <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                              {p.content.length > 80 ? p.content.slice(0, 80) + '...' : p.content}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-[var(--border-color)]" />

              {/* Tools & Thinking menu */}
              <div className="relative" ref={toolsMenuRef}>
                <button
                  onClick={() => setShowToolsMenu((prev) => !prev)}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                    enabledToolCount > 0
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)]'
                  }`}
                  title="Configure tools"
                  aria-expanded={showToolsMenu}
                  aria-label="Configure tools"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.32 2.32 1.724 1.724 0 001.065 2.572 1.724 1.724 0 010 3.35 1.724 1.724 0 00-1.065 2.573 1.724 1.724 0 01-2.32 2.32 1.724 1.724 0 00-2.573 1.065 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.572-1.065 1.724 1.724 0 01-2.32-2.32 1.724 1.724 0 00-1.066-2.573 1.724 1.724 0 010-3.35 1.724 1.724 0 001.066-2.572 1.724 1.724 0 012.32-2.32 1.724 1.724 0 002.572-1.066z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                  <span className="hidden sm:inline">Tools</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--background)]/80 border border-[var(--border-color)]">
                    {enabledToolCount}
                  </span>
                </button>

                {showToolsMenu && (
                  <div className="absolute left-0 bottom-full mb-2 z-30 w-72 rounded-xl border border-[var(--border-color)] bg-[var(--background)] shadow-xl p-2 space-y-1">
                    <div className="px-2 py-1 text-xs font-medium text-gray-500">Tool Controls</div>

                    <button
                      onClick={onToggleWebSearch}
                      disabled={isLoading || !onToggleWebSearch}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                    >
                      <span>Web Search</span>
                      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${webSearchEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${webSearchEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>

                    <button
                      onClick={googleDriveConnected ? onToggleGoogleDrive : undefined}
                      disabled={isLoading || !googleDriveConnected || !onToggleGoogleDrive}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                      title={!googleDriveConnected ? 'Connect Google Drive in Settings' : undefined}
                    >
                      <span>Google Drive</span>
                      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${(googleDriveEnabled && googleDriveConnected) ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${(googleDriveEnabled && googleDriveConnected) ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>

                    <button
                      onClick={onToggleMemorySearch}
                      disabled={isLoading || !onToggleMemorySearch}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                    >
                      <span>Memory Search</span>
                      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${memorySearchEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${memorySearchEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>

                    <button
                      onClick={onToggleRAG}
                      disabled={isLoading || !onToggleRAG}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                    >
                      <span>Document Search (RAG)</span>
                      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${ragEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${ragEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>
                    {onOpenKnowledgeBase && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenKnowledgeBase();
                        }}
                        disabled={isLoading}
                        className="w-full text-left px-2 py-1 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-[var(--border-color)]/60 disabled:opacity-50 transition-colors"
                      >
                        Manage in Knowledge Base
                      </button>
                    )}

                    <button
                      onClick={onToggleArtifacts}
                      disabled={isLoading || !onToggleArtifacts}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                    >
                      <span>Artifacts</span>
                      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${artifactsToolsEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${artifactsToolsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>

                    <button
                      onClick={onToggleMCP}
                      disabled={isLoading || !onToggleMCP}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                    >
                      <span>MCP Tools</span>
                      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${mcpEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${mcpEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>

                    {thinkingSupported && onToggleThinking && (
                      <>
                        <div className="my-1 border-t border-[var(--border-color)]" />
                        <button
                          onClick={onToggleThinking}
                          disabled={isLoading}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-[var(--border-color)]/60 disabled:opacity-50"
                        >
                          <span>Thinking</span>
                          <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${thinkingEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                            <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${thinkingEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* System prompt indicator */}
              {hasCustomSystemPrompt && (
                <button
                  onClick={onClearSystemPrompt}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  title="Custom system prompt active. Click to clear."
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                  <span className="hidden sm:inline">Prompt</span>
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Vision badge */}
              <span
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs ${
                  supportsVision
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
                title={supportsVision ? 'Model supports vision' : 'Model does not support vision'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Help text */}
              <span className="text-xs text-gray-400 hidden md:inline mr-2">
                Enter to send, Shift+Enter for new line
              </span>

              {/* Send / Stop button */}
              {isLoading ? (
                <button
                  onClick={onStop}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Stop generating"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                  title="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
