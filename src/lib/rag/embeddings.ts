/**
 * OpenAI embeddings via server route
 */

const BATCH_SIZE = 20;

export const EMBEDDING_MODEL_OPTIONS = [
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small', dimensions: 1536 },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large', dimensions: 3072 },
  { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002', dimensions: 1536 },
] as const;

export type EmbeddingModel = typeof EMBEDDING_MODEL_OPTIONS[number]['value'];

export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = 'text-embedding-3-small';

/**
 * Embed multiple texts via the server route
 */
export async function embedTexts(
  texts: string[],
  openaiKey: string,
  model: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch('/api/rag/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch, openaiKey, model }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Embedding failed: ${response.status}`);
    }

    const data = await response.json();
    allEmbeddings.push(...data.embeddings);
  }

  return allEmbeddings;
}

/**
 * Embed a single query text
 */
export async function embedQuery(
  query: string,
  openaiKey: string,
  model: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<number[]> {
  const embeddings = await embedTexts([query], openaiKey, model);
  return embeddings[0];
}
