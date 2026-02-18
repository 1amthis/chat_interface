'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Project, Conversation, ProjectFile, Attachment, Provider } from '@/types';
import { generateId } from '@/lib/storage';
import { ChatInput } from './ChatInput';
import {
  formatFileSize,
  formatRelativeTime,
  fileToBase64,
  isImageType,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from '@/lib/utils';

interface ProjectDashboardProps {
  project: Project;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onSendMessage: (message: string, attachments: Attachment[]) => void;
  onUpdateInstructions: (instructions: string | undefined) => void;
  onUpdateFiles: (files: ProjectFile[] | undefined) => void;
  onDeleteConversation: (id: string) => void;
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

export function ProjectDashboard({
  project,
  conversations,
  onSelectConversation,
  onSendMessage,
  onUpdateInstructions,
  onUpdateFiles,
  onDeleteConversation,
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
}: ProjectDashboardProps) {
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save instructions with debounce
  useEffect(() => {
    if (instructions !== (project.instructions || '')) {
      setSaveStatus('saving');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        onUpdateInstructions(instructions || undefined);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [instructions, project.instructions, onUpdateInstructions]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: ProjectFile[] = [];

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

      newFiles.push({
        id: generateId(),
        type: isImageType(file.type) ? 'image' : 'file',
        name: file.name,
        mimeType: file.type,
        data: base64,
        size: file.size,
        addedAt: Date.now(),
      });
    }

    const updatedFiles = [...(project.files || []), ...newFiles];
    onUpdateFiles(updatedFiles);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = (fileId: string) => {
    const updatedFiles = (project.files || []).filter(f => f.id !== fileId);
    onUpdateFiles(updatedFiles.length > 0 ? updatedFiles : undefined);
    setDeleteConfirm(null);
  };

  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-8" style={{ borderLeft: `4px solid ${project.color}`, paddingLeft: '1rem' }}>
          <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
          <p className="text-sm text-gray-500">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>

      {/* Instructions Section */}
      <div className="mb-8 border border-[var(--border-color)] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-4 bg-[var(--border-color)]/30 hover:bg-[var(--border-color)]/50"
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 transition-transform ${showInstructions ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <h2 className="font-semibold">Project Instructions</h2>
            {saveStatus && (
              <span className="text-xs text-gray-500">
                {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
              </span>
            )}
          </div>
        </button>
        {showInstructions && (
          <div className="p-4">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Additional instructions for all conversations in this project..."
              className="w-full min-h-[120px] px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--background)] resize-y"
            />
            <p className="text-xs text-gray-500 mt-2">
              These instructions are merged with your global system prompt
            </p>
          </div>
        )}
      </div>

      {/* Files Section */}
      <div className="mb-8 border border-[var(--border-color)] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="w-full flex items-center justify-between p-4 bg-[var(--border-color)]/30 hover:bg-[var(--border-color)]/50"
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 transition-transform ${showFiles ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <h2 className="font-semibold">Reference Files</h2>
            <span className="text-xs text-gray-500">
              {project.files?.length || 0} file{project.files?.length !== 1 ? 's' : ''}
            </span>
          </div>
        </button>
        {showFiles && (
          <div className="p-4">
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-[var(--border-color)] rounded hover:bg-[var(--border-color)]/50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Files
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Files are automatically attached to all conversations in this project
              </p>
            </div>

            {project.files && project.files.length > 0 ? (
              <div className="space-y-2">
                {project.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border border-[var(--border-color)] rounded hover:bg-[var(--border-color)]/30"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {file.type === 'image' ? (
                        <img
                          src={`data:${file.mimeType};base64,${file.data}`}
                          alt={file.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-[var(--border-color)] rounded flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)} • Added {formatRelativeTime(file.addedAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(file.id)}
                      className="p-2 hover:bg-red-500/20 rounded"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p>No reference files yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversations Section */}
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
        <div className="p-4 bg-[var(--border-color)]/30">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Conversations</h2>
            <span className="text-xs px-2 py-0.5 bg-[var(--border-color)] rounded-full">
              {conversations.length}
            </span>
          </div>
        </div>
        <div className="p-4">
          {sortedConversations.length > 0 ? (
            <div className="space-y-2">
              {sortedConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-4 border border-[var(--border-color)] rounded-lg hover:bg-[var(--border-color)]/30 cursor-pointer transition-colors"
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium flex-1">{conv.title}</h3>
                    <span className="text-xs text-gray-500 ml-4">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{conv.provider}</span>
                    <span>•</span>
                    <span>{conv.model}</span>
                  </div>
                  {conv.messages.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2 truncate">
                      {conv.messages[conv.messages.length - 1].content.substring(0, 100)}
                      {conv.messages[conv.messages.length - 1].content.length > 100 ? '...' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-500 mb-4">No conversations yet</p>
              <p className="text-sm text-gray-400">Use the chat input below to start your first conversation</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Chat Input at bottom */}
      <ChatInput
        onSend={onSendMessage}
        isLoading={isLoading}
        onStop={onStop}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={onToggleWebSearch}
        googleDriveEnabled={googleDriveEnabled}
        onToggleGoogleDrive={onToggleGoogleDrive}
        googleDriveConnected={googleDriveConnected}
        onPickDriveFile={onPickDriveFile}
        currentProvider={currentProvider}
        currentModel={currentModel}
        onModelChange={onModelChange}
        onProviderChange={onProviderChange}
        availableModels={availableModels}
        customModels={customModels}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--background)] border border-[var(--border-color)] rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete File?</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete this file? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-[var(--border-color)] rounded hover:bg-[var(--border-color)]/50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteFile(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
