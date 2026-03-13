import type { Conversation, ConversationTitleState, Message } from '../types/index.ts';

export const DEFAULT_PENDING_CONVERSATION_TITLE = 'New conversation';
export const MAX_FALLBACK_TITLE_LENGTH = 30;
export const MAX_GENERATED_TITLE_LENGTH = 60;
export const MAX_TITLE_SOURCE_CHARS = 1200;
export const TITLE_GENERATION_MAX_OUTPUT_TOKENS = 24;

const GENERIC_CONVERSATION_TITLES = new Set([
  'new conversation',
  'new chat',
  'untitled',
  'question',
  'help',
  'chat',
  'conversation',
  'title',
  'assistant',
  'ai assistant',
  'summary',
]);

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength).trim();
  const lastSpace = truncated.lastIndexOf(' ');
  const base = lastSpace >= Math.max(8, Math.floor(maxLength * 0.5))
    ? truncated.slice(0, lastSpace).trim()
    : truncated;

  return `${base}...`;
}

function normalizeTitleForComparison(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['"`“”‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return DEFAULT_PENDING_CONVERSATION_TITLE;
  }

  return truncateAtWordBoundary(cleaned, MAX_FALLBACK_TITLE_LENGTH);
}

export function sanitizeGeneratedConversationTitle(rawTitle: string): string {
  const firstLine = rawTitle.replace(/\r/g, '\n').split('\n')[0] || '';

  const cleaned = firstLine
    .replace(/^\s*(title|conversation title)\s*[:\-]\s*/i, '')
    .replace(/^[\s"'`“”‘’*_#-]+/, '')
    .replace(/[\s"'`“”‘’*_#]+$/, '')
    .replace(/[.!?;:,…]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  return truncateAtWordBoundary(cleaned, MAX_GENERATED_TITLE_LENGTH).trim();
}

export function isGenericConversationTitle(title: string): boolean {
  if (!title.trim()) {
    return true;
  }

  return GENERIC_CONVERSATION_TITLES.has(normalizeTitleForComparison(title));
}

export function isAcceptableGeneratedConversationTitle(title: string): boolean {
  if (!title.trim()) {
    return false;
  }

  if (title.length < 3) {
    return false;
  }

  return !isGenericConversationTitle(title);
}

export function resolveGeneratedConversationTitle(
  rawTitle: string,
  userMessage: string
): { title: string; titleState: Extract<ConversationTitleState, 'auto' | 'fallback'> } {
  const sanitized = sanitizeGeneratedConversationTitle(rawTitle);

  if (isAcceptableGeneratedConversationTitle(sanitized)) {
    return {
      title: sanitized,
      titleState: 'auto',
    };
  }

  return {
    title: generateTitle(userMessage),
    titleState: 'fallback',
  };
}

export function getConversationTitleSource(message: string): string {
  return message.trim().slice(0, MAX_TITLE_SOURCE_CHARS);
}

export function getFirstUserMessage(conversation: Conversation): Message | undefined {
  return conversation.messages.find((message) => message.role === 'user' && !!message.content.trim());
}

export function shouldAutoGenerateConversationTitle(conversation: Conversation): boolean {
  if (conversation.titleState !== 'pending') {
    return false;
  }

  const hasUser = conversation.messages.some((message) => message.role === 'user' && !!message.content.trim());
  const hasAssistant = conversation.messages.some((message) => message.role === 'assistant' && !!message.content.trim());

  return hasUser && hasAssistant;
}
