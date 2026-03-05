#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SOURCE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/lib/litellm-chat-metadata.json');

const ALLOWED_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'gemini',
  'vertex_ai-language-models',
  'mistral',
  'cerebras',
]);

const PICKED_FIELDS = [
  'litellm_provider',
  'source',
  'max_input_tokens',
  'max_output_tokens',
  'max_tokens',
  'supports_vision',
  'supports_reasoning',
  'supports_function_calling',
  'supports_tool_choice',
  'supports_prompt_caching',
  'input_cost_per_token',
  'output_cost_per_token',
  'cache_read_input_token_cost',
  'cache_read_input_cost_per_token',
  'deprecation_date',
];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldKeepEntry(modelId, value) {
  if (modelId === 'sample_spec') return false;
  if (!isPlainObject(value)) return false;

  const provider = typeof value.litellm_provider === 'string' ? value.litellm_provider : '';
  if (!ALLOWED_PROVIDERS.has(provider)) return false;

  const mode = typeof value.mode === 'string' ? value.mode : 'chat';
  return mode === 'chat';
}

function pickFields(value) {
  const out = {};
  for (const field of PICKED_FIELDS) {
    const fieldValue = value[field];
    if (fieldValue !== null && fieldValue !== undefined) {
      out[field] = fieldValue;
    }
  }
  return out;
}

async function main() {
  const startedAt = Date.now();
  console.log(`[sync-litellm] Downloading source: ${SOURCE_URL}`);

  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'opus-sync-litellm-metadata/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status} ${response.statusText})`);
  }

  const sourceJson = await response.json();
  if (!isPlainObject(sourceJson)) {
    throw new Error('Unexpected source format: expected top-level object');
  }

  const filtered = {};
  const sortedModelIds = Object.keys(sourceJson).sort((a, b) => a.localeCompare(b));

  let kept = 0;
  for (const modelId of sortedModelIds) {
    const value = sourceJson[modelId];
    if (!shouldKeepEntry(modelId, value)) continue;
    filtered[modelId] = pickFields(value);
    kept += 1;
  }

  const content = `${JSON.stringify(filtered, null, 2)}\n`;
  await writeFile(OUTPUT_PATH, content, 'utf8');

  const elapsedMs = Date.now() - startedAt;
  console.log(`[sync-litellm] Wrote ${kept} models to ${OUTPUT_PATH}`);
  console.log(`[sync-litellm] Done in ${elapsedMs}ms`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sync-litellm] Error: ${message}`);
  process.exit(1);
});
