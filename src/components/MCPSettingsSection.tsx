'use client';

import { useState } from 'react';
import type { MCPServerConfig, BuiltinToolsConfig, MCPServerStatus } from '@/types';
import { generateId } from '@/lib/storage';

interface MCPSettingsSectionProps {
  mcpEnabled: boolean;
  mcpServers: MCPServerConfig[];
  builtinTools: BuiltinToolsConfig;
  onMCPEnabledChange: (enabled: boolean) => void;
  onServersChange: (servers: MCPServerConfig[]) => void;
  onBuiltinToolsChange: (config: BuiltinToolsConfig) => void;
}

export function MCPSettingsSection({
  mcpEnabled,
  mcpServers,
  builtinTools,
  onMCPEnabledChange,
  onServersChange,
  onBuiltinToolsChange,
}: MCPSettingsSectionProps) {
  const [showAddServer, setShowAddServer] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [serverStatuses, setServerStatuses] = useState<MCPServerStatus[]>([]);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Server form state
  const [serverName, setServerName] = useState('');
  const [serverTransport, setServerTransport] = useState<'stdio' | 'sse' | 'streamable-http' | 'http'>('stdio');
  const [serverCommand, setServerCommand] = useState('');
  const [serverArgs, setServerArgs] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverHeaders, setServerHeaders] = useState('');

  const resetForm = () => {
    setServerName('');
    setServerTransport('stdio');
    setServerCommand('');
    setServerArgs('');
    setServerUrl('');
    setServerHeaders('');
    setShowAddServer(false);
    setEditingServer(null);
  };

  // Parse headers from "Key: Value" format (one per line)
  const parseHeaders = (headersText: string): Record<string, string> | undefined => {
    if (!headersText.trim()) return undefined;
    const headers: Record<string, string> = {};
    for (const line of headersText.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  };

  // Format headers object to "Key: Value" format (one per line)
  const formatHeaders = (headers?: Record<string, string>): string => {
    if (!headers) return '';
    return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n');
  };

  const handleAddServer = () => {
    if (!serverName.trim()) return;
    if (serverTransport === 'stdio' && !serverCommand.trim()) return;
    if ((serverTransport === 'sse' || serverTransport === 'streamable-http' || serverTransport === 'http') && !serverUrl.trim()) return;

    const newServer: MCPServerConfig = {
      id: editingServer?.id || generateId(),
      name: serverName.trim(),
      enabled: editingServer?.enabled ?? true,
      transport: serverTransport,
      command: serverTransport === 'stdio' ? serverCommand.trim() : undefined,
      args: serverTransport === 'stdio' && serverArgs.trim()
        ? serverArgs.split(' ').filter(Boolean)
        : undefined,
      url: (serverTransport === 'sse' || serverTransport === 'streamable-http' || serverTransport === 'http') ? serverUrl.trim() : undefined,
      headers: (serverTransport === 'sse' || serverTransport === 'streamable-http' || serverTransport === 'http') ? parseHeaders(serverHeaders) : undefined,
    };

    if (editingServer) {
      onServersChange(mcpServers.map((s) => (s.id === editingServer.id ? newServer : s)));
    } else {
      onServersChange([...mcpServers, newServer]);
    }

    resetForm();
  };

  const handleEditServer = (server: MCPServerConfig) => {
    setEditingServer(server);
    setServerName(server.name);
    setServerTransport(server.transport);
    setServerCommand(server.command || '');
    setServerArgs(server.args?.join(' ') || '');
    setServerUrl(server.url || '');
    setServerHeaders(formatHeaders(server.headers));
    setShowAddServer(true);
  };

  const handleDeleteServer = (id: string) => {
    onServersChange(mcpServers.filter((s) => s.id !== id));
  };

  const handleToggleServer = (id: string) => {
    onServersChange(
      mcpServers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleTestConnection = async (serverId: string) => {
    setTestingConnection(serverId);
    try {
      const server = mcpServers.find((s) => s.id === serverId);
      if (!server) return;

      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpServers: [server] }),
      });

      if (response.ok) {
        const data = await response.json();
        setServerStatuses(data.servers);
      }
    } catch (error) {
      console.error('Test connection failed:', error);
    } finally {
      setTestingConnection(null);
    }
  };

  const getServerStatus = (serverId: string) => {
    return serverStatuses.find((s) => s.id === serverId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">MCP Tools</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mcpEnabled}
            onChange={(e) => onMCPEnabledChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">Enable MCP</span>
        </label>
      </div>

      {mcpEnabled && (
        <>
          {/* Built-in Tools */}
          <div className="p-3 rounded-lg bg-[var(--hover-background)] space-y-3">
            <h4 className="font-medium text-sm">Built-in Tools</h4>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={builtinTools.filesystem?.enabled || false}
                onChange={(e) =>
                  onBuiltinToolsChange({
                    ...builtinTools,
                    filesystem: { ...builtinTools.filesystem, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Filesystem (read files, list directories)</span>
            </label>

            {builtinTools.filesystem?.enabled && (
              <div className="ml-6">
                <label className="block text-xs text-gray-500 mb-1">
                  Allowed paths (one per line, empty = all)
                </label>
                <textarea
                  value={builtinTools.filesystem?.allowedPaths?.join('\n') || ''}
                  onChange={(e) =>
                    onBuiltinToolsChange({
                      ...builtinTools,
                      filesystem: {
                        ...builtinTools.filesystem,
                        enabled: true,
                        allowedPaths: e.target.value.split('\n').filter(Boolean),
                      },
                    })
                  }
                  className="w-full px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--background)]"
                  rows={2}
                  placeholder="/home/user/projects"
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={builtinTools.fetch?.enabled || false}
                onChange={(e) =>
                  onBuiltinToolsChange({
                    ...builtinTools,
                    fetch: { ...builtinTools.fetch, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">URL Fetch (fetch web pages)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={builtinTools.shell?.enabled || false}
                onChange={(e) =>
                  onBuiltinToolsChange({
                    ...builtinTools,
                    shell: { ...builtinTools.shell, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Shell Execute (run commands)</span>
            </label>

            {builtinTools.shell?.enabled && (
              <div className="ml-6">
                <label className="block text-xs text-gray-500 mb-1">
                  Allowed commands (one per line, required for security)
                </label>
                <textarea
                  value={builtinTools.shell?.allowedCommands?.join('\n') || ''}
                  onChange={(e) =>
                    onBuiltinToolsChange({
                      ...builtinTools,
                      shell: {
                        ...builtinTools.shell,
                        enabled: true,
                        allowedCommands: e.target.value.split('\n').filter(Boolean),
                      },
                    })
                  }
                  className="w-full px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--background)]"
                  rows={2}
                  placeholder="ls&#10;cat&#10;git status"
                />
              </div>
            )}
          </div>

          {/* MCP Servers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">MCP Servers</h4>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddServer(true);
                }}
                className="text-sm px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                Add Server
              </button>
            </div>

            {mcpServers.length === 0 && !showAddServer && (
              <p className="text-sm text-gray-500 text-center py-4">
                No MCP servers configured. Add one to get started.
              </p>
            )}

            {mcpServers.map((server) => {
              const status = getServerStatus(server.id);
              return (
                <div
                  key={server.id}
                  className="p-3 rounded-lg border border-[var(--border-color)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={() => handleToggleServer(server.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="font-medium">{server.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                        {server.transport}
                      </span>
                      {status && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            status.connected
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {status.connected ? `${status.toolCount} tools` : 'disconnected'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTestConnection(server.id)}
                        disabled={testingConnection === server.id}
                        className="text-xs px-2 py-1 rounded hover:bg-[var(--hover-background)]"
                      >
                        {testingConnection === server.id ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => handleEditServer(server)}
                        className="text-xs px-2 py-1 rounded hover:bg-[var(--hover-background)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteServer(server.id)}
                        className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {server.transport === 'stdio' ? (
                      <>
                        {server.command} {server.args?.join(' ')}
                      </>
                    ) : (
                      server.url
                    )}
                  </div>
                  {status?.error && (
                    <div className="text-xs text-red-500">{status.error}</div>
                  )}
                </div>
              );
            })}

            {/* Add/Edit Server Form */}
            {showAddServer && (
              <div className="p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                <h5 className="font-medium text-sm">
                  {editingServer ? 'Edit Server' : 'Add Server'}
                </h5>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
                    placeholder="My MCP Server"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Transport</label>
                  <select
                    value={serverTransport}
                    onChange={(e) => setServerTransport(e.target.value as 'stdio' | 'sse' | 'streamable-http' | 'http')}
                    className="w-full px-2 py-1 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
                  >
                    <option value="stdio">stdio (local process)</option>
                    <option value="http">HTTP (recommended for remote servers)</option>
                    <option value="streamable-http">Streamable HTTP (legacy)</option>
                    <option value="sse">SSE (deprecated)</option>
                  </select>
                </div>

                {serverTransport === 'stdio' ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Command</label>
                      <input
                        type="text"
                        value={serverCommand}
                        onChange={(e) => setServerCommand(e.target.value)}
                        className="w-full px-2 py-1 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
                        placeholder="npx -y @modelcontextprotocol/server-filesystem"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Arguments (space-separated)
                      </label>
                      <input
                        type="text"
                        value={serverArgs}
                        onChange={(e) => setServerArgs(e.target.value)}
                        className="w-full px-2 py-1 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
                        placeholder="/path/to/directory"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">URL</label>
                      <input
                        type="text"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        className="w-full px-2 py-1 text-sm rounded border border-[var(--border-color)] bg-[var(--background)]"
                        placeholder={serverTransport === 'sse' ? 'http://localhost:3001/sse' : 'http://localhost:3001/mcp'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Headers (one per line, format: Key: Value)
                      </label>
                      <textarea
                        value={serverHeaders}
                        onChange={(e) => setServerHeaders(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded border border-[var(--border-color)] bg-[var(--background)] font-mono"
                        rows={2}
                        placeholder="Authorization: Bearer your-token-here"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={resetForm}
                    className="text-sm px-3 py-1 rounded border border-[var(--border-color)] hover:bg-[var(--hover-background)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddServer}
                    className="text-sm px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                  >
                    {editingServer ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
