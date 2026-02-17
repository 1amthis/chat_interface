import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Provider } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = (await request.json()) as {
      provider: Provider;
      apiKey: string;
    };

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: 'API key is required' });
    }

    if (provider === 'openai') {
      const client = new OpenAI({ apiKey });
      const list = await client.models.list();
      // Iterate once to verify the key works, then break
      for await (const _model of list) {
        break;
      }
    } else if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      await client.models.list({ limit: 1 });
    } else if (provider === 'google') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${apiKey}`
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Google API error: ${response.status} ${errorText}`);
      }
    } else if (provider === 'mistral') {
      const client = new OpenAI({ apiKey, baseURL: 'https://api.mistral.ai/v1' });
      const list = await client.models.list();
      for await (const _model of list) {
        break;
      }
    } else if (provider === 'cerebras') {
      const client = new OpenAI({ apiKey, baseURL: 'https://api.cerebras.ai/v1' });
      const list = await client.models.list();
      for await (const _model of list) {
        break;
      }
    } else {
      return NextResponse.json({ valid: false, error: `Unsupported provider: ${provider}` });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return NextResponse.json({ valid: false, error: message });
  }
}
