'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Attachment } from '@/types';
import { generateId } from '@/lib/storage';
import {
  formatFileSize,
  fileToBase64,
  isImageType,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from '@/lib/utils';

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
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setShowFileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" is too large. Maximum size is 20MB.`);
        continue;
      }

      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        alert(`File type "${file.type}" is not supported.`);
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

    setAttachments((prev) => [...prev, ...newAttachments]);
    setShowFileMenu(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const base64 = await fileToBase64(file);
          setAttachments((prev) => [
            ...prev,
            {
              id: generateId(),
              type: 'image',
              name: `pasted-image-${Date.now()}.png`,
              mimeType: file.type,
              data: base64,
              size: file.size,
            },
          ]);
        }
      }
    }
  };

  const handleDriveFilePick = () => {
    setShowFileMenu(false);
    onPickDriveFile?.();
  };

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--background)] p-4">
      <div className="max-w-3xl mx-auto">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group bg-[var(--user-bubble)] border border-[var(--border-color)] rounded-lg overflow-hidden"
              >
                {attachment.type === 'image' ? (
                  <div className="w-20 h-20 relative">
                    <img
                      src={`data:${attachment.mimeType};base64,${attachment.data}`}
                      alt={attachment.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 flex items-center gap-2 max-w-[200px]">
                    <svg className="w-5 h-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Two-part chat container */}
        <div className="relative bg-[var(--user-bubble)] border border-[var(--border-color)] rounded-2xl shadow-sm">
          {/* Top part: Text input */}
          <div className="flex items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message..."
              rows={1}
              className="flex-1 resize-none bg-transparent px-4 py-3 outline-none max-h-[200px]"
              disabled={isLoading}
            />
            <div className="p-2">
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
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Bottom part: Commands bar */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[var(--border-color)] bg-[var(--background)]/50">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Add file button (+) with dropdown */}
            <div className="relative" ref={fileMenuRef}>
              <button
                onClick={() => setShowFileMenu(!showFileMenu)}
                disabled={isLoading}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
                title="Add file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* File Source Dropdown */}
              {showFileMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[var(--background)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden z-50">
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => {
                      setShowFileMenu(false);
                      // Small delay to ensure menu closes before file dialog opens
                      setTimeout(() => fileInputRef.current?.click(), 10);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--border-color)] transition-colors flex items-center gap-3"
                  >
                    {/* Paperclip icon for computer files */}
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    From Computer
                  </button>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={handleDriveFilePick}
                    disabled={!googleDriveConnected}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--border-color)] transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Google Drive icon */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71z"/>
                    </svg>
                    <span className="flex-1">From Google Drive</span>
                    {!googleDriveConnected && (
                      <span className="text-xs text-gray-400">Not connected</span>
                    )}
                  </button>
                </div>
              )}
            </div>

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

            {/* Spacer */}
            <div className="flex-1" />

            {/* Help text */}
            <span className="text-xs text-gray-400 hidden md:inline">
              Enter to send, Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
