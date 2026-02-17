import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Provider } from '@/types';

export const dynamic = 'force-dynamic';

interface ModelInfo {
  id: string;
  name?: string;
  created?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = (await request.json()) as {
      provider: Provider;
      apiKey: string;
    };

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    let models: ModelInfo[] = [];

    if (provider === 'openai') {
      const client = new OpenAI({ apiKey });
      const list = await client.models.list();
      const allModels: OpenAI.Model[] = [];
      for await (const model of list) {
        allModels.push(model);
      }
      models = allModels
        .filter((m) => /^(gpt-|o[134]|chatgpt-|ft:gpt-)/.test(m.id) && !m.id.includes('instruct'))
        .map((m) => ({ id: m.id, created: m.created }));
    } else if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      const list = await client.models.list({ limit: 100 });
      models = list.data.map((m) => ({
        id: m.id,
        name: (m as unknown as Record<string, string>).display_name || m.id,
        created: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : undefined,
      }));
    } else if (provider === 'google') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${apiKey}`
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Google API error: ${response.status} ${errorText}`);
      }
      const data = (await response.json()) as {
        models: Array<{
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      models = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({
          id: m.name.replace(/^models\//, ''),
          name: m.displayName,
        }));
    } else if (provider === 'mistral') {
      const client = new OpenAI({ apiKey, baseURL: 'https://api.mistral.ai/v1' });
      const list = await client.models.list();
      const allModels: OpenAI.Model[] = [];
      for await (const model of list) {
        allModels.push(model);
      }
      models = allModels.map((m) => ({ id: m.id, created: m.created }));
    } else if (provider === 'cerebras') {
      const client = new OpenAI({ apiKey, baseURL: 'https://api.cerebras.ai/v1' });
      const list = await client.models.list();
      const allModels: OpenAI.Model[] = [];
      for await (const model of list) {
        allModels.push(model);
      }
      models = allModels.map((m) => ({ id: m.id, created: m.created }));
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    // Sort: created desc (if available), then alphabetically
    models.sort((a, b) => {
      if (a.created && b.created) return b.created - a.created;
      if (a.created) return -1;
      if (b.created) return 1;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
