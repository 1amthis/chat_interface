/**
 * Text chunking for RAG document processing.
 *
 * Chunk size and overlap are expressed in approximate tokens.
 */

export type ChunkStrategy = 'paragraph' | 'fixed' | 'sentence' | 'markdown';

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  strategy?: ChunkStrategy;
}

export const MIN_CHUNK_SIZE_TOKENS = 128;
export const MAX_CHUNK_SIZE_TOKENS = 3000;
export const DEFAULT_CHUNK_SIZE_TOKENS = 800;

export const MIN_OVERLAP_TOKENS = 0;
export const MAX_OVERLAP_TOKENS = 600;
export const DEFAULT_OVERLAP_TOKENS = 120;

// Previous versions stored chunk settings as characters; convert heuristically.
const LEGACY_CHAR_TO_TOKEN_RATIO = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(value);
}

function isLegacyCharacterSize(rawChunkSize: number): boolean {
  return rawChunkSize > MAX_CHUNK_SIZE_TOKENS;
}

export function normalizeChunkSizeSetting(rawChunkSize?: number): number {
  const raw = toInt(rawChunkSize, DEFAULT_CHUNK_SIZE_TOKENS);
  const normalized = isLegacyCharacterSize(raw)
    ? Math.round(raw / LEGACY_CHAR_TO_TOKEN_RATIO)
    : raw;

  return clamp(normalized, MIN_CHUNK_SIZE_TOKENS, MAX_CHUNK_SIZE_TOKENS);
}

export function normalizeChunkOverlapSetting(
  rawOverlap: number | undefined,
  chunkSizeTokens: number,
  rawChunkSize?: number
): number {
  const raw = toInt(rawOverlap, DEFAULT_OVERLAP_TOKENS);
  const converted = rawChunkSize !== undefined && isLegacyCharacterSize(rawChunkSize)
    ? Math.round(raw / LEGACY_CHAR_TO_TOKEN_RATIO)
    : raw;

  const maxAllowed = Math.min(MAX_OVERLAP_TOKENS, Math.max(MIN_OVERLAP_TOKENS, chunkSizeTokens - 1));
  return clamp(converted, MIN_OVERLAP_TOKENS, maxAllowed);
}

/**
 * Approximate token count using a lightweight heuristic suitable for browser-side chunking.
 */
function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

/**
 * Split text into chunks with overlap for better retrieval.
 * Dispatches to strategy-specific implementation.
 */
export function chunkText(text: string, options?: ChunkOptions): string[] {
  const strategy = options?.strategy ?? 'paragraph';
  const chunkSize = normalizeChunkSizeSetting(options?.chunkSize);
  const overlap = normalizeChunkOverlapSetting(options?.overlap, chunkSize, options?.chunkSize);
  const opts = { chunkSize, overlap };

  if (estimateTokens(text) <= chunkSize) {
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
  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (estimateTokens(candidate) <= opts.chunkSize) {
      current = candidate;
      continue;
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    const overlapText = getOverlapTextByTokens(current, opts.overlap);

    if (estimateTokens(paragraph) <= opts.chunkSize) {
      const withOverlap = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;
      current = estimateTokens(withOverlap) <= opts.chunkSize ? withOverlap : paragraph;
      continue;
    }

    // Oversized paragraph: fall back to sentence chunking.
    const sentenceChunks = chunkSentence(paragraph, opts);

    if (sentenceChunks.length === 0) {
      current = '';
      continue;
    }

    if (overlapText) {
      const mergedFirstChunk = `${overlapText} ${sentenceChunks[0]}`.trim();
      if (estimateTokens(mergedFirstChunk) <= opts.chunkSize) {
        sentenceChunks[0] = mergedFirstChunk;
      }
    }

    chunks.push(...sentenceChunks.slice(0, -1));
    current = sentenceChunks[sentenceChunks.length - 1] || '';
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Fixed-size chunking: sliding window over word units under token budget.
 */
function chunkFixed(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  const units = splitUnits(text);
  if (units.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < units.length) {
    let end = start;
    let tokenCount = 0;

    while (end < units.length) {
      const candidateTokens = tokenCount + estimateTokens(units[end]);
      if (candidateTokens > opts.chunkSize && end > start) {
        break;
      }
      tokenCount = candidateTokens;
      end += 1;
      if (tokenCount >= opts.chunkSize) {
        break;
      }
    }

    if (end <= start) {
      end = start + 1;
    }

    const chunk = units.slice(start, end).join(' ').trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= units.length) {
      break;
    }

    // Move start back to keep overlap tokens.
    let nextStart = end;
    let overlapTokens = 0;
    while (nextStart > start) {
      const unitTokens = estimateTokens(units[nextStart - 1]);
      if (overlapTokens + unitTokens > opts.overlap) {
        break;
      }
      overlapTokens += unitTokens;
      nextStart -= 1;
    }

    start = nextStart <= start ? start + 1 : nextStart;
  }

  return chunks;
}

/**
 * Sentence-based chunking: accumulate sentences until token budget, overlap from previous.
 */
function chunkSentence(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return chunkFixed(text, opts);
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (estimateTokens(sentence) > opts.chunkSize) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }

      const oversizedSentenceChunks = chunkFixed(sentence, opts);
      chunks.push(...oversizedSentenceChunks.slice(0, -1));
      current = oversizedSentenceChunks[oversizedSentenceChunks.length - 1] || '';
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;

    if (estimateTokens(candidate) <= opts.chunkSize) {
      current = candidate;
      continue;
    }

    const overlapText = getOverlapTextByTokens(current, opts.overlap);

    if (current.trim()) {
      chunks.push(current.trim());
    }

    const withOverlap = overlapText ? `${overlapText} ${sentence}` : sentence;
    current = estimateTokens(withOverlap) <= opts.chunkSize ? withOverlap : sentence;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Markdown-heading chunking: split on headings, keep heading+section together.
 * Oversized sections are sub-split via paragraph chunking.
 */
function chunkMarkdown(text: string, opts: { chunkSize: number; overlap: number }): string[] {
  const sections = splitMarkdownSections(text);
  const chunks: string[] = [];
  let current = '';

  for (const section of sections) {
    const candidate = current ? `${current}\n\n${section}` : section;

    if (estimateTokens(candidate) <= opts.chunkSize) {
      current = candidate;
      continue;
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    const overlapText = getOverlapTextByTokens(current, opts.overlap);

    if (estimateTokens(section) <= opts.chunkSize) {
      const withOverlap = overlapText ? `${overlapText}\n\n${section}` : section;
      current = estimateTokens(withOverlap) <= opts.chunkSize ? withOverlap : section;
      continue;
    }

    const subChunks = chunkParagraph(section, opts);
    chunks.push(...subChunks.slice(0, -1));
    current = subChunks[subChunks.length - 1] || '';
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function splitMarkdownSections(text: string): string[] {
  const headingPattern = /^(#{1,6}\s.+)$/gm;
  const sections: string[] = [];
  let lastIndex = 0;

  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) {
        if (sections.length > 0) {
          sections[sections.length - 1] += `\n\n${before}`;
        } else {
          sections.push(before);
        }
      }
    }

    sections.push(match[1]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      if (sections.length > 0) {
        sections[sections.length - 1] += `\n\n${remaining}`;
      } else {
        sections.push(remaining);
      }
    }
  }

  return sections.filter(Boolean);
}

/**
 * Keep trailing context up to target overlap tokens.
 */
function getOverlapTextByTokens(text: string, overlapTokens: number): string {
  if (!text || overlapTokens <= 0) {
    return '';
  }

  const units = splitUnits(text);
  if (units.length === 0) {
    return '';
  }

  const selected: string[] = [];
  let tokens = 0;

  for (let i = units.length - 1; i >= 0; i -= 1) {
    const t = estimateTokens(units[i]);
    if (tokens + t > overlapTokens && selected.length > 0) {
      break;
    }
    selected.push(units[i]);
    tokens += t;
    if (tokens >= overlapTokens) {
      break;
    }
  }

  return selected.reverse().join(' ').trim();
}

function splitUnits(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Split text into sentence-like segments.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
