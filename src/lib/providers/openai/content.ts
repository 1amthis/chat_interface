/**
 * OpenAI content conversion utilities
 */

import OpenAI from 'openai';
import { ChatMessage } from '../types';

/**
 * Convert message to OpenAI format with multimodal support
 */
export function toOpenAIContent(message: ChatMessage): OpenAI.ChatCompletionContentPart[] | string {
  const attachments = message.attachments || [];
  const projectFiles = message.projectFiles || [];
  const allAttachments = [...projectFiles, ...attachments];
  const imageAttachments = allAttachments.filter((a) => a.type === 'image');
  const fileAttachments = allAttachments.filter((a) => a.type === 'file');

  // If no attachments, return simple string
  if (allAttachments.length === 0) {
    return message.content;
  }

  const parts: OpenAI.ChatCompletionContentPart[] = [];

  // Add text content if present
  if (message.content) {
    parts.push({ type: 'text', text: message.content });
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

  // Add images
  for (const image of imageAttachments) {
    parts.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.data}`,
      },
    });
  }

  return parts;
}
