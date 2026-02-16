'use client';

import { useState, useEffect } from 'react';
import { ChatSettings, MCPServerConfig, BuiltinToolsConfig } from '@/types';
import { getGoogleAuthUrl, isGoogleDriveConfigured } from '@/lib/googledrive';
import { MCPSettingsSection } from './MCPSettingsSection';

interface SettingsModalProps {
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [googleDriveConfigured, setGoogleDriveConfigured] = useState(false);

  useEffect(() => {
    // Check if Google Drive is properly configured (has client ID)
    setGoogleDriveConfigured(isGoogleDriveConfigured());
  }, []);

  const handleGoogleDriveConnect = () => {
    const authUrl = getGoogleAuthUrl();
    window.location.href = authUrl;
  };

  const handleGoogleDriveDisconnect = () => {
    setLocalSettings({
      ...localSettings,
      googleDriveEnabled: false,
      googleDriveAccessToken: undefined,
      googleDriveRefreshToken: undefined,
      googleDriveTokenExpiry: undefined,
    });
  };

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

          {/* Web Search Section */}
          <div className="border-t border-[var(--border-color)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium">Web Search</label>
                <p className="text-xs text-gray-500">
                  Allow the AI to search the web for current information
                </p>
              </div>
              <button
                onClick={() => setLocalSettings({ ...localSettings, webSearchEnabled: !localSettings.webSearchEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localSettings.webSearchEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localSettings.webSearchEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {localSettings.webSearchEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Tavily API Key (Optional)</label>
                  <input
                    type="password"
                    value={localSettings.tavilyApiKey || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, tavilyApiKey: e.target.value })}
                    placeholder="tvly-..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your key at <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">tavily.com</a>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Brave Search API Key (Optional)</label>
                  <input
                    type="password"
                    value={localSettings.braveApiKey || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, braveApiKey: e.target.value })}
                    placeholder="BSA..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--background)]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your free key at <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">brave.com/search/api</a> (2,000 free queries/month)
                  </p>
                </div>
                <p className="text-xs text-gray-500 border-t border-[var(--border-color)] pt-2">
                  Without an API key, Wikipedia will be used for factual searches.
                </p>
              </div>
            )}
          </div>

          {/* Google Drive Section */}
          <div className="border-t border-[var(--border-color)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium">Google Drive Search</label>
                <p className="text-xs text-gray-500">
                  Allow the AI to search files in your Google Drive
                </p>
              </div>
              {localSettings.googleDriveAccessToken ? (
                <button
                  onClick={() => setLocalSettings({ ...localSettings, googleDriveEnabled: !localSettings.googleDriveEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localSettings.googleDriveEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localSettings.googleDriveEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span className="text-xs text-gray-400">Not connected</span>
              )}
            </div>

            {googleDriveConfigured ? (
              <div className="space-y-3">
                {localSettings.googleDriveAccessToken ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-green-700 dark:text-green-300">Connected to Google Drive</span>
                    </div>
                    <button
                      onClick={handleGoogleDriveDisconnect}
                      className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleDriveConnect}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Connect Google Drive
                  </button>
                )}
                <p className="text-xs text-gray-500">
                  When enabled, the AI can search your Google Drive files to help answer questions.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Google Drive integration requires configuration. Set <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">GOOGLE_CLIENT_SECRET</code> environment variables.
                </p>
              </div>
            )}
          </div>

          {/* Memory Search Section */}
          <div className="border-t border-[var(--border-color)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium">Memory Search</label>
                <p className="text-xs text-gray-500">
                  Allow the AI to search previous conversations for context
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={localSettings.memorySearchEnabled || false}
                onClick={() => setLocalSettings({ ...localSettings, memorySearchEnabled: !localSettings.memorySearchEnabled })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.memorySearchEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.memorySearchEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Manage index and test search in the Knowledge Base view.
            </p>
          </div>

          {/* RAG Document Search Section */}
          <div className="border-t border-[var(--border-color)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium">Document Search (RAG)</label>
                <p className="text-xs text-gray-500">
                  Upload documents for AI to search through
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={localSettings.ragEnabled || false}
                onClick={() => setLocalSettings({ ...localSettings, ragEnabled: !localSettings.ragEnabled })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localSettings.ragEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    localSettings.ragEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Upload and manage documents in the Knowledge Base view.
            </p>
          </div>

          {/* MCP Tools Section */}
          <div className="border-t border-[var(--border-color)] pt-4">
            <MCPSettingsSection
              mcpEnabled={localSettings.mcpEnabled || false}
              mcpServers={localSettings.mcpServers || []}
              builtinTools={localSettings.builtinTools || {}}
              onMCPEnabledChange={(enabled) =>
                setLocalSettings({ ...localSettings, mcpEnabled: enabled })
              }
              onServersChange={(servers: MCPServerConfig[]) =>
                setLocalSettings({ ...localSettings, mcpServers: servers })
              }
              onBuiltinToolsChange={(config: BuiltinToolsConfig) =>
                setLocalSettings({ ...localSettings, builtinTools: config })
              }
            />
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
