import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPServerConfig } from '@/types';
import type { MCPTool, MCPCallToolResult, MCPConnectionState, MCPServerInfo } from './types';

const CONNECTION_TIMEOUT = 30000; // 30 seconds
const TOOL_CALL_TIMEOUT = 60000; // 60 seconds

export class MCPClient {
  private config: MCPServerConfig;
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null;
  private state: MCPConnectionState = {
    connected: false,
    tools: [],
  };

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get isConnected(): boolean {
    return this.state.connected;
  }

  get tools(): MCPTool[] {
    return this.state.tools;
  }

  get serverInfo(): MCPServerInfo | undefined {
    return this.state.serverInfo;
  }

  get connectionState(): MCPConnectionState {
    return { ...this.state };
  }

  async connect(): Promise<void> {
    if (this.state.connected) {
      return;
    }

    try {
      // Create transport based on config
      if (this.config.transport === 'stdio') {
        if (!this.config.command) {
          throw new Error('Command is required for stdio transport');
        }
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args || [],
          env: this.config.env,
        });
      } else if (this.config.transport === 'sse') {
        if (!this.config.url) {
          throw new Error('URL is required for SSE transport');
        }
        this.transport = new SSEClientTransport(
          new URL(this.config.url),
          {
            requestInit: this.config.headers ? {
              headers: this.config.headers,
            } : undefined,
          }
        );
      } else if (this.config.transport === 'streamable-http' || this.config.transport === 'http') {
        if (!this.config.url) {
          throw new Error('URL is required for Streamable HTTP transport');
        }

        const customHeaders = this.config.headers;
        console.log(`[MCP] Creating StreamableHTTP transport for ${this.config.name}`, {
          url: this.config.url,
          hasHeaders: !!customHeaders,
          headerKeys: customHeaders ? Object.keys(customHeaders) : [],
        });

        // Build transport options
        const transportOptions: {
          requestInit?: RequestInit;
          fetch?: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
        } = {};

        // Add headers via requestInit
        if (customHeaders) {
          transportOptions.requestInit = {
            headers: customHeaders,
          };

          // Also provide custom fetch to ensure headers are merged with any SDK-added headers
          transportOptions.fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
            const mergedHeaders = new Headers(init?.headers);
            for (const [key, value] of Object.entries(customHeaders)) {
              // Only set if not already present (respect SDK's headers)
              if (!mergedHeaders.has(key)) {
                mergedHeaders.set(key, value);
              }
            }
            console.log(`[MCP] Fetch to ${url}`, {
              headers: Object.fromEntries(mergedHeaders.entries()),
              method: init?.method || 'GET'
            });
            return fetch(url, { ...init, headers: mergedHeaders });
          };
        }

        this.transport = new StreamableHTTPClientTransport(
          new URL(this.config.url),
          Object.keys(transportOptions).length > 0 ? transportOptions : undefined
        );
      } else {
        throw new Error(`Unknown transport type: ${this.config.transport}`);
      }

      // Create client
      this.client = new Client(
        { name: 'chat-interface', version: '1.0.0' },
        { capabilities: {} }
      );

      // Connect with timeout
      await Promise.race([
        this.client.connect(this.transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
        ),
      ]);

      // Get server info
      const serverVersion = this.client.getServerVersion();
      if (serverVersion) {
        this.state.serverInfo = {
          name: serverVersion.name,
          version: serverVersion.version,
        };
      }

      // Fetch tools
      await this.refreshTools();

      this.state.connected = true;
      this.state.lastConnected = Date.now();
      this.state.error = undefined;
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.connected = false;
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
    } catch {
      // Ignore disconnect errors
    } finally {
      this.client = null;
      this.transport = null;
      this.state.connected = false;
      this.state.tools = [];
    }
  }

  async refreshTools(): Promise<MCPTool[]> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    const result = await this.client.listTools();
    this.state.tools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return this.state.tools;
  }

  async callTool(
    name: string,
    params: Record<string, unknown>
  ): Promise<MCPCallToolResult> {
    if (!this.client || !this.state.connected) {
      throw new Error('Not connected to MCP server');
    }

    // Call tool with timeout
    const result = await Promise.race([
      this.client.callTool({ name, arguments: params }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool call timeout')), TOOL_CALL_TIMEOUT)
      ),
    ]);

    // Handle the result - it could be either format
    if ('toolResult' in result) {
      // Legacy format
      return {
        content: [{
          type: 'text',
          text: typeof result.toolResult === 'string'
            ? result.toolResult
            : JSON.stringify(result.toolResult),
        }],
        isError: false,
      };
    }

    // Standard format
    return {
      content: result.content.map((c) => ({
        type: c.type,
        text: 'text' in c ? c.text : undefined,
        data: 'data' in c ? c.data : undefined,
        mimeType: 'mimeType' in c ? c.mimeType : undefined,
        resource: 'resource' in c ? c.resource : undefined,
      })),
      isError: result.isError,
      structuredContent: result.structuredContent,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.state.connected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}
