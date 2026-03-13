import type { MCPServerConfig } from '@/types';

export interface MCPServerPreset {
  id: string;
  name: string;
  description: string;
  note?: string;
  server: Omit<MCPServerConfig, 'id'>;
}

export const MCP_SERVER_PRESETS: MCPServerPreset[] = [
  {
    id: 'google-workspace-cli-legacy',
    name: 'Google Workspace CLI',
    description: 'Adds Google Drive, Gmail, and Calendar tools through the legacy gws MCP mode, using compact tool discovery.',
    note: 'Upstream removed `gws mcp` in v0.8.0, so this preset pins @googleworkspace/cli@0.6.3.',
    server: {
      name: 'Google Workspace',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@googleworkspace/cli@0.6.3', 'mcp', '-s', 'drive,gmail,calendar', '--tool-mode', 'compact'],
    },
  },
];
