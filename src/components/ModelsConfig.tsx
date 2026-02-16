'use client';

import { useState } from 'react';
import { ChatSettings, Provider, DEFAULT_MODELS } from '@/types';

interface ModelsConfigProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onClose: () => void;
}

const PROVIDERS: { id: Provider; name: string; keyField: keyof ChatSettings; placeholder: string }[] = [
  { id: 'openai', name: 'OpenAI', keyField: 'openaiKey', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', keyField: 'anthropicKey', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google (Gemini)', keyField: 'googleKey', placeholder: 'AIza...' },
  { id: 'mistral', name: 'Mistral AI', keyField: 'mistralKey', placeholder: '...' },
  { id: 'cerebras', name: 'Cerebras', keyField: 'cerebrasKey', placeholder: 'csk-...' },
];

export function ModelsConfig({ settings, onSettingsChange, onClose }: ModelsConfigProps) {
  const [visibleKeys, setVisibleKeys] = useState<Set<Provider>>(new Set());

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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models & Providers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure API keys and default model settings
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
              {DEFAULT_MODELS[settings.provider].map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
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
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    configured
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}
                >
                  {configured ? 'Configured' : 'Not configured'}
                </span>
              </div>

              {/* API Key */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <div className="flex gap-1">
                  <input
                    type={visibleKeys.has(provider.id) ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => onSettingsChange({ [provider.keyField]: e.target.value })}
                    placeholder={provider.placeholder}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--background)] text-sm"
                  />
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
              </div>

              {/* Available Models */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Available Models ({DEFAULT_MODELS[provider.id].length})
                </label>
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_MODELS[provider.id].map(model => (
                    <span
                      key={model}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        settings.provider === provider.id && settings.model === model
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                          : 'bg-[var(--border-color)]/50 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
