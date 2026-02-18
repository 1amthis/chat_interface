/**
 * Vision capability detection and model suggestion utilities.
 */

import { Provider, DEFAULT_MODELS } from '@/types';
import { getModelMetadata } from '@/lib/model-metadata';

export interface VisionSuggestion {
  provider: Provider;
  model: string;
  displayName: string;
  isCrossProvider: boolean;
}

/**
 * Check whether a model supports vision (image inputs).
 * Unknown models (custom models not in metadata) default to true
 * to avoid false-positive "no vision" warnings.
 */
export function modelSupportsVision(model: string): boolean {
  const meta = getModelMetadata(model);
  if (!meta) return true; // assume vision for unknown models
  return meta.capabilities.vision;
}

/** Provider search priority for cross-provider suggestions. */
const PROVIDER_PRIORITY: Provider[] = ['openai', 'anthropic', 'google', 'mistral', 'cerebras'];

/**
 * Find the best vision-capable model to suggest when the current model
 * does not support images.
 *
 * 1. First searches same-provider models from `availableModels`.
 * 2. Falls back to cross-provider search using PROVIDER_PRIORITY.
 *
 * Returns `null` if the current model already supports vision or
 * no suitable alternative can be found.
 */
export function getVisionSuggestion(
  currentProvider: Provider,
  currentModel: string,
  availableModels: string[],
  customModels?: Partial<Record<Provider, string[]>>,
): VisionSuggestion | null {
  // If current model supports vision, no suggestion needed
  if (modelSupportsVision(currentModel)) return null;

  // 1. Try same-provider models
  for (const model of availableModels) {
    if (model === currentModel) continue;
    if (modelSupportsVision(model)) {
      const meta = getModelMetadata(model);
      return {
        provider: currentProvider,
        model,
        displayName: meta?.displayName || model,
        isCrossProvider: false,
      };
    }
  }

  // 2. Cross-provider fallback
  for (const provider of PROVIDER_PRIORITY) {
    if (provider === currentProvider) continue;
    const models = [
      ...DEFAULT_MODELS[provider],
      ...(customModels?.[provider] || []),
    ];
    for (const model of models) {
      if (modelSupportsVision(model)) {
        const meta = getModelMetadata(model);
        return {
          provider,
          model,
          displayName: meta?.displayName || model,
          isCrossProvider: true,
        };
      }
    }
  }

  return null;
}
