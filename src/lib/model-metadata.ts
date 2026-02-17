/**
 * Model metadata registry — display names, capabilities, pricing, and helpers.
 */

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
}

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

export function getModelMetadata(modelId: string): ModelMetadata | null {
  return MODEL_METADATA[modelId] ?? null;
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
): number | null {
  const meta = MODEL_METADATA[modelId];
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
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;
  return `${tokens / 1_000}K`;
}
