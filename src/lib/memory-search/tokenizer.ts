/**
 * Text tokenization utilities for BM25 search
 */

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they',
  'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'can', 'should', 'now', 'i', 'you', 'your', 'we', 'our',
  'my', 'me', 'him', 'her', 'them', 'their', 'would', 'could', 'do', 'does',
  'did', 'been', 'being', 'am', 'or', 'if', 'then', 'else', 'also', 'any',
]);

// Minimum term length after processing
const MIN_TERM_LENGTH = 2;

/**
 * Tokenize text into normalized terms
 * - Converts to lowercase
 * - Removes punctuation and special characters
 * - Splits on whitespace
 * - Filters short words and stop words
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .toLowerCase()
    // Replace common code/special characters with spaces
    .replace(/[`~!@#$%^&*()_+=\[\]{}|\\:";'<>?,./\n\r\t]/g, ' ')
    // Remove numbers that aren't part of words (keep alphanumeric)
    .replace(/\b\d+\b/g, ' ')
    // Split on whitespace
    .split(/\s+/)
    // Filter out short terms and stop words
    .filter(term =>
      term.length >= MIN_TERM_LENGTH &&
      !STOP_WORDS.has(term) &&
      // Ensure term contains at least one letter
      /[a-z]/.test(term)
    );
}

/**
 * Calculate term frequency map for a list of terms
 * Returns: { term: count }
 */
export function calculateTermFrequencies(terms: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const term of terms) {
    tf[term] = (tf[term] || 0) + 1;
  }
  return tf;
}

/**
 * Get unique terms from a term list
 */
export function getUniqueTerms(terms: string[]): string[] {
  return [...new Set(terms)];
}

/**
 * Extract text content from message, handling different content block types
 */
export function extractTextFromMessage(content: string, contentBlocks?: Array<{ type: string; text?: string }>): string {
  let fullText = content || '';

  // Also extract text from content blocks if present
  if (contentBlocks && Array.isArray(contentBlocks)) {
    for (const block of contentBlocks) {
      if (block.type === 'text' && block.text) {
        fullText += ' ' + block.text;
      }
    }
  }

  return fullText.trim();
}
