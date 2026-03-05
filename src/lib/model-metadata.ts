/**
 * Model metadata registry — display names, capabilities, pricing, and helpers.
 */

import type { Provider } from '@/types';
import liteLLMChatMetadata from './litellm-chat-metadata.json';

export type ModelTier = 'flagship' | 'standard' | 'fast' | 'economy';

export interface ModelMetadata {
  displayName?: string;
  description?: string;
  contextWindow: number;
  maxOutputTokens?: number;
  tier: ModelTier;
  capabilities: {
    vision: boolean;
    toolUse: boolean;
    reasoning: boolean;
  };
  family?: string;
  pricing?: {
    inputPerMillion: number;
    outputPerMillion: number;
    cachedInputPerMillion?: number;
  };
  deprecationDate?: string;
}

interface LiteLLMChatModelMetadata {
  litellm_provider?: string;
  source?: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
  max_tokens?: number;
  supports_vision?: boolean;
  supports_reasoning?: boolean;
  supports_function_calling?: boolean;
  supports_tool_choice?: boolean;
  supports_prompt_caching?: boolean;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  cache_read_input_cost_per_token?: number;
  deprecation_date?: string;
}

const LITELLM_CHAT_METADATA = liteLLMChatMetadata as Record<string, LiteLLMChatModelMetadata>;
// Snapshot source:
// https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json

const KNOWN_PROVIDER_PREFIXES = ['openai/', 'anthropic/', 'gemini/', 'mistral/', 'cerebras/'] as const;

const PROVIDER_PREFIX_CANDIDATES: Record<Provider, readonly string[]> = {
  openai: [''],
  anthropic: [''],
  google: ['', 'gemini/'],
  mistral: ['', 'mistral/'],
  cerebras: ['', 'cerebras/'],
};

/**
 * Metadata for every model in DEFAULT_MODELS (types/index.ts).
 * Pricing values are approximate baselines — easy to update as providers adjust.
 */
export const MODEL_METADATA: Record<string, ModelMetadata> = {
  // ── OpenAI ──────────────────────────────────────────────
  'gpt-5.2': {
    displayName: 'GPT-5.2',
    description: 'Latest GPT-5 series model',
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'GPT-5',
    pricing: { inputPerMillion: 1.75, outputPerMillion: 14 },
  },
  'gpt-5.1': {
    displayName: 'GPT-5.1',
    description: 'High-performance GPT-5 variant',
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'GPT-5',
    pricing: { inputPerMillion: 1.25, outputPerMillion: 10 },
  },
  'gpt-5': {
    displayName: 'GPT-5',
    description: 'Capable OpenAI model with advanced reasoning',
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'GPT-5',
    pricing: { inputPerMillion: 1.25, outputPerMillion: 10 },
  },
  'gpt-5-mini': {
    displayName: 'GPT-5 Mini',
    description: 'Smaller, faster GPT-5 variant',
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
    tier: 'standard',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'GPT-5',
    pricing: { inputPerMillion: 0.25, outputPerMillion: 2 },
  },
  'gpt-5-nano': {
    displayName: 'GPT-5 Nano',
    description: 'Ultra-fast, cost-effective GPT-5 variant',
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
    tier: 'economy',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'GPT-5',
    pricing: { inputPerMillion: 0.05, outputPerMillion: 0.4 },
  },
  'o3': {
    displayName: 'o3',
    description: 'Advanced reasoning model',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'o-series',
    pricing: { inputPerMillion: 2, outputPerMillion: 8 },
  },
  'o3-mini': {
    displayName: 'o3-mini',
    description: 'Efficient reasoning model',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'standard',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'o-series',
    pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  },
  'o3-pro': {
    displayName: 'o3-pro',
    description: 'Highest-capability reasoning model',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'o-series',
    pricing: { inputPerMillion: 20, outputPerMillion: 80 },
  },
  'o4-mini': {
    displayName: 'o4-mini',
    description: 'Next-gen efficient reasoning model',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'standard',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'o-series',
    pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  },
  'gpt-4.1': {
    displayName: 'GPT-4.1',
    description: 'Long-context GPT-4 series model',
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    tier: 'standard',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'GPT-4.1',
    pricing: { inputPerMillion: 2, outputPerMillion: 8 },
  },
  'gpt-4.1-mini': {
    displayName: 'GPT-4.1 Mini',
    description: 'Fast long-context model',
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    tier: 'fast',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'GPT-4.1',
    pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  },
  'gpt-4.1-nano': {
    displayName: 'GPT-4.1 Nano',
    description: 'Ultra-affordable long-context model',
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    tier: 'economy',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'GPT-4.1',
    pricing: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  },

  // ── Anthropic ───────────────────────────────────────────
  'claude-opus-4-6': {
    displayName: 'Claude Opus 4.6',
    description: 'Most capable Anthropic model',
    contextWindow: 200_000,
    maxOutputTokens: 128_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Claude Opus',
    pricing: { inputPerMillion: 5, outputPerMillion: 25, cachedInputPerMillion: 0.5 },
  },
  'claude-sonnet-4-5': {
    displayName: 'Claude Sonnet 4.5',
    description: 'Balanced performance and cost',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'standard',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Claude Sonnet',
    pricing: { inputPerMillion: 3, outputPerMillion: 15, cachedInputPerMillion: 0.3 },
  },
  'claude-haiku-4-5': {
    displayName: 'Claude Haiku 4.5',
    description: 'Fast, affordable Claude model',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'fast',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'Claude Haiku',
    pricing: { inputPerMillion: 1, outputPerMillion: 5, cachedInputPerMillion: 0.1 },
  },
  'claude-opus-4-5': {
    displayName: 'Claude Opus 4.5',
    description: 'Previous-gen flagship Anthropic model',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Claude Opus',
    pricing: { inputPerMillion: 5, outputPerMillion: 25, cachedInputPerMillion: 0.5 },
  },

  // ── Google ──────────────────────────────────────────────
  'gemini-3-pro-preview': {
    displayName: 'Gemini 3 Pro',
    description: 'Next-gen Google flagship model (preview)',
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Gemini 3',
    pricing: { inputPerMillion: 2, outputPerMillion: 12 },
  },
  'gemini-3-flash-preview': {
    displayName: 'Gemini 3 Flash',
    description: 'Fast next-gen Google model (preview)',
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    tier: 'fast',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Gemini 3',
    pricing: { inputPerMillion: 0.5, outputPerMillion: 3 },
  },
  'gemini-2.5-pro': {
    displayName: 'Gemini 2.5 Pro',
    description: 'Powerful Google model with long context',
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    tier: 'flagship',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Gemini 2.5',
    pricing: { inputPerMillion: 1.25, outputPerMillion: 10 },
  },
  'gemini-2.5-flash': {
    displayName: 'Gemini 2.5 Flash',
    description: 'Fast and efficient with thinking support',
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    tier: 'fast',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Gemini 2.5',
    pricing: { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  },
  'gemini-2.5-flash-lite': {
    displayName: 'Gemini 2.5 Flash Lite',
    description: 'Lightest Gemini 2.5 variant',
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    tier: 'economy',
    capabilities: { vision: true, toolUse: true, reasoning: true },
    family: 'Gemini 2.5',
    pricing: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  },

  // ── Mistral ─────────────────────────────────────────────
  'mistral-medium-2508': {
    displayName: 'Mistral Medium',
    description: 'Balanced Mistral model',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'standard',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'Mistral',
    pricing: { inputPerMillion: 0.4, outputPerMillion: 2 },
  },
  'mistral-small-2506': {
    displayName: 'Mistral Small',
    description: 'Fast, affordable Mistral model',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'fast',
    capabilities: { vision: true, toolUse: true, reasoning: false },
    family: 'Mistral',
    pricing: { inputPerMillion: 0.1, outputPerMillion: 0.3 },
  },
  'magistral-medium-latest': {
    displayName: 'Magistral Medium',
    description: 'Reasoning-capable Mistral model',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'standard',
    capabilities: { vision: false, toolUse: true, reasoning: true },
    family: 'Magistral',
    pricing: { inputPerMillion: 0.4, outputPerMillion: 2 },
  },
  'magistral-small-latest': {
    displayName: 'Magistral Small',
    description: 'Fast reasoning Mistral model',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'fast',
    capabilities: { vision: false, toolUse: true, reasoning: true },
    family: 'Magistral',
    pricing: { inputPerMillion: 0.1, outputPerMillion: 0.3 },
  },
  'codestral-2508': {
    displayName: 'Codestral',
    description: 'Code-specialized Mistral model',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'standard',
    capabilities: { vision: false, toolUse: true, reasoning: false },
    family: 'Codestral',
    pricing: { inputPerMillion: 0.3, outputPerMillion: 0.9 },
  },

  // ── Cerebras ────────────────────────────────────────────
  'qwen-3-235b-a22b-instruct-2507': {
    displayName: 'Qwen 3 235B MoE',
    description: 'Large MoE Qwen model on Cerebras',
    contextWindow: 32_000,
    maxOutputTokens: 8_192,
    tier: 'flagship',
    capabilities: { vision: false, toolUse: true, reasoning: true },
    family: 'Qwen',
  },
  'gpt-oss-120b': {
    displayName: 'GPT-OSS 120B',
    description: 'Open-source GPT variant on Cerebras',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'flagship',
    capabilities: { vision: false, toolUse: true, reasoning: false },
    family: 'GPT-OSS',
  },
  'llama3.1-8b': {
    displayName: 'Llama 3.1 8B',
    description: 'Small Meta Llama on Cerebras inference',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'economy',
    capabilities: { vision: false, toolUse: false, reasoning: false },
    family: 'Llama',
  },
  'zai-glm-4.7': {
    displayName: 'ZAI GLM 4.7',
    description: 'GLM model on Cerebras inference',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    tier: 'standard',
    capabilities: { vision: false, toolUse: true, reasoning: false },
    family: 'GLM',
  },
};

const modelMetadataCache = new Map<string, ModelMetadata | null>();

function stripKnownProviderPrefix(modelId: string): string {
  for (const prefix of KNOWN_PROVIDER_PREFIXES) {
    if (modelId.startsWith(prefix)) {
      return modelId.slice(prefix.length);
    }
  }
  return modelId;
}

function buildLookupCandidates(modelId: string, provider?: Provider): string[] {
  const normalized = modelId.trim();
  const baseId = stripKnownProviderPrefix(normalized);
  const candidates = new Set<string>();

  const add = (value: string) => {
    const next = value.trim();
    if (!next) return;
    candidates.add(next);
  };

  add(normalized);
  add(baseId);

  if (provider) {
    for (const prefix of PROVIDER_PREFIX_CANDIDATES[provider]) {
      if (!prefix) {
        add(baseId);
      } else {
        add(`${prefix}${baseId}`);
      }
    }
  } else {
    for (const prefix of KNOWN_PROVIDER_PREFIXES) {
      add(`${prefix}${baseId}`);
    }
  }

  return Array.from(candidates);
}

function inferModelTier(modelId: string): ModelTier {
  const id = stripKnownProviderPrefix(modelId).toLowerCase();

  if (/(nano|lite|tiny|\b3b\b|\b8b\b)/.test(id)) return 'economy';
  if (/(mini|small|flash|haiku)/.test(id)) return 'fast';
  if (/(opus|pro|ultra|120b|70b|235b|a22b)/.test(id)) return 'flagship';
  return 'standard';
}

function inferModelFamily(modelId: string): string | undefined {
  const id = stripKnownProviderPrefix(modelId).toLowerCase();

  if (id.startsWith('gpt-5')) return 'GPT-5';
  if (id.startsWith('gpt-4.1')) return 'GPT-4.1';
  if (/^o[134]/.test(id)) return 'o-series';

  if (id.startsWith('claude-opus')) return 'Claude Opus';
  if (id.startsWith('claude-sonnet')) return 'Claude Sonnet';
  if (id.startsWith('claude-haiku')) return 'Claude Haiku';

  if (id.startsWith('gemini-')) {
    const match = id.match(/^gemini-\d+(?:\.\d+)?/);
    if (match) return `Gemini ${match[0].replace('gemini-', '')}`;
    return 'Gemini';
  }

  if (id.startsWith('mistral-')) return 'Mistral';
  if (id.startsWith('magistral-')) return 'Magistral';
  if (id.startsWith('codestral')) return 'Codestral';
  if (id.startsWith('qwen-')) return 'Qwen';
  if (id.startsWith('llama')) return 'Llama';
  if (id.startsWith('zai-glm')) return 'GLM';

  return undefined;
}

function buildFallbackMetadata(
  modelKey: string,
  entry: LiteLLMChatModelMetadata
): ModelMetadata | null {
  const contextWindow = entry.max_input_tokens ?? entry.max_tokens;
  if (!contextWindow) return null;

  const inputPerMillion = typeof entry.input_cost_per_token === 'number'
    ? entry.input_cost_per_token * 1_000_000
    : undefined;
  const outputPerMillion = typeof entry.output_cost_per_token === 'number'
    ? entry.output_cost_per_token * 1_000_000
    : undefined;
  const cachedPerToken = entry.cache_read_input_token_cost ?? entry.cache_read_input_cost_per_token;
  const cachedInputPerMillion = typeof cachedPerToken === 'number'
    ? cachedPerToken * 1_000_000
    : undefined;

  const baseModelId = stripKnownProviderPrefix(modelKey);

  return {
    displayName: baseModelId,
    contextWindow,
    maxOutputTokens: entry.max_output_tokens ?? entry.max_tokens,
    tier: inferModelTier(baseModelId),
    capabilities: {
      // Unknown capabilities default to permissive values to avoid false negatives in the UI.
      vision: entry.supports_vision ?? true,
      toolUse: entry.supports_function_calling ?? entry.supports_tool_choice ?? true,
      reasoning: entry.supports_reasoning ?? false,
    },
    family: inferModelFamily(baseModelId),
    pricing: inputPerMillion !== undefined && outputPerMillion !== undefined
      ? {
          inputPerMillion,
          outputPerMillion,
          ...(cachedInputPerMillion !== undefined ? { cachedInputPerMillion } : {}),
        }
      : undefined,
    deprecationDate: entry.deprecation_date,
  };
}

function resolveLiteLLMFallback(modelId: string, provider?: Provider): ModelMetadata | null {
  const candidates = buildLookupCandidates(modelId, provider);
  for (const candidate of candidates) {
    const entry = LITELLM_CHAT_METADATA[candidate];
    if (!entry) continue;
    const fallback = buildFallbackMetadata(candidate, entry);
    if (fallback) return fallback;
  }
  return null;
}

function mergeLocalAndFallbackMetadata(local: ModelMetadata, fallback: ModelMetadata): ModelMetadata {
  const pricing = local.pricing
    ? {
        ...local.pricing,
        ...(local.pricing.cachedInputPerMillion === undefined && fallback.pricing?.cachedInputPerMillion !== undefined
          ? { cachedInputPerMillion: fallback.pricing.cachedInputPerMillion }
          : {}),
      }
    : fallback.pricing;

  return {
    ...local,
    maxOutputTokens: local.maxOutputTokens ?? fallback.maxOutputTokens,
    pricing,
    deprecationDate: local.deprecationDate ?? fallback.deprecationDate,
  };
}

export function getModelMetadata(modelId: string, provider?: Provider): ModelMetadata | null {
  const normalizedId = modelId.trim();
  if (!normalizedId) return null;

  const cacheKey = `${provider ?? '*'}:${normalizedId}`;
  if (modelMetadataCache.has(cacheKey)) {
    return modelMetadataCache.get(cacheKey) ?? null;
  }

  const strippedId = stripKnownProviderPrefix(normalizedId);
  const local = MODEL_METADATA[normalizedId] ?? MODEL_METADATA[strippedId] ?? null;
  const fallback = resolveLiteLLMFallback(normalizedId, provider);

  const merged = local && fallback
    ? mergeLocalAndFallbackMetadata(local, fallback)
    : (local ?? fallback);

  modelMetadataCache.set(cacheKey, merged);
  return merged;
}

/**
 * Estimate cost in USD given token counts and model pricing.
 * Returns null if the model has no pricing data.
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number,
  provider?: Provider,
): number | null {
  const meta = getModelMetadata(modelId, provider);
  if (!meta?.pricing) return null;

  const { inputPerMillion, outputPerMillion, cachedInputPerMillion } = meta.pricing;

  // If there are cached tokens, those count at the cached rate and the rest at the input rate
  const effectiveInputTokens = cacheReadTokens
    ? Math.max(0, inputTokens - cacheReadTokens)
    : inputTokens;
  const cachedCost = cacheReadTokens && cachedInputPerMillion
    ? (cacheReadTokens / 1_000_000) * cachedInputPerMillion
    : 0;

  return (
    (effectiveInputTokens / 1_000_000) * inputPerMillion +
    (outputTokens / 1_000_000) * outputPerMillion +
    cachedCost
  );
}

/**
 * Tailwind classes for tier-based color coding.
 */
export function getTierColor(tier: ModelTier): string {
  switch (tier) {
    case 'flagship':
      return 'border-amber-400/60 bg-amber-50/30 dark:bg-amber-900/10';
    case 'standard':
      return 'border-blue-400/60 bg-blue-50/30 dark:bg-blue-900/10';
    case 'fast':
      return 'border-green-400/60 bg-green-50/30 dark:bg-green-900/10';
    case 'economy':
      return 'border-gray-400/60 bg-gray-50/30 dark:bg-gray-800/10';
  }
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${Number.isInteger(millions) ? millions : Number(millions.toFixed(1))}M`;
  }
  if (tokens >= 1_000) {
    const thousands = tokens / 1_000;
    return `${Number.isInteger(thousands) ? thousands : Number(thousands.toFixed(1))}K`;
  }
  return String(tokens);
}
