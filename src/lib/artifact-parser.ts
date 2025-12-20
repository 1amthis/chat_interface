import { ArtifactType } from '@/types';

export interface ParsedArtifact {
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  startIndex: number;
  endIndex: number;
}

export interface TextSegment {
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface ParseResult {
  textSegments: TextSegment[];
  artifacts: ParsedArtifact[];
}

export interface ArtifactMeta {
  type: ArtifactType;
  title: string;
  language?: string;
}

// Regex to match artifact opening tag with attributes
const ARTIFACT_OPEN_REGEX = /<artifact\s+([^>]*)>/gi;
const ARTIFACT_CLOSE_REGEX = /<\/artifact>/gi;

// Parse attributes from the opening tag
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)=["']([^"']*)["']/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

// Validate artifact type
function isValidArtifactType(type: string): type is ArtifactType {
  return ['code', 'html', 'react', 'markdown', 'svg', 'mermaid'].includes(type);
}

// Extract artifact metadata from opening tag
export function extractArtifactMeta(tagContent: string): ArtifactMeta | null {
  const attrs = parseAttributes(tagContent);

  if (!attrs.type || !isValidArtifactType(attrs.type)) {
    return null;
  }

  if (!attrs.title) {
    return null;
  }

  return {
    type: attrs.type as ArtifactType,
    title: attrs.title,
    language: attrs.language,
  };
}

// Check if text contains a potential artifact start marker
export function containsArtifactStart(text: string): boolean {
  return /<artifact\s+/i.test(text);
}

// Check if text contains potential artifact end marker
export function containsArtifactEnd(text: string): boolean {
  return /<\/artifact>/i.test(text);
}

// Check if we're inside an incomplete artifact tag (for streaming)
export function hasIncompleteArtifactTag(text: string): {
  hasIncomplete: boolean;
  incompleteStart: number;
} {
  // Look for < that might be start of <artifact or </artifact
  const lastLt = text.lastIndexOf('<');
  if (lastLt === -1) {
    return { hasIncomplete: false, incompleteStart: -1 };
  }

  const afterLt = text.slice(lastLt);

  // Check if it's a complete tag
  if (afterLt.includes('>')) {
    return { hasIncomplete: false, incompleteStart: -1 };
  }

  // Check if it could be the start of an artifact tag
  if (/^<\/?a?r?t?i?f?a?c?t?\s*/i.test(afterLt)) {
    return { hasIncomplete: true, incompleteStart: lastLt };
  }

  return { hasIncomplete: false, incompleteStart: -1 };
}

// Parse complete content for artifacts
export function parseArtifacts(content: string): ParseResult {
  const result: ParseResult = {
    textSegments: [],
    artifacts: [],
  };

  let lastIndex = 0;
  let currentIndex = 0;

  while (currentIndex < content.length) {
    // Find next artifact opening tag
    ARTIFACT_OPEN_REGEX.lastIndex = currentIndex;
    const openMatch = ARTIFACT_OPEN_REGEX.exec(content);

    if (!openMatch) {
      // No more artifacts, add remaining text
      if (lastIndex < content.length) {
        const remainingText = content.slice(lastIndex);
        if (remainingText.trim()) {
          result.textSegments.push({
            text: remainingText,
            startIndex: lastIndex,
            endIndex: content.length,
          });
        }
      }
      break;
    }

    // Add text before this artifact
    if (openMatch.index > lastIndex) {
      const textBefore = content.slice(lastIndex, openMatch.index);
      if (textBefore.trim()) {
        result.textSegments.push({
          text: textBefore,
          startIndex: lastIndex,
          endIndex: openMatch.index,
        });
      }
    }

    // Parse artifact metadata
    const meta = extractArtifactMeta(openMatch[1]);
    if (!meta) {
      // Invalid artifact tag, treat as text and continue
      currentIndex = openMatch.index + openMatch[0].length;
      lastIndex = openMatch.index;
      continue;
    }

    // Find closing tag
    const contentStart = openMatch.index + openMatch[0].length;
    ARTIFACT_CLOSE_REGEX.lastIndex = contentStart;
    const closeMatch = ARTIFACT_CLOSE_REGEX.exec(content);

    if (!closeMatch) {
      // No closing tag found, treat rest as incomplete
      // Add opening tag as text
      currentIndex = contentStart;
      lastIndex = openMatch.index;
      continue;
    }

    // Extract artifact content
    const artifactContent = content.slice(contentStart, closeMatch.index);

    result.artifacts.push({
      type: meta.type,
      title: meta.title,
      content: artifactContent.trim(),
      language: meta.language,
      startIndex: openMatch.index,
      endIndex: closeMatch.index + closeMatch[0].length,
    });

    lastIndex = closeMatch.index + closeMatch[0].length;
    currentIndex = lastIndex;
  }

  return result;
}

// For streaming: extract artifact from accumulated content
export interface StreamingArtifactState {
  isInArtifact: boolean;
  meta: ArtifactMeta | null;
  contentBuffer: string;
  textBeforeArtifact: string;
}

export function createStreamingState(): StreamingArtifactState {
  return {
    isInArtifact: false,
    meta: null,
    contentBuffer: '',
    textBeforeArtifact: '',
  };
}

export interface StreamingParseResult {
  // Text to display (not part of artifact)
  displayText: string;
  // Completed artifact if any
  completedArtifact: ParsedArtifact | null;
  // Updated state
  state: StreamingArtifactState;
  // Whether we're waiting for more content (incomplete tag)
  isBuffering: boolean;
}

// Process a chunk of streaming content
export function processStreamingChunk(
  chunk: string,
  state: StreamingArtifactState
): StreamingParseResult {
  const combined = state.isInArtifact
    ? state.contentBuffer + chunk
    : state.textBeforeArtifact + chunk;

  if (state.isInArtifact) {
    // We're inside an artifact, look for closing tag
    if (containsArtifactEnd(combined)) {
      const closeMatch = /<\/artifact>/i.exec(combined);
      if (closeMatch) {
        const artifactContent = combined.slice(0, closeMatch.index);
        const afterArtifact = combined.slice(closeMatch.index + closeMatch[0].length);

        return {
          displayText: afterArtifact,
          completedArtifact: {
            type: state.meta!.type,
            title: state.meta!.title,
            content: artifactContent.trim(),
            language: state.meta!.language,
            startIndex: 0,
            endIndex: 0,
          },
          state: {
            isInArtifact: false,
            meta: null,
            contentBuffer: '',
            textBeforeArtifact: afterArtifact,
          },
          isBuffering: false,
        };
      }
    }

    // Still inside artifact, buffer content
    return {
      displayText: '',
      completedArtifact: null,
      state: {
        ...state,
        contentBuffer: combined,
      },
      isBuffering: true,
    };
  }

  // Not in artifact, look for opening tag
  if (containsArtifactStart(combined)) {
    ARTIFACT_OPEN_REGEX.lastIndex = 0;
    const openMatch = ARTIFACT_OPEN_REGEX.exec(combined);

    if (openMatch) {
      const meta = extractArtifactMeta(openMatch[1]);
      if (meta) {
        const textBefore = combined.slice(0, openMatch.index);
        const afterOpen = combined.slice(openMatch.index + openMatch[0].length);

        // Check if there's also a closing tag in the same chunk
        if (containsArtifactEnd(afterOpen)) {
          const closeMatch = /<\/artifact>/i.exec(afterOpen);
          if (closeMatch) {
            const artifactContent = afterOpen.slice(0, closeMatch.index);
            const afterClose = afterOpen.slice(closeMatch.index + '</artifact>'.length);

            return {
              displayText: textBefore,
              completedArtifact: {
                type: meta.type,
                title: meta.title,
                content: artifactContent.trim(),
                language: meta.language,
                startIndex: 0,
                endIndex: 0,
              },
              state: {
                isInArtifact: false,
                meta: null,
                contentBuffer: '',
                textBeforeArtifact: afterClose,
              },
              isBuffering: false,
            };
          }
        }

        // Started artifact but no closing tag yet
        return {
          displayText: textBefore,
          completedArtifact: null,
          state: {
            isInArtifact: true,
            meta,
            contentBuffer: afterOpen,
            textBeforeArtifact: '',
          },
          isBuffering: true,
        };
      }
    }
  }

  // Check for incomplete tag at end
  const { hasIncomplete, incompleteStart } = hasIncompleteArtifactTag(combined);
  if (hasIncomplete) {
    return {
      displayText: combined.slice(0, incompleteStart),
      completedArtifact: null,
      state: {
        ...state,
        textBeforeArtifact: combined.slice(incompleteStart),
      },
      isBuffering: true,
    };
  }

  // Regular text
  return {
    displayText: combined,
    completedArtifact: null,
    state: {
      isInArtifact: false,
      meta: null,
      contentBuffer: '',
      textBeforeArtifact: '',
    },
    isBuffering: false,
  };
}
