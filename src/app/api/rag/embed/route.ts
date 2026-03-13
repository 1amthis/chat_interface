import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { validateCSRF } from '@/lib/mcp/server-config';

const SUPPORTED_EMBEDDING_MODELS = new Set([
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-ada-002',
]);
const MAX_TEXTS_PER_REQUEST = 20;
const MAX_TEXT_LENGTH = 50_000;
const MAX_TOTAL_TEXT_LENGTH = 200_000;

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { texts, openaiKey, model } = body as {
      texts: string[];
      openaiKey: string;
      model?: string;
    };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 });
    }
    if (texts.length > MAX_TEXTS_PER_REQUEST) {
      return NextResponse.json({ error: `A maximum of ${MAX_TEXTS_PER_REQUEST} texts is allowed per request` }, { status: 400 });
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 });
    }

    const invalidText = texts.find((text) => typeof text !== 'string' || text.length > MAX_TEXT_LENGTH);
    if (invalidText !== undefined) {
      return NextResponse.json({ error: `Each text must be a string with at most ${MAX_TEXT_LENGTH} characters` }, { status: 400 });
    }

    const totalTextLength = texts.reduce((sum, text) => sum + text.length, 0);
    if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
      return NextResponse.json({ error: `Total text length exceeds ${MAX_TOTAL_TEXT_LENGTH} characters` }, { status: 400 });
    }

    const embeddingModel = model || 'text-embedding-3-small';
    if (!SUPPORTED_EMBEDDING_MODELS.has(embeddingModel)) {
      return NextResponse.json({ error: `Unsupported embedding model: ${embeddingModel}` }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: openaiKey });

    const response = await client.embeddings.create({
      model: embeddingModel,
      input: texts,
    });

    const embeddings = response.data.map((d) => d.embedding);

    return NextResponse.json({ embeddings });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Embedding API error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
