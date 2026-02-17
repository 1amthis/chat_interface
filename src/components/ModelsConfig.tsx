'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChatSettings, Provider, DEFAULT_MODELS, ApiKeyValidationStatus } from '@/types';
import { getModelMetadata, getTierColor, formatContextWindow, calculateCost, ModelMetadata } from '@/lib/model-metadata';
import { getUsageRecords, getAggregatedUsage, clearUsageRecords, AggregatedUsage } from '@/lib/storage';

interface ModelsConfigProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onClose: () => void;
}

interface FetchedModel {
  id: string;
  name?: string;
}

const PROVIDERS: { id: Provider; name: string; keyField: keyof ChatSettings; placeholder: string }[] = [
  { id: 'openai', name: 'OpenAI', keyField: 'openaiKey', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', keyField: 'anthropicKey', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google (Gemini)', keyField: 'googleKey', placeholder: 'AIza...' },
  { id: 'mistral', name: 'Mistral AI', keyField: 'mistralKey', placeholder: '...' },
  { id: 'cerebras', name: 'Cerebras', keyField: 'cerebrasKey', placeholder: 'csk-...' },
];

type UsageTimeFilter = 'all' | '7d' | '30d' | 'today';

function getFilterTimestamp(filter: UsageTimeFilter): number | undefined {
  const now = Date.now();
  switch (filter) {
    case 'today': return now - 24 * 60 * 60 * 1000;
    case '7d': return now - 7 * 24 * 60 * 60 * 1000;
    case '30d': return now - 30 * 24 * 60 * 60 * 1000;
    default: return undefined;
  }
}

function formatCost(cost: number | null): string {
  if (cost === null) return '—';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ── Tooltip component ─────────────────────────────────────
function ModelTooltip({ meta, modelId }: { meta: ModelMetadata; modelId: string }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--background)] shadow-xl text-xs space-y-2">
      <div>
        <div className="font-semibold text-sm">{meta.displayName || modelId}</div>
        {meta.description && <div className="text-gray-500 mt-0.5">{meta.description}</div>}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400">
        <span>Context</span>
        <span className="font-medium">{formatContextWindow(meta.contextWindow)}</span>
        {meta.maxOutputTokens && (
          <>
            <span>Max output</span>
            <span className="font-medium">{formatContextWindow(meta.maxOutputTokens)}</span>
          </>
        )}
        <span>Tier</span>
        <span className="font-medium capitalize">{meta.tier}</span>
      </div>
      <div className="flex gap-2">
        {meta.capabilities.vision && (
          <span className="flex items-center gap-0.5 text-gray-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            Vision
          </span>
        )}
        {meta.capabilities.toolUse && (
          <span className="flex items-center gap-0.5 text-gray-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Tools
          </span>
        )}
        {meta.capabilities.reasoning && (
          <span className="flex items-center gap-0.5 text-gray-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            Reasoning
          </span>
        )}
      </div>
      {meta.pricing && (
        <div className="pt-1 border-t border-[var(--border-color)] text-gray-500">
          <div className="flex justify-between">
            <span>Input</span>
            <span>${meta.pricing.inputPerMillion}/M tokens</span>
          </div>
          <div className="flex justify-between">
            <span>Output</span>
            <span>${meta.pricing.outputPerMillion}/M tokens</span>
          </div>
          {meta.pricing.cachedInputPerMillion !== undefined && (
            <div className="flex justify-between">
              <span>Cached input</span>
              <span>${meta.pricing.cachedInputPerMillion}/M tokens</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ModelsConfig({ settings, onSettingsChange, onClose }: ModelsConfigProps) {
  const [visibleKeys, setVisibleKeys] = useState<Set<Provider>>(new Set());
  const [fetchedModels, setFetchedModels] = useState<Partial<Record<Provider, FetchedModel[]>>>({});
  const [fetchingProvider, setFetchingProvider] = useState<Provider | null>(null);
  const [fetchErrors, setFetchErrors] = useState<Partial<Record<Provider, string>>>({});
  const [customModelInput, setCustomModelInput] = useState<Partial<Record<Provider, string>>>({});
  const [validatingProvider, setValidatingProvider] = useState<Provider | null>(null);
  const [validationFlash, setValidationFlash] = useState<Partial<Record<Provider, 'success' | 'error'>>>({});
  const [modelFilter, setModelFilter] = useState<Partial<Record<Provider, string>>>({});
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  // Usage section state
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageFilter, setUsageFilter] = useState<UsageTimeFilter>('all');
  const [usageData, setUsageData] = useState<AggregatedUsage[]>([]);

  const refreshUsage = useCallback(() => {
    setUsageData(getAggregatedUsage(getFilterTimestamp(usageFilter)));
  }, [usageFilter]);

  useEffect(() => {
    if (usageOpen) refreshUsage();
  }, [usageOpen, refreshUsage]);

  // Auto-revalidate stale keys (>24h) on mount
  useEffect(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let delay = 0;
    for (const p of PROVIDERS) {
      const apiKey = settings[p.keyField] as string;
      if (!apiKey) continue;
      const status = settings.apiKeyValidation?.[p.id];
      if (status && (now - status.lastChecked) > DAY_MS) {
        // Stagger requests by 500ms
        setTimeout(() => handleValidateKey(p.id), delay);
        delay += 500;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleKeyVisibility = (provider: Provider) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const hasKey = (provider: Provider): boolean => {
    const p = PROVIDERS.find(pp => pp.id === provider);
    if (!p) return false;
    return !!(settings[p.keyField] as string);
  };

  const getAvailableModels = useCallback((provider: Provider): { id: string; source: 'default' | 'fetched' | 'custom' }[] => {
    const seen = new Set<string>();
    const result: { id: string; source: 'default' | 'fetched' | 'custom' }[] = [];

    for (const id of DEFAULT_MODELS[provider]) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push({ id, source: 'default' });
      }
    }

    for (const m of fetchedModels[provider] || []) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push({ id: m.id, source: 'fetched' });
      }
    }

    for (const id of settings.customModels?.[provider] || []) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push({ id, source: 'custom' });
      }
    }

    return result;
  }, [fetchedModels, settings.customModels]);

  // Group models by family
  const getGroupedModels = useCallback((
    models: { id: string; source: 'default' | 'fetched' | 'custom' }[],
    filterStr?: string,
  ): { family: string; models: { id: string; source: 'default' | 'fetched' | 'custom' }[] }[] => {
    // Apply text filter
    let filtered = models;
    if (filterStr) {
      const q = filterStr.toLowerCase();
      filtered = models.filter(m => {
        const meta = getModelMetadata(m.id);
        return (
          m.id.toLowerCase().includes(q) ||
          (meta?.displayName?.toLowerCase().includes(q)) ||
          (meta?.description?.toLowerCase().includes(q)) ||
          (meta?.family?.toLowerCase().includes(q))
        );
      });
    }

    // Check if we need grouping (2+ distinct families)
    const families = new Set<string>();
    for (const m of filtered) {
      const meta = getModelMetadata(m.id);
      families.add(meta?.family || 'Other');
    }

    if (families.size < 2) {
      return [{ family: '', models: filtered }];
    }

    // Group by family
    const groups = new Map<string, typeof filtered>();
    for (const m of filtered) {
      const meta = getModelMetadata(m.id);
      const fam = meta?.family || 'Other';
      const arr = groups.get(fam) || [];
      arr.push(m);
      groups.set(fam, arr);
    }

    // Sort groups: named families first (alphabetically), "Other" last
    const result = Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
      .map(([family, models]) => ({ family, models }));

    return result;
  }, []);

  const handleFetchModels = async (provider: Provider) => {
    const p = PROVIDERS.find(pp => pp.id === provider);
    if (!p) return;
    const apiKey = settings[p.keyField] as string;
    if (!apiKey) return;

    setFetchingProvider(provider);
    setFetchErrors(prev => ({ ...prev, [provider]: undefined }));

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();
      if (data.error) {
        setFetchErrors(prev => ({ ...prev, [provider]: data.error }));
      } else {
        setFetchedModels(prev => ({ ...prev, [provider]: data.models }));
      }
    } catch (err) {
      setFetchErrors(prev => ({
        ...prev,
        [provider]: err instanceof Error ? err.message : 'Failed to fetch models',
      }));
    } finally {
      setFetchingProvider(null);
    }
  };

  const handleValidateKey = async (provider: Provider) => {
    const p = PROVIDERS.find(pp => pp.id === provider);
    if (!p) return;
    const apiKey = settings[p.keyField] as string;
    if (!apiKey) return;

    setValidatingProvider(provider);

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();
      const status: ApiKeyValidationStatus = {
        valid: !!data.valid,
        lastChecked: Date.now(),
        error: data.error,
      };

      onSettingsChange({
        apiKeyValidation: {
          ...settings.apiKeyValidation,
          [provider]: status,
        },
      });

      // Flash green/red for 3 seconds
      setValidationFlash(prev => ({ ...prev, [provider]: data.valid ? 'success' : 'error' }));
      setTimeout(() => {
        setValidationFlash(prev => ({ ...prev, [provider]: undefined }));
      }, 3000);
    } catch (err) {
      const status: ApiKeyValidationStatus = {
        valid: false,
        lastChecked: Date.now(),
        error: err instanceof Error ? err.message : 'Validation failed',
      };
      onSettingsChange({
        apiKeyValidation: {
          ...settings.apiKeyValidation,
          [provider]: status,
        },
      });
      setValidationFlash(prev => ({ ...prev, [provider]: 'error' }));
      setTimeout(() => {
        setValidationFlash(prev => ({ ...prev, [provider]: undefined }));
      }, 3000);
    } finally {
      setValidatingProvider(null);
    }
  };

  const handleApiKeyChange = (provider: Provider, value: string) => {
    const p = PROVIDERS.find(pp => pp.id === provider);
    if (!p) return;
    // Clear validation status when key changes
    const updatedValidation = { ...settings.apiKeyValidation };
    delete updatedValidation[provider];
    onSettingsChange({
      [p.keyField]: value,
      apiKeyValidation: updatedValidation,
    });
  };

  const handleAddCustomModel = (provider: Provider) => {
    const modelId = customModelInput[provider]?.trim();
    if (!modelId) return;

    const existing = settings.customModels?.[provider] || [];
    const allKnown = [
      ...DEFAULT_MODELS[provider],
      ...(fetchedModels[provider]?.map(m => m.id) || []),
      ...existing,
    ];
    if (allKnown.includes(modelId)) return;

    const updated = {
      ...settings.customModels,
      [provider]: [...existing, modelId],
    };
    onSettingsChange({ customModels: updated });
    setCustomModelInput(prev => ({ ...prev, [provider]: '' }));
  };

  const handleRemoveCustomModel = (provider: Provider, modelId: string) => {
    const existing = settings.customModels?.[provider] || [];
    const updated = {
      ...settings.customModels,
      [provider]: existing.filter(id => id !== modelId),
    };
    onSettingsChange({ customModels: updated });

    if (settings.provider === provider && settings.model === modelId) {
      onSettingsChange({ model: DEFAULT_MODELS[provider][0], customModels: updated });
    }
  };

  // Get validation status badge for a provider
  const getStatusBadge = (provider: Provider) => {
    const configured = hasKey(provider);
    const flash = validationFlash[provider];
    const status = settings.apiKeyValidation?.[provider];

    if (flash === 'success') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Connected
        </span>
      );
    }
    if (flash === 'error') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          Invalid
        </span>
      );
    }

    if (!configured) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
          Not configured
        </span>
      );
    }

    if (!status) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
          Untested
        </span>
      );
    }

    if (status.valid) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Connected
        </span>
      );
    }

    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-1" title={status.error}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        Invalid
      </span>
    );
  };

  // Usage totals
  const usageTotals = useMemo(() => {
    let totalCost = 0;
    let totalTokens = 0;
    let hasAnyCost = false;
    for (const entry of usageData) {
      totalTokens += entry.inputTokens + entry.outputTokens;
      if (entry.estimatedCost !== null) {
        totalCost += entry.estimatedCost;
        hasAnyCost = true;
      }
    }
    const records = getUsageRecords();
    const earliest = records.length > 0 ? records[0].timestamp : null;
    return { totalCost: hasAnyCost ? totalCost : null, totalTokens, earliest };
  }, [usageData]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models & Providers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure API keys, models, and provider settings
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[var(--border-color)] rounded-lg transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Active Defaults */}
      <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)]">
        <h2 className="text-sm font-semibold mb-3">Default Provider & Model</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Provider</label>
            <select
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as Provider;
                onSettingsChange({
                  provider,
                  model: DEFAULT_MODELS[provider][0],
                });
              }}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <select
              value={settings.model}
              onChange={(e) => onSettingsChange({ model: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
            >
              {getAvailableModels(settings.provider).map(m => {
                const meta = getModelMetadata(m.id);
                return (
                  <option key={m.id} value={m.id}>
                    {meta?.displayName || m.id}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map(provider => {
          const apiKey = (settings[provider.keyField] as string) || '';
          const isDefault = settings.provider === provider.id;
          const configured = !!apiKey;
          const models = getAvailableModels(provider.id);
          const isFetching = fetchingProvider === provider.id;
          const isValidating = validatingProvider === provider.id;
          const fetchError = fetchErrors[provider.id];
          const filter = modelFilter[provider.id] || '';
          const grouped = getGroupedModels(models, filter);
          const showFilter = models.length > 6;
          const validationStatus = settings.apiKeyValidation?.[provider.id];

          return (
            <div
              key={provider.id}
              className={`p-4 rounded-xl border transition-colors ${
                isDefault
                  ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-[var(--border-color)]'
              }`}
            >
              {/* Provider Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{provider.name}</h3>
                  {isDefault && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      Default
                    </span>
                  )}
                </div>
                {getStatusBadge(provider.id)}
              </div>

              {/* API Key */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <div className="flex gap-1">
                  <input
                    type={visibleKeys.has(provider.id) ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                    placeholder={provider.placeholder}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
                  />
                  <button
                    onClick={() => handleValidateKey(provider.id)}
                    disabled={!configured || isValidating}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Test API key"
                  >
                    {isValidating ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : validationFlash[provider.id] === 'success' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : validationFlash[provider.id] === 'error' ? (
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </button>
                  <button
                    onClick={() => toggleKeyVisibility(provider.id)}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors"
                    title={visibleKeys.has(provider.id) ? 'Hide key' : 'Show key'}
                  >
                    {visibleKeys.has(provider.id) ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {validationStatus && !validationStatus.valid && validationStatus.error && !validationFlash[provider.id] && (
                  <p className="text-xs text-red-500 mt-1 truncate" title={validationStatus.error}>
                    {validationStatus.error}
                  </p>
                )}
              </div>

              {/* Available Models */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-500">
                    Available Models ({models.length})
                  </label>
                  <button
                    onClick={() => handleFetchModels(provider.id)}
                    disabled={!configured || isFetching}
                    className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isFetching ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Fetching...
                      </>
                    ) : (
                      'Fetch Models'
                    )}
                  </button>
                </div>
                {fetchError && (
                  <p className="text-xs text-red-500 mb-1">{fetchError}</p>
                )}

                {/* Filter input */}
                {showFilter && (
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setModelFilter(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    placeholder="Filter models..."
                    className="w-full px-2 py-1 mb-1.5 rounded border border-[var(--border-color)] bg-[var(--background)] text-xs"
                  />
                )}

                {/* Grouped model tags */}
                <div className="space-y-2">
                  {grouped.map(group => (
                    <div key={group.family || '_ungrouped'}>
                      {group.family && (
                        <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">{group.family}</div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {group.models.map(m => {
                          const meta = getModelMetadata(m.id);
                          const isActive = settings.provider === provider.id && settings.model === m.id;
                          const tierClasses = meta ? getTierColor(meta.tier) : '';

                          return (
                            <span
                              key={m.id}
                              className={`relative text-xs px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 cursor-default ${
                                isActive
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium border-blue-400/60'
                                  : m.source === 'fetched'
                                  ? 'bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-300/40 dark:border-purple-700/40'
                                  : m.source === 'custom'
                                  ? 'bg-orange-100/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300/40 dark:border-orange-700/40'
                                  : tierClasses
                                    ? `${tierClasses} text-gray-700 dark:text-gray-300`
                                    : 'bg-[var(--border-color)]/50 text-gray-600 dark:text-gray-400 border-transparent'
                              }`}
                              onMouseEnter={() => meta && setHoveredModel(m.id)}
                              onMouseLeave={() => setHoveredModel(null)}
                            >
                              {meta?.displayName || m.id}
                              {/* Capability icons */}
                              {meta && (
                                <span className="inline-flex items-center gap-px ml-0.5 opacity-50">
                                  {meta.capabilities.vision && (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Vision</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  )}
                                  {meta.capabilities.toolUse && (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Tool Use</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  )}
                                  {meta.capabilities.reasoning && (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><title>Reasoning</title><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                  )}
                                </span>
                              )}
                              {/* Context window label */}
                              {meta && (
                                <span className="text-[10px] opacity-40 ml-0.5">{formatContextWindow(meta.contextWindow)}</span>
                              )}
                              {m.source === 'custom' && (
                                <button
                                  onClick={() => handleRemoveCustomModel(provider.id, m.id)}
                                  className="ml-0.5 hover:text-red-500 transition-colors"
                                  title="Remove custom model"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                              {/* Hover tooltip */}
                              {hoveredModel === m.id && meta && (
                                <ModelTooltip meta={meta} modelId={m.id} />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Model */}
                <div className="flex gap-1 mt-2">
                  <input
                    type="text"
                    value={customModelInput[provider.id] || ''}
                    onChange={(e) => setCustomModelInput(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomModel(provider.id);
                    }}
                    placeholder="Custom model ID..."
                    className="flex-1 px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--background)] text-xs"
                  />
                  <button
                    onClick={() => handleAddCustomModel(provider.id)}
                    disabled={!customModelInput[provider.id]?.trim()}
                    className="px-2 py-1 text-xs rounded border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* OpenAI Reasoning Effort */}
              {provider.id === 'openai' && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <label className="block text-sm font-medium mb-1">Reasoning Effort</label>
                  <p className="text-xs text-gray-500 mb-2">Controls reasoning depth for GPT-5 and o-series models</p>
                  <select
                    value={settings.openaiReasoningEffort || 'medium'}
                    onChange={(e) => onSettingsChange({ openaiReasoningEffort: e.target.value as ChatSettings['openaiReasoningEffort'] })}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
                  >
                    <option value="none">None</option>
                    <option value="minimal">Minimal</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium (default)</option>
                    <option value="high">High</option>
                    <option value="xhigh">Extra High</option>
                  </select>
                </div>
              )}

              {/* Anthropic Extended Thinking */}
              {provider.id === 'anthropic' && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-sm font-medium">Extended Thinking</label>
                      <p className="text-xs text-gray-500">
                        Show Claude thinking blocks (uses extra tokens)
                      </p>
                    </div>
                    <button
                      onClick={() => onSettingsChange({
                        anthropicThinkingEnabled: !settings.anthropicThinkingEnabled,
                        anthropicThinkingBudgetTokens: settings.anthropicThinkingBudgetTokens || 1024,
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.anthropicThinkingEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.anthropicThinkingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {settings.anthropicThinkingEnabled && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Thinking Budget (tokens)</label>
                      <input
                        type="number"
                        min={1024}
                        step={256}
                        value={settings.anthropicThinkingBudgetTokens || 1024}
                        onChange={(e) => onSettingsChange({
                          anthropicThinkingBudgetTokens: Number(e.target.value) || 1024,
                        })}
                        className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Must be &ge; 1024 and &lt; max tokens.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Google Thinking */}
              {provider.id === 'google' && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-sm font-medium">Thinking</label>
                      <p className="text-xs text-gray-500">Enable model reasoning (Gemini 2.5+ models)</p>
                    </div>
                    <button
                      onClick={() => onSettingsChange({
                        googleThinkingEnabled: !settings.googleThinkingEnabled,
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.googleThinkingEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.googleThinkingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {settings.googleThinkingEnabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Thinking Level (Gemini 3)</label>
                        <select
                          value={settings.googleThinkingLevel || 'medium'}
                          onChange={(e) => onSettingsChange({
                            googleThinkingLevel: e.target.value as ChatSettings['googleThinkingLevel'],
                          })}
                          className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
                        >
                          <option value="minimal">Minimal</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Thinking Budget (Gemini 2.5) &mdash; tokens
                        </label>
                        <input
                          type="number"
                          min={-1}
                          max={32768}
                          step={1024}
                          value={settings.googleThinkingBudget ?? -1}
                          onChange={(e) => onSettingsChange({
                            googleThinkingBudget: Number(e.target.value),
                          })}
                          className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          -1 = dynamic, 0 = off, up to 32768
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage & Cost Section */}
      <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
        <button
          onClick={() => setUsageOpen(prev => !prev)}
          className="w-full flex items-center justify-between p-4 hover:bg-[var(--sidebar-bg)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-sm font-semibold">Usage & Cost</h2>
          </div>
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${usageOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {usageOpen && (
          <div className="px-4 pb-4 space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>
                Est. cost: <span className="font-medium">{formatCost(usageTotals.totalCost)}</span>
              </span>
              <span>
                Tokens: <span className="font-medium">{formatTokenCount(usageTotals.totalTokens)}</span>
              </span>
              {usageTotals.earliest && (
                <span className="text-xs text-gray-400">
                  Since {new Date(usageTotals.earliest).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Time filter + clear */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(['all', '30d', '7d', 'today'] as UsageTimeFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setUsageFilter(f)}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      usageFilter === f
                        ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400/60 text-blue-700 dark:text-blue-300'
                        : 'border-[var(--border-color)] hover:bg-[var(--border-color)]'
                    }`}
                  >
                    {f === 'all' ? 'All time' : f === '30d' ? '30 days' : f === '7d' ? '7 days' : 'Today'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  if (confirm('Clear all usage data? This cannot be undone.')) {
                    clearUsageRecords();
                    refreshUsage();
                  }
                }}
                className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Per-model table */}
            {usageData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No usage data recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-gray-500">
                      <th className="text-left py-1.5 pr-3 font-medium">Model</th>
                      <th className="text-right py-1.5 px-2 font-medium">Requests</th>
                      <th className="text-right py-1.5 px-2 font-medium">Input</th>
                      <th className="text-right py-1.5 px-2 font-medium">Output</th>
                      <th className="text-right py-1.5 px-2 font-medium">Cached</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.map(entry => {
                      const meta = getModelMetadata(entry.model);
                      return (
                        <tr key={`${entry.provider}:${entry.model}`} className="border-b border-[var(--border-color)]/50">
                          <td className="py-1.5 pr-3">
                            <div className="font-medium">{meta?.displayName || entry.model}</div>
                            <div className="text-gray-400 text-[10px]">{entry.provider}</div>
                          </td>
                          <td className="text-right py-1.5 px-2">{entry.requests}</td>
                          <td className="text-right py-1.5 px-2 text-blue-600 dark:text-blue-400">{formatTokenCount(entry.inputTokens)}</td>
                          <td className="text-right py-1.5 px-2 text-green-600 dark:text-green-400">{formatTokenCount(entry.outputTokens)}</td>
                          <td className="text-right py-1.5 px-2 text-purple-600 dark:text-purple-400">
                            {entry.cacheReadTokens > 0 ? formatTokenCount(entry.cacheReadTokens) : '—'}
                          </td>
                          <td className="text-right py-1.5 pl-2 font-medium">{formatCost(entry.estimatedCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
