'use client';

import { useState } from 'react';
import { Message, Attachment, ContentBlock, Artifact, ReasoningContentBlock, ContextBreakdown } from '@/types';
import { MarkdownMessage } from './MarkdownMessage';
import ToolCallDisplay from './ToolCallDisplay';
import { ArtifactCard } from './ArtifactCard';
import { MessageUsageDisplay } from './MessageUsageDisplay';
import { formatFileSize } from '@/lib/utils';

// Reasoning display component for o-series models
function ReasoningDisplay({ reasoning, isStreaming }: { reasoning: string; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-3 border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-purple-50 dark:bg-purple-900/30 flex items-center justify-between text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Reasoning
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              thinking...
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 bg-purple-50/50 dark:bg-purple-900/20 max-h-64 overflow-y-auto">
          <pre className="whitespace-pre-wrap font-sans">{reasoning}</pre>
        </div>
      )}
    </div>
  );
}

interface ContentBlocksRendererProps {
  blocks: ContentBlock[];
  artifacts?: Artifact[];
  onSelectArtifact?: (artifactId: string) => void;
}

// Renders content blocks in order (text, reasoning, tool calls, and artifacts interleaved)
function ContentBlocksRenderer({ blocks, artifacts, onSelectArtifact }: ContentBlocksRendererProps) {
  // Check if this is the last reasoning block (for streaming indicator)
  const lastReasoningIndex = blocks.map((b, i) => b.type === 'reasoning' ? i : -1).filter(i => i >= 0).pop();
  const hasContentAfterLastReasoning = lastReasoningIndex !== undefined &&
    blocks.slice(lastReasoningIndex + 1).some(b => b.type === 'text' && (b as { text: string }).text);

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return block.text ? (
            <MarkdownMessage key={index} content={block.text} />
          ) : null;
        } else if (block.type === 'reasoning') {
          const reasoningBlock = block as ReasoningContentBlock;
          const isLastReasoning = index === lastReasoningIndex;
          const isStreaming = isLastReasoning && !hasContentAfterLastReasoning;
          return reasoningBlock.reasoning ? (
            <ReasoningDisplay key={index} reasoning={reasoningBlock.reasoning} isStreaming={isStreaming} />
          ) : null;
        } else if (block.type === 'tool_call') {
          return (
            <ToolCallDisplay key={index} toolCalls={[block.toolCall]} inline />
          );
        } else if (block.type === 'artifact') {
          const artifact = artifacts?.find(a => a.id === block.artifactId);
          if (artifact && onSelectArtifact) {
            return (
              <ArtifactCard
                key={index}
                artifact={artifact}
                onClick={onSelectArtifact}
              />
            );
          }
          return null;
        }
        return null;
      })}
    </>
  );
}

interface ChatMessageProps {
  message: Message;
  artifacts?: Artifact[];
  isLastAssistantMessage?: boolean;
  isLoading?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  onSelectArtifact?: (artifactId: string) => void;
  onOpenContextInspector?: (breakdown: ContextBreakdown) => void;
  siblingCount?: number;
  siblingIndex?: number;
  onSwitchBranch?: (messageId: string, direction: 'prev' | 'next') => void;
}

function BranchNavigator({
  messageId,
  siblingCount,
  siblingIndex,
  onSwitchBranch,
}: {
  messageId: string;
  siblingCount: number;
  siblingIndex: number;
  onSwitchBranch: (messageId: string, direction: 'prev' | 'next') => void;
}) {
  if (siblingCount <= 1) return null;

  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 select-none">
      <button
        onClick={() => onSwitchBranch(messageId, 'prev')}
        disabled={siblingIndex <= 0}
        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
        aria-label="Previous branch"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="tabular-nums min-w-[2.5em] text-center">
        {siblingIndex + 1}/{siblingCount}
      </span>
      <button
        onClick={() => onSwitchBranch(messageId, 'next')}
        disabled={siblingIndex >= siblingCount - 1}
        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors"
        aria-label="Next branch"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </span>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image') {
    return (
      <div className="mt-2 rounded-lg overflow-hidden inline-block max-w-md">
        <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name}
          className="max-w-full h-auto max-h-96 object-contain"
        />
      </div>
    );
  }

  return (
    <div className="mt-2 inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 max-w-xs">
      <svg className="w-5 h-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <div className="min-w-0">
        <p className="text-sm truncate font-medium">{attachment.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  children,
  disabled
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function ChatMessage({
  message,
  artifacts,
  isLastAssistantMessage,
  isLoading,
  onEdit,
  onRegenerate,
  onSelectArtifact,
  onOpenContextInspector,
  siblingCount,
  siblingIndex,
  onSwitchBranch,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  return (
    <div className={`group py-6 ${isUser ? 'bg-[var(--background)]' : 'bg-[var(--assistant-bubble)]'}`}>
      <div className="max-w-3xl mx-auto px-4 flex gap-4">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${
            isUser ? 'bg-blue-600' : 'bg-green-600'
          }`}
        >
          {isUser ? 'U' : 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1 flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isUser ? 'You' : 'Assistant'}
              {siblingCount !== undefined && siblingIndex !== undefined && onSwitchBranch && (
                <BranchNavigator
                  messageId={message.id}
                  siblingCount={siblingCount}
                  siblingIndex={siblingIndex}
                  onSwitchBranch={onSwitchBranch}
                />
              )}
            </span>

            {/* Action buttons - show on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isUser && onEdit && !isEditing && (
                <ActionButton onClick={() => setIsEditing(true)} title="Edit message" disabled={isLoading}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </ActionButton>
              )}

              {!isUser && isLastAssistantMessage && onRegenerate && (
                <ActionButton onClick={onRegenerate} title="Regenerate response" disabled={isLoading}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </ActionButton>
              )}

              <ActionButton onClick={handleCopy} title={copied ? 'Copied!' : 'Copy message'}>
                {copied ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </ActionButton>
            </div>
          </div>

          <div className="text-[var(--foreground)]">
            {isUser ? (
              <>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full p-3 border border-[var(--border-color)] rounded-lg bg-[var(--background)] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={Math.min(10, editContent.split('\n').length + 1)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditSubmit}
                        disabled={!editContent.trim()}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save & Submit
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="px-3 py-1.5 text-sm border border-[var(--border-color)] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Enter to submit, Shift+Enter for new line, Escape to cancel
                    </p>
                  </div>
                ) : (
                  <>
                    {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <AttachmentPreview key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Use contentBlocks if available for proper interleaving (includes reasoning), otherwise fall back to legacy format */}
                {message.contentBlocks && message.contentBlocks.length > 0 ? (
                  <ContentBlocksRenderer
                    blocks={message.contentBlocks}
                    artifacts={artifacts}
                    onSelectArtifact={onSelectArtifact}
                  />
                ) : (
                  <>
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <ToolCallDisplay toolCalls={message.toolCalls} inline />
                    )}
                    {message.content && <MarkdownMessage content={message.content} />}
                  </>
                )}
              </>
            )}
          </div>
          {!isUser && message.usage && (
            <MessageUsageDisplay
              usage={message.usage}
              model={message.model}
              contextBreakdown={message.contextBreakdown}
              onOpenContextInspector={onOpenContextInspector}
            />
          )}
        </div>
      </div>
    </div>
  );
}
