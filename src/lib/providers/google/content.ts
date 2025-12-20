/**
 * Google Gemini content conversion utilities
 */

import { ChatMessage } from '../types';

/**
 * Convert message to Gemini parts with multimodal support
 */
export function toGeminiParts(message: ChatMessage): Array<Record<string, unknown>> {
  const attachments = message.attachments || [];
  const projectFiles = message.projectFiles || [];
  const allAttachments = [...projectFiles, ...attachments];
  const imageAttachments = allAttachments.filter((a) => a.type === 'image');
  const fileAttachments = allAttachments.filter((a) => a.type === 'file');

  const parts: Array<Record<string, unknown>> = [];

  // Add images first
  for (const image of imageAttachments) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data,
      },
    });
  }

  // Add file contents as text
  for (const file of fileAttachments) {
    try {
      const textContent = atob(file.data);
      parts.push({
        text: `[File: ${file.name}]\n${textContent}`,
      });
    } catch {
      parts.push({
        text: `[File: ${file.name}] (Unable to decode content)`,
      });
    }
  }

  if (message.content) {
    parts.push({ text: message.content });
  }

  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return parts;
}
