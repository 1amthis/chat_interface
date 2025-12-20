// Internal MCP protocol types for the client wrapper

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPContentBlock {
  type: 'text' | 'image' | 'audio' | 'resource' | 'resource_link';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  };
}

export interface MCPCallToolResult {
  content: MCPContentBlock[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export interface MCPClientInfo {
  name: string;
  version: string;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
}

export interface MCPConnectionState {
  connected: boolean;
  serverInfo?: MCPServerInfo;
  tools: MCPTool[];
  error?: string;
  lastConnected?: number;
}
