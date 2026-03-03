/**
 * Anthropic content conversion utilities
 */

import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage } from '../types';

interface AnthropicContentOptions {
  cacheBreakpoint?: boolean;
}

const ANTHROPIC_EPHEMERAL_CACHE_CONTROL: Anthropic.CacheControlEphemeral = { type: 'ephemeral' };

/**
 * Convert message to Anthropic format with multimodal support
 */
export function toAnthropicContent(
  message: ChatMessage,
  options?: AnthropicContentOptions
): Anthropic.ContentBlockParam[] {
  const attachments = message.attachments || [];
  const projectFiles = message.projectFiles || [];
  const allAttachments = [...projectFiles, ...attachments];
  const imageAttachments = allAttachments.filter((a) => a.type === 'image');
  const fileAttachments = allAttachments.filter((a) => a.type === 'file');

  const parts: Anthropic.ContentBlockParam[] = [];

  // Add images first (Anthropic prefers images before text)
  for (const image of imageAttachments) {
    parts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image.data,
      },
    });
  }

  // Add file contents as text
  for (const file of fileAttachments) {
    try {
      const textContent = atob(file.data);
      parts.push({
        type: 'text',
        text: `[File: ${file.name}]\n${textContent}`,
      });
    } catch {
      parts.push({
        type: 'text',
        text: `[File: ${file.name}] (Unable to decode content)`,
      });
    }
  }

  // Add text content
  if (message.content) {
    parts.push({ type: 'text', text: message.content });
  }

  // If no parts, add empty text
  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' });
  }

  if (options?.cacheBreakpoint) {
    const lastIndex = parts.length - 1;
    const lastPart = parts[lastIndex];

    if (lastPart?.type === 'text') {
      parts[lastIndex] = {
        ...lastPart,
        cache_control: ANTHROPIC_EPHEMERAL_CACHE_CONTROL,
      } satisfies Anthropic.TextBlockParam;
    } else if (lastPart?.type === 'image') {
      parts[lastIndex] = {
        ...lastPart,
        cache_control: ANTHROPIC_EPHEMERAL_CACHE_CONTROL,
      } satisfies Anthropic.ImageBlockParam;
    }
  }

  return parts;
}
