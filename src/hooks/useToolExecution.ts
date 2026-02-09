/**
 * Hook for managing tool execution (web search, Google Drive, MCP tools, memory search)
 */

import { useState, useCallback } from 'react';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, ToolSource } from '@/types';
import { saveSettings } from '@/lib/storage';
import { API_CONFIG } from '@/lib/constants';
import { searchMemory, formatSearchResultsForAI, MemorySearchResult } from '@/lib/memory-search';

export interface UseToolExecutionOptions {
  settings: ChatSettings;
  setSettings: (settings: ChatSettings) => void;
}

export interface UseToolExecutionReturn {
  searchStatus: string | null;
  setSearchStatus: (status: string | null) => void;
  performSearch: (query: string, retries?: number) => Promise<WebSearchResponse | null>;
  performDriveSearch: (query: string, retries?: number) => Promise<GoogleDriveSearchResponse | null>;
  performMemorySearch: (
    query: string,
    excludeConversationId?: string
  ) => Promise<{ results: MemorySearchResult[]; formatted: string } | null>;
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

  // Perform MCP or builtin tool call with retry logic and timeout
  const performMCPToolCall = useCallback(async (
    toolName: string,
    params: Record<string, unknown>,
    source: ToolSource,
    serverId?: string
  ): Promise<{ result: string; isError: boolean }> => {
    const maxRetries = API_CONFIG.SEARCH_RETRIES;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setSearchStatus(`Running tool: ${toolName}${attempt > 0 ? ` (retry ${attempt})` : ''}`);

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
          signal: AbortSignal.timeout(60000), // 60 second timeout
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.error || `Tool call failed: ${response.status}`);
          // Don't retry 4xx errors
          if (response.status >= 400 && response.status < 500) {
            setSearchStatus(null);
            return {
              result: error.message,
              isError: true,
            };
          }
          throw error;
        }

        const data = await response.json();
        setSearchStatus(null);

        return {
          result: data.formattedResult || JSON.stringify(data.result, null, 2),
          isError: data.result?.isError || false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Tool call failed');

        // Don't retry abort/timeout errors
        if (lastError.name === 'AbortError' || lastError.name === 'TimeoutError') {
          break;
        }

        console.error(`MCP tool call attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, API_CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempt))
          );
        }
      }
    }

    console.error('MCP tool call error after all retries:', lastError);
    setSearchStatus(null);
    return {
      result: lastError?.message || 'Tool call failed',
      isError: true,
    };
  }, [settings.builtinTools, settings.provider]);

  // Perform memory search across previous conversations
  const performMemorySearch = useCallback(async (
    query: string,
    excludeConversationId?: string
  ): Promise<{ results: MemorySearchResult[]; formatted: string } | null> => {
    try {
      setSearchStatus(`Searching memory: "${query}"`);

      const results = await searchMemory(query, {
        limit: 5,
        excludeConversationId,
      });

      setSearchStatus(null);

      return {
        results,
        formatted: formatSearchResultsForAI(results),
      };
    } catch (error) {
      console.error('Memory search error:', error);
      setSearchStatus(null);
      return null;
    }
  }, []);

  // Helper to generate unique IDs for tool calls
  const generateToolCallId = useCallback(() => {
    return `tc_${crypto.randomUUID()}`;
  }, []);

  return {
    searchStatus,
    setSearchStatus,
    performSearch,
    performDriveSearch,
    performMemorySearch,
    performMCPToolCall,
    generateToolCallId,
  };
}
