/**
 * OpenAI embeddings via server route
 */

const BATCH_SIZE = 20;

/**
 * Embed multiple texts via the server route
 */
export async function embedTexts(
  texts: string[],
  openaiKey: string
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch('/api/rag/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch, openaiKey }),
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
  openaiKey: string
): Promise<number[]> {
  const embeddings = await embedTexts([query], openaiKey);
  return embeddings[0];
}
