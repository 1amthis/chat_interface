import { NextRequest, NextResponse } from 'next/server.js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatSettings } from '../../../../types/index.ts';
import { validateCSRF } from '../../../../lib/mcp/server-config.ts';
import {
  TITLE_GENERATION_MAX_OUTPUT_TOKENS,
  getConversationTitleSource,
  sanitizeGeneratedConversationTitle,
} from '../../../../lib/conversation-title.ts';

export const dynamic = 'force-dynamic';

const TITLE_SYSTEM_PROMPT = [
  'You generate concise conversation titles.',
  'Return only the title.',
  'Use 2 to 6 words when possible.',
  'Do not use quotes.',
  'Do not add labels, numbering, or trailing punctuation.',
].join(' ');

function isOpenAIReasoningModel(model: string): boolean {
  return /^gpt-5(\b|[.-])/.test(model) || /^o[134]/.test(model) || model.includes('o1-') || model.includes('o3-') || model.includes('o4-');
}

function getApiKeyForSettings(settings: ChatSettings): string | undefined {
  switch (settings.provider) {
    case 'openai':
      return settings.openaiKey;
    case 'anthropic':
      return settings.anthropicKey;
    case 'google':
      return settings.googleKey;
    case 'mistral':
      return settings.mistralKey;
    case 'cerebras':
      return settings.cerebrasKey;
    default:
      return undefined;
  }
}

function buildTitleUserPrompt(userMessage: string): string {
  const source = getConversationTitleSource(userMessage);
  return `First user message:\n${source}`;
}

function extractOpenAIResponsesText(response: Record<string, unknown>): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: Array<Record<string, unknown>> }).content
      : [];

    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      if (typeof block.text === 'string' && block.text.trim()) {
        parts.push(block.text);
      }
    }
  }

  return parts.join(' ').trim();
}

async function generateOpenAITitle(settings: ChatSettings, userMessage: string): Promise<string> {
  if (!settings.openaiKey) {
    throw new Error('OpenAI API key is required');
  }

  const client = new OpenAI({ apiKey: settings.openaiKey });
  const prompt = buildTitleUserPrompt(userMessage);

  if (isOpenAIReasoningModel(settings.model)) {
    const responsesClient = client.responses as unknown as {
      create(options: Record<string, unknown>): Promise<Record<string, unknown>>;
    };

    const response = await responsesClient.create({
      model: settings.model,
      instructions: TITLE_SYSTEM_PROMPT,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      reasoning: {
        effort: 'minimal',
      },
      max_output_tokens: TITLE_GENERATION_MAX_OUTPUT_TOKENS,
    });

    return extractOpenAIResponsesText(response);
  }

  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [
      { role: 'system', content: TITLE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: TITLE_GENERATION_MAX_OUTPUT_TOKENS,
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

async function generateAnthropicTitle(settings: ChatSettings, userMessage: string): Promise<string> {
  if (!settings.anthropicKey) {
    throw new Error('Anthropic API key is required');
  }

  const client = new Anthropic({ apiKey: settings.anthropicKey });
  const response = await client.messages.create({
    model: settings.model,
    system: TITLE_SYSTEM_PROMPT,
    max_tokens: TITLE_GENERATION_MAX_OUTPUT_TOKENS,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: buildTitleUserPrompt(userMessage),
      },
    ],
  });

  return response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim();
}

async function generateGoogleTitle(settings: ChatSettings, userMessage: string): Promise<string> {
  if (!settings.googleKey) {
    throw new Error('Google Gemini API key is required');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.googleKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: TITLE_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: buildTitleUserPrompt(userMessage) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: TITLE_GENERATION_MAX_OUTPUT_TOKENS,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google Gemini API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join(' ')
    .trim();
}

async function generateOpenAICompatibleTitle(
  settings: ChatSettings,
  userMessage: string,
  baseURL: string,
  keyName: 'mistralKey' | 'cerebrasKey'
): Promise<string> {
  const apiKey = settings[keyName];
  if (!apiKey) {
    throw new Error(`${settings.provider} API key is required`);
  }

  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.chat.completions.create({
    model: settings.model,
    messages: [
      { role: 'system', content: TITLE_SYSTEM_PROMPT },
      { role: 'user', content: buildTitleUserPrompt(userMessage) },
    ],
    temperature: 0.2,
    max_tokens: TITLE_GENERATION_MAX_OUTPUT_TOKENS,
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

export async function generateConversationTitleWithProvider(
  settings: ChatSettings,
  userMessage: string
): Promise<string> {
  switch (settings.provider) {
    case 'openai':
      return generateOpenAITitle(settings, userMessage);
    case 'anthropic':
      return generateAnthropicTitle(settings, userMessage);
    case 'google':
      return generateGoogleTitle(settings, userMessage);
    case 'mistral':
      return generateOpenAICompatibleTitle(settings, userMessage, 'https://api.mistral.ai/v1', 'mistralKey');
    case 'cerebras':
      return generateOpenAICompatibleTitle(settings, userMessage, 'https://api.cerebras.ai/v1', 'cerebrasKey');
    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }
}

export async function handleTitleRequest(
  request: Request,
  deps: {
    generateConversationTitle: (settings: ChatSettings, userMessage: string) => Promise<string>;
  } = {
    generateConversationTitle: generateConversationTitleWithProvider,
  }
) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  try {
    const { settings, userMessage } = (await request.json()) as {
      settings?: ChatSettings;
      userMessage?: string;
    };

    if (!settings) {
      return NextResponse.json({ error: 'Settings are required' }, { status: 400 });
    }

    if (!userMessage || !userMessage.trim()) {
      return NextResponse.json({ error: 'User message is required' }, { status: 400 });
    }

    const apiKey = getApiKeyForSettings(settings);
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const rawTitle = await deps.generateConversationTitle(settings, userMessage);
    const title = sanitizeGeneratedConversationTitle(rawTitle);

    return NextResponse.json({ title });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Title generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleTitleRequest(request);
}
