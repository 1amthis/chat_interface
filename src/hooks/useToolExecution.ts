/**
 * Hook for managing tool execution (web search, Google Drive, MCP tools, memory search)
 */

import { useState, useCallback } from 'react';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, ToolSource, Artifact, ArtifactType, ArtifactVersion } from '@/types';
import { saveSettings, generateId } from '@/lib/storage';
import { API_CONFIG } from '@/lib/constants';
import { searchMemory, formatSearchResultsForAI, MemorySearchResult } from '@/lib/memory-search';
import { searchRAG, formatRAGResultsForAI, RAGSearchResult } from '@/lib/rag';

export interface UseToolExecutionOptions {
  settings: ChatSettings;
  setSettings: (settings: ChatSettings) => void;
}

export interface ArtifactToolCallResult {
  result: string;
  isError: boolean;
  newArtifact?: Artifact;
  updatedArtifact?: Artifact;
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
  performRAGSearch: (
    query: string
  ) => Promise<{ results: RAGSearchResult[]; formatted: string } | null>;
  performMCPToolCall: (
    toolName: string,
    params: Record<string, unknown>,
    source: ToolSource,
    serverId?: string
  ) => Promise<{ result: string; isError: boolean }>;
  performArtifactToolCall: (
    toolName: string,
    params: Record<string, unknown>,
    currentArtifacts: Artifact[]
  ) => ArtifactToolCallResult;
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
        limit: settings.memorySearchLimit ?? 5,
        minScore: settings.memorySearchMinScore ?? 0.1,
        snippetLength: settings.memorySearchSnippetLength ?? 150,
        k1: settings.bm25K1 ?? 1.2,
        b: settings.bm25B ?? 0.75,
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
  }, [settings.memorySearchLimit, settings.memorySearchMinScore, settings.memorySearchSnippetLength, settings.bm25K1, settings.bm25B]);

  // Perform RAG search across uploaded documents
  const performRAGSearch = useCallback(async (
    query: string
  ): Promise<{ results: RAGSearchResult[]; formatted: string } | null> => {
    try {
      if (!settings.openaiKey) {
        return {
          results: [],
          formatted: 'RAG search requires an OpenAI API key for embeddings.',
        };
      }

      setSearchStatus(`Searching documents: "${query}"`);

      const results = await searchRAG(query, settings.openaiKey, {
        limit: settings.ragSearchLimit ?? 5,
        minScore: settings.ragSearchMinScore ?? 0.3,
      });

      setSearchStatus(null);

      return {
        results,
        formatted: formatRAGResultsForAI(results),
      };
    } catch (error) {
      console.error('RAG search error:', error);
      setSearchStatus(null);
      return null;
    }
  }, [settings.openaiKey, settings.ragSearchLimit, settings.ragSearchMinScore]);

  // Execute artifact tool calls client-side (no API call needed)
  const performArtifactToolCall = useCallback((
    toolName: string,
    params: Record<string, unknown>,
    currentArtifacts: Artifact[]
  ): ArtifactToolCallResult => {
    const VALID_ARTIFACT_TYPES: ArtifactType[] = ['code', 'html', 'react', 'markdown', 'svg', 'mermaid'];

    if (toolName === 'create_artifact') {
      const type = params.type as string;
      const title = params.title as string;
      const content = params.content as string;
      const language = params.language as string | undefined;

      if (!type || !title || !content) {
        return { result: 'Error: create_artifact requires type, title, and content parameters.', isError: true };
      }
      if (!VALID_ARTIFACT_TYPES.includes(type as ArtifactType)) {
        return { result: `Error: Invalid artifact type "${type}". Valid types: ${VALID_ARTIFACT_TYPES.join(', ')}`, isError: true };
      }

      const newArtifact: Artifact = {
        id: generateId(),
        type: type as ArtifactType,
        title,
        content,
        language: type === 'code' ? language : undefined,
        versions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      return {
        result: JSON.stringify({ success: true, artifact_id: newArtifact.id, title: newArtifact.title, type: newArtifact.type }),
        isError: false,
        newArtifact,
      };
    }

    if (toolName === 'update_artifact') {
      const artifactId = params.artifact_id as string;
      const content = params.content as string;
      const newTitle = params.title as string | undefined;

      if (!artifactId || !content) {
        return { result: 'Error: update_artifact requires artifact_id and content parameters.', isError: true };
      }

      const existing = currentArtifacts.find(a => a.id === artifactId);
      if (!existing) {
        const availableIds = currentArtifacts.map(a => `  - ${a.id} ("${a.title}")`).join('\n');
        return {
          result: `Error: Artifact with ID "${artifactId}" not found.${availableIds ? `\nAvailable artifacts:\n${availableIds}` : '\nNo artifacts exist in this conversation.'}`,
          isError: true,
        };
      }

      // Push current content to versions
      const version: ArtifactVersion = {
        id: generateId(),
        content: existing.content,
        createdAt: existing.updatedAt,
      };

      const updatedArtifact: Artifact = {
        ...existing,
        content,
        title: newTitle || existing.title,
        versions: [...existing.versions, version],
        updatedAt: Date.now(),
      };

      return {
        result: JSON.stringify({ success: true, artifact_id: updatedArtifact.id, title: updatedArtifact.title, version: updatedArtifact.versions.length }),
        isError: false,
        updatedArtifact,
      };
    }

    if (toolName === 'read_artifact') {
      const artifactId = params.artifact_id as string;

      if (!artifactId) {
        return { result: 'Error: read_artifact requires artifact_id parameter.', isError: true };
      }

      const existing = currentArtifacts.find(a => a.id === artifactId);
      if (!existing) {
        const availableIds = currentArtifacts.map(a => `  - ${a.id} ("${a.title}")`).join('\n');
        return {
          result: `Error: Artifact with ID "${artifactId}" not found.${availableIds ? `\nAvailable artifacts:\n${availableIds}` : '\nNo artifacts exist in this conversation.'}`,
          isError: true,
        };
      }

      return {
        result: JSON.stringify({
          artifact_id: existing.id,
          type: existing.type,
          title: existing.title,
          language: existing.language,
          content: existing.content,
          versions: existing.versions.length,
        }),
        isError: false,
      };
    }

    return { result: `Error: Unknown artifact tool "${toolName}".`, isError: true };
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
    performRAGSearch,
    performMCPToolCall,
    performArtifactToolCall,
    generateToolCallId,
  };
}
