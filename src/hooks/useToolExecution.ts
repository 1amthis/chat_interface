/**
 * Hook for managing tool execution (web search, Google Drive, MCP tools)
 */

import { useState, useCallback } from 'react';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, ToolSource } from '@/types';
import { saveSettings } from '@/lib/storage';
import { API_CONFIG } from '@/lib/constants';

export interface UseToolExecutionOptions {
  settings: ChatSettings;
  setSettings: (settings: ChatSettings) => void;
}

export interface UseToolExecutionReturn {
  searchStatus: string | null;
  setSearchStatus: (status: string | null) => void;
  performSearch: (query: string, retries?: number) => Promise<WebSearchResponse | null>;
  performDriveSearch: (query: string, retries?: number) => Promise<GoogleDriveSearchResponse | null>;
  performMCPToolCall: (
    toolName: string,
    params: Record<string, unknown>,
    source: ToolSource,
    serverId?: string
  ) => Promise<{ result: string; isError: boolean }>;
  generateToolCallId: () => string;
}

export function useToolExecution({
  settings,
  setSettings,
}: UseToolExecutionOptions): UseToolExecutionReturn {
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // Perform web search with retry logic
  const performSearch = useCallback(async (query: string, retries: number = API_CONFIG.SEARCH_RETRIES): Promise<WebSearchResponse | null> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        setSearchStatus(`Searching: "${query}"${attempt > 0 ? ` (retry ${attempt})` : ''}`);

        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            tavilyApiKey: settings.tavilyApiKey,
            braveApiKey: settings.braveApiKey,
          }),
        });

        if (!response.ok) {
          let errorDetail = '';
          try {
            const errorJson = await response.json();
            errorDetail = errorJson.error || '';
          } catch {
            // Ignore JSON parse errors
          }
          throw new Error(`Search failed: ${response.status}${errorDetail ? ` - ${errorDetail}` : ''}`);
        }

        const result = await response.json();
        setSearchStatus(null);
        return result as WebSearchResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Search attempt ${attempt + 1} failed:`, error);

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempt)));
        }
      }
    }

    console.error('Search error after all retries:', lastError);
    setSearchStatus(null);
    return null;
  }, [settings.tavilyApiKey, settings.braveApiKey]);

  // Perform Google Drive search with retry logic
  const performDriveSearch = useCallback(async (query: string, retries: number = API_CONFIG.SEARCH_RETRIES): Promise<GoogleDriveSearchResponse | null> => {
    if (!settings.googleDriveAccessToken) {
      console.error('Google Drive access token not available');
      return null;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        setSearchStatus(`Searching Drive: "${query}"${attempt > 0 ? ` (retry ${attempt})` : ''}`);

        const response = await fetch('/api/drive-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            accessToken: settings.googleDriveAccessToken,
            refreshToken: settings.googleDriveRefreshToken,
            tokenExpiry: settings.googleDriveTokenExpiry,
          }),
        });

        if (!response.ok) {
          let errorDetail = '';
          try {
            const errorJson = await response.json();
            errorDetail = errorJson.error || '';
          } catch {
            // Ignore JSON parse errors
          }
          throw new Error(`Drive search failed: ${response.status}${errorDetail ? ` - ${errorDetail}` : ''}`);
        }

        const result = await response.json();

        // Update tokens if refreshed
        if (result.newAccessToken) {
          const newSettings = {
            ...settings,
            googleDriveAccessToken: result.newAccessToken,
            googleDriveTokenExpiry: result.newTokenExpiry,
          };
          saveSettings(newSettings);
          setSettings(newSettings);
        }

        setSearchStatus(null);
        return result as GoogleDriveSearchResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Drive search attempt ${attempt + 1} failed:`, error);

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempt)));
        }
      }
    }

    console.error('Drive search error after all retries:', lastError);
    setSearchStatus(null);
    return null;
  }, [settings, setSettings]);

  // Perform MCP or builtin tool call
  const performMCPToolCall = useCallback(async (
    toolName: string,
    params: Record<string, unknown>,
    source: ToolSource,
    serverId?: string
  ): Promise<{ result: string; isError: boolean }> => {
    try {
      setSearchStatus(`Running tool: ${toolName}`);

      const response = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          serverId,
          toolName,
          params,
          builtinToolsConfig: settings.builtinTools,
          provider: settings.provider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Tool call failed: ${response.status}`);
      }

      const data = await response.json();
      setSearchStatus(null);

      return {
        result: data.formattedResult || JSON.stringify(data.result, null, 2),
        isError: data.result?.isError || false,
      };
    } catch (error) {
      console.error('MCP tool call error:', error);
      setSearchStatus(null);
      return {
        result: error instanceof Error ? error.message : 'Tool call failed',
        isError: true,
      };
    }
  }, [settings.builtinTools, settings.provider]);

  // Helper to generate unique IDs for tool calls
  const generateToolCallId = useCallback(() => {
    return `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  return {
    searchStatus,
    setSearchStatus,
    performSearch,
    performDriveSearch,
    performMCPToolCall,
    generateToolCallId,
  };
}
