'use client';

import { useState, useEffect } from 'react';
import { ChatSettings, MCPServerConfig, BuiltinToolsConfig } from '@/types';
import { getGoogleAuthUrl, isGoogleDriveConfigured } from '@/lib/googledrive';
import { MCPSettingsSection } from './MCPSettingsSection';

interface ConnectorsConfigProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onClose: () => void;
}

export function ConnectorsConfig({ settings, onSettingsChange, onClose }: ConnectorsConfigProps) {
  const [googleDriveConfigured, setGoogleDriveConfigured] = useState(false);

  useEffect(() => {
    setGoogleDriveConfigured(isGoogleDriveConfigured());
  }, []);

  const handleGoogleDriveConnect = () => {
    const authUrl = getGoogleAuthUrl();
    window.location.href = authUrl;
  };

  const handleGoogleDriveDisconnect = () => {
    onSettingsChange({
      googleDriveEnabled: false,
      googleDriveAccessToken: undefined,
      googleDriveRefreshToken: undefined,
      googleDriveTokenExpiry: undefined,
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">Connectors</h1>
              <p className="text-sm text-gray-500 mt-1">
                External integrations the AI can use during conversations
              </p>
            </div>
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

        {/* Web Search */}
        <section className="p-4 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div>
                <label className="block text-sm font-medium">Web Search</label>
                <p className="text-xs text-gray-500">
                  Allow the AI to search the web for current information
                </p>
              </div>
            </div>
            <button
              onClick={() => onSettingsChange({ webSearchEnabled: !settings.webSearchEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.webSearchEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.webSearchEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {settings.webSearchEnabled && (
            <div className="space-y-3 mt-4 pt-4 border-t border-[var(--border-color)]">
              <div>
                <label className="block text-sm font-medium mb-2">Tavily API Key (Optional)</label>
                <input
                  type="password"
                  value={settings.tavilyApiKey || ''}
                  onChange={(e) => onSettingsChange({ tavilyApiKey: e.target.value })}
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
                  value={settings.braveApiKey || ''}
                  onChange={(e) => onSettingsChange({ braveApiKey: e.target.value })}
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
        </section>

        {/* Google Drive */}
        <section className="p-4 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.71 3.5L1.15 15l4.58 7.5h13.54l4.58-7.5L17.29 3.5H7.71zm.79 1h8l5.14 10L17.5 21h-11l-4.14-6.5 5.14-10z"/>
              </svg>
              <div>
                <label className="block text-sm font-medium">Google Drive Search</label>
                <p className="text-xs text-gray-500">
                  Allow the AI to search files in your Google Drive
                </p>
              </div>
            </div>
            {settings.googleDriveAccessToken ? (
              <button
                onClick={() => onSettingsChange({ googleDriveEnabled: !settings.googleDriveEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.googleDriveEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.googleDriveEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            ) : (
              <span className="text-xs text-gray-400">Not connected</span>
            )}
          </div>

          {googleDriveConfigured ? (
            <div className="space-y-3">
              {settings.googleDriveAccessToken ? (
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
        </section>

        {/* Memory Search */}
        <section className="p-4 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <label className="block text-sm font-medium">Memory Search</label>
                <p className="text-xs text-gray-500">
                  Allow the AI to search previous conversations for context
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.memorySearchEnabled || false}
              onClick={() => onSettingsChange({ memorySearchEnabled: !settings.memorySearchEnabled })}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.memorySearchEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.memorySearchEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Manage index and test search in the Knowledge Base view.
          </p>
        </section>

        {/* Document Search (RAG) */}
        <section className="p-4 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <label className="block text-sm font-medium">Document Search (RAG)</label>
                <p className="text-xs text-gray-500">
                  Upload documents for AI to search through
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.ragEnabled || false}
              onClick={() => onSettingsChange({ ragEnabled: !settings.ragEnabled })}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.ragEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.ragEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Upload and manage documents in the Knowledge Base view.
          </p>
        </section>

        {/* MCP Tools */}
        <section className="p-4 rounded-xl border border-[var(--border-color)]">
          <MCPSettingsSection
            mcpEnabled={settings.mcpEnabled || false}
            mcpServers={settings.mcpServers || []}
            builtinTools={settings.builtinTools || {}}
            onMCPEnabledChange={(enabled) => onSettingsChange({ mcpEnabled: enabled })}
            onServersChange={(servers: MCPServerConfig[]) => onSettingsChange({ mcpServers: servers })}
            onBuiltinToolsChange={(config: BuiltinToolsConfig) => onSettingsChange({ builtinTools: config })}
          />
        </section>
      </div>
    </div>
  );
}
