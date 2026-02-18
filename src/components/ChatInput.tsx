'use client';

import { useState, useRef, useEffect, useMemo, useCallback, KeyboardEvent } from 'react';
import { Attachment, Provider } from '@/types';
import { generateId } from '@/lib/storage';
import {
  formatFileSize,
  fileToBase64,
  isImageType,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
  modelSupportsVision,
  getVisionSuggestion,
} from '@/lib/utils';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  onStop?: () => void;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  googleDriveEnabled?: boolean;
  onToggleGoogleDrive?: () => void;
  googleDriveConnected?: boolean;
  onPickDriveFile?: () => void;
  currentProvider: Provider;
  currentModel: string;
  onModelChange?: (model: string) => void;
  onProviderChange?: (provider: Provider) => void;
  availableModels?: string[];
  customModels?: Partial<Record<Provider, string[]>>;
}

export function ChatInput({
  onSend,
  isLoading,
  onStop,
  webSearchEnabled,
  onToggleWebSearch,
  googleDriveEnabled,
  onToggleGoogleDrive,
  googleDriveConnected,
  onPickDriveFile,
  currentProvider,
  currentModel,
  onModelChange,
  onProviderChange,
  availableModels,
  customModels,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [visionBannerDismissed, setVisionBannerDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Reset vision banner dismissal when model/provider changes
  useEffect(() => {
    setVisionBannerDismissed(false);
  }, [currentModel, currentProvider]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Vision awareness
  const hasImages = useMemo(
    () => attachments.some((a) => a.type === 'image'),
    [attachments],
  );
  const supportsVision = useMemo(
    () => modelSupportsVision(currentModel),
    [currentModel],
  );
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

  const handleSubmit = () => {
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSend(input.trim(), attachments);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
        alert(`File "${file.name}" is too large. Maximum size is 20MB.`);
        continue;
      }

      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        alert(`File type "${file.type || 'unknown'}" is not supported.`);
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
                  onClick={() => setVisionBannerDismissed(true)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Dismiss
                </button>
              </div>
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
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept={IMAGE_ACCEPT}
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Paperclip button — all files */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
                title="Attach file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              {/* Image button — images only */}
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
                title="Attach image"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-[var(--border-color)]" />

              {/* Web Search Toggle */}
              <button
                onClick={onToggleWebSearch}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                  webSearchEnabled
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)]'
                }`}
                title={webSearchEnabled ? 'Web search enabled' : 'Enable web search'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="hidden sm:inline">Web</span>
              </button>

              {/* Google Drive Search Toggle */}
              <button
                onClick={googleDriveConnected ? onToggleGoogleDrive : undefined}
                disabled={isLoading || !googleDriveConnected}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                  googleDriveEnabled && googleDriveConnected
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)]'
                } ${!googleDriveConnected ? 'cursor-not-allowed' : ''}`}
                title={
                  !googleDriveConnected
                    ? 'Connect Google Drive in Settings'
                    : googleDriveEnabled
                    ? 'Google Drive search enabled'
                    : 'Enable Google Drive search'
                }
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm.79 1h8l5.14 10L17.5 21h-11l-4.14-6.5 5.14-10z"/>
                </svg>
                <span className="hidden sm:inline">Drive</span>
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-[var(--border-color)]" />

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
