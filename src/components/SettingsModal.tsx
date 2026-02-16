'use client';

import { useState } from 'react';
import { ChatSettings } from '@/types';

interface SettingsModalProps {
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--background)] rounded-xl shadow-xl w-full max-w-md mx-4 border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--border-color)] rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  localSettings.theme === 'light'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-[var(--border-color)] hover:bg-[var(--border-color)]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Light
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  localSettings.theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-[var(--border-color)] hover:bg-[var(--border-color)]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Dark
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, theme: 'system' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  localSettings.theme === 'system'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-[var(--border-color)] hover:bg-[var(--border-color)]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                System
              </button>
            </div>
          </div>

          {/* Provider/Model/Keys note */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Manage providers, API keys, and model settings in the <strong>Models</strong> view (sidebar).
            </p>
          </div>

          {/* Connectors note */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Manage web search, Google Drive, MCP, and other integrations in the <strong>Connectors</strong> view (sidebar).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">System Prompt</label>
            <textarea
              value={localSettings.systemPrompt || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)] resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Instructions that apply to all conversations
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
