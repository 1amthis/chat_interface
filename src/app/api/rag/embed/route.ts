import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts, openaiKey } = body as {
      texts: string[];
      openaiKey: string;
    };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 });
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: openaiKey });

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
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
