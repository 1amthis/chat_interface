/**
 * Text chunking for RAG document processing
 */

export type ChunkStrategy = 'paragraph' | 'fixed' | 'sentence' | 'markdown';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  strategy?: ChunkStrategy;
}

const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 200;

/**
 * Split text into chunks with overlap for better retrieval.
 * Dispatches to strategy-specific implementation.
 */
export function chunkText(text: string, options?: ChunkOptions): string[] {
  const strategy = options?.strategy ?? 'paragraph';
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const opts = { chunkSize, overlap };

  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }

  switch (strategy) {
    case 'fixed':
      return chunkFixed(text, opts);
    case 'sentence':
      return chunkSentence(text, opts);
    case 'markdown':
      return chunkMarkdown(text, opts);
    case 'paragraph':
    default:
      return chunkParagraph(text, opts);
  }
}

/**
 * Paragraph-based chunking: split on double newlines, accumulate paragraphs.
 */
function chunkParagraph(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  const { chunkSize, overlap } = opts;
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= chunkSize) {
      current += (current ? '\n\n' : '') + trimmed;
    } else {
      if (current) {
        chunks.push(current);
      }

      if (trimmed.length <= chunkSize) {
        const overlapText = getOverlapText(current, overlap);
        current = overlapText ? overlapText + '\n\n' + trimmed : trimmed;
      } else {
        // Paragraph is too long, split on sentence boundaries
        const sentences = splitSentences(trimmed);
        const overlapText = getOverlapText(current, overlap);
        current = overlapText || '';

        for (const sentence of sentences) {
          if (current.length + sentence.length + 1 <= chunkSize) {
            current += (current ? ' ' : '') + sentence;
          } else {
            if (current) {
              chunks.push(current);
            }
            if (sentence.length <= chunkSize) {
              const sentenceOverlap = getOverlapText(current, overlap);
              current = sentenceOverlap ? sentenceOverlap + ' ' + sentence : sentence;
            } else {
              // Sentence is too long, split on word boundaries
              const words = sentence.split(/\s+/);
              const wordOverlap = getOverlapText(current, overlap);
              current = wordOverlap || '';

              for (const word of words) {
                if (current.length + word.length + 1 <= chunkSize) {
                  current += (current ? ' ' : '') + word;
                } else {
                  if (current) {
                    chunks.push(current);
                  }
                  current = word;
                }
              }
            }
          }
        }
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

/**
 * Fixed-size chunking: sliding window with word-boundary snapping.
 */
function chunkFixed(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  const { chunkSize, overlap } = opts;
  const chunks: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    let end = Math.min(offset + chunkSize, text.length);

    // Snap to word boundary if not at end of text
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > offset) {
        end = lastSpace;
      }
    }

    const chunk = text.slice(offset, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Advance by chunkSize minus overlap, snapping to word boundary
    let nextOffset = end - overlap;
    if (nextOffset <= offset) {
      nextOffset = end; // Prevent infinite loop
    }
    // Snap next offset forward to word boundary
    if (nextOffset < text.length && text[nextOffset] !== ' ') {
      const nextSpace = text.indexOf(' ', nextOffset);
      if (nextSpace !== -1 && nextSpace < nextOffset + 50) {
        nextOffset = nextSpace + 1;
      }
    }
    offset = nextOffset;
  }

  return chunks.filter(Boolean);
}

/**
 * Sentence-based chunking: accumulate sentences until chunk size, overlap from previous.
 */
function chunkSentence(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  const { chunkSize, overlap } = opts;
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current = '';
  let prevChunk = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 <= chunkSize) {
      current += (current ? ' ' : '') + sentence;
    } else {
      if (current) {
        chunks.push(current);
        prevChunk = current;
      }
      // Start new chunk with overlap from previous
      const overlapText = getOverlapText(prevChunk, overlap);
      current = overlapText ? overlapText + ' ' + sentence : sentence;

      // If a single sentence exceeds chunk size, push it as its own chunk
      if (current.length > chunkSize && sentence.length > chunkSize) {
        chunks.push(current);
        prevChunk = current;
        current = '';
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

/**
 * Markdown-heading chunking: split on headings, keep heading+section together.
 * Oversized sections are sub-split via paragraph chunking.
 */
function chunkMarkdown(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  // Split on markdown headings (# through ######)
  const headingPattern = /^(#{1,6}\s.+)$/gm;
  const sections: string[] = [];
  let lastIndex = 0;

  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    // Push content before this heading
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) {
        // Append to previous section if it exists, otherwise create new
        if (sections.length > 0) {
          sections[sections.length - 1] += '\n\n' + before;
        } else {
          sections.push(before);
        }
      }
    }
    // Start a new section with the heading
    sections.push(match[1]);
    lastIndex = match.index + match[0].length;
  }

  // Remaining content after last heading
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      if (sections.length > 0) {
        sections[sections.length - 1] += '\n\n' + remaining;
      } else {
        sections.push(remaining);
      }
    }
  }

  // Now merge small sections and sub-split oversized ones
  const chunks: string[] = [];
  let current = '';

  for (const section of sections) {
    if (current.length + section.length + 2 <= opts.chunkSize) {
      current += (current ? '\n\n' : '') + section;
    } else {
      if (current) {
        chunks.push(current);
      }
      if (section.length <= opts.chunkSize) {
        current = section;
      } else {
        // Sub-split oversized section via paragraph chunking
        const subChunks = chunkParagraph(section, opts);
        chunks.push(...subChunks.slice(0, -1));
        current = subChunks[subChunks.length - 1] || '';
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

/**
 * Get overlap text from the end of a chunk
 */
function getOverlapText(text: string, overlap: number): string {
  if (!text || overlap <= 0) return '';
  if (text.length <= overlap) return text;
  return text.slice(-overlap).replace(/^\S*\s/, ''); // Start at word boundary
}

/**
 * Split text into sentences
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
