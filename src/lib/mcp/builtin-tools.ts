import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { UnifiedTool, BuiltinToolsConfig } from '@/types';
import type { MCPCallToolResult } from './types';

const execAsync = promisify(exec);

// Security validation helpers

function isPathAllowed(targetPath: string, allowedPaths: string[]): boolean {
  if (allowedPaths.length === 0) {
    return true; // No restrictions
  }

  const normalizedTarget = path.resolve(targetPath);

  for (const allowed of allowedPaths) {
    const normalizedAllowed = path.resolve(allowed);
    if (
      normalizedTarget === normalizedAllowed ||
      normalizedTarget.startsWith(normalizedAllowed + path.sep)
    ) {
      return true;
    }
  }

  return false;
}

function isDomainAllowed(url: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) {
    return true; // No restrictions
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    for (const domain of allowedDomains) {
      const normalizedDomain = domain.toLowerCase();
      if (
        hostname === normalizedDomain ||
        hostname.endsWith('.' + normalizedDomain)
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function isCommandAllowed(command: string, allowedCommands: string[]): boolean {
  if (allowedCommands.length === 0) {
    return false; // Shell disabled by default if no allowlist
  }

  const baseCommand = command.split(/\s+/)[0];

  for (const allowed of allowedCommands) {
    if (baseCommand === allowed || command.startsWith(allowed + ' ')) {
      return true;
    }
  }

  return false;
}

// Built-in tool implementations

export async function filesystemRead(
  targetPath: string,
  config: BuiltinToolsConfig
): Promise<MCPCallToolResult> {
  const fsConfig = config.filesystem;

  if (!fsConfig?.enabled) {
    return {
      content: [{ type: 'text', text: 'Filesystem access is disabled' }],
      isError: true,
    };
  }

  if (!isPathAllowed(targetPath, fsConfig.allowedPaths || [])) {
    return {
      content: [
        {
          type: 'text',
          text: `Access denied: ${targetPath} is not in the allowed paths`,
        },
      ],
      isError: true,
    };
  }

  try {
    const content = await fs.readFile(targetPath, 'utf-8');
    return {
      content: [{ type: 'text', text: content }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

export async function filesystemList(
  targetPath: string,
  config: BuiltinToolsConfig
): Promise<MCPCallToolResult> {
  const fsConfig = config.filesystem;

  if (!fsConfig?.enabled) {
    return {
      content: [{ type: 'text', text: 'Filesystem access is disabled' }],
      isError: true,
    };
  }

  if (!isPathAllowed(targetPath, fsConfig.allowedPaths || [])) {
    return {
      content: [
        {
          type: 'text',
          text: `Access denied: ${targetPath} is not in the allowed paths`,
        },
      ],
      isError: true,
    };
  }

  try {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const formatted = entries
      .map((entry) => {
        const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
        return `${type} ${entry.name}`;
      })
      .join('\n');

    return {
      content: [{ type: 'text', text: formatted || '(empty directory)' }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing directory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

export async function fetchUrl(
  url: string,
  config: BuiltinToolsConfig
): Promise<MCPCallToolResult> {
  const fetchConfig = config.fetch;

  if (!fetchConfig?.enabled) {
    return {
      content: [{ type: 'text', text: 'URL fetching is disabled' }],
      isError: true,
    };
  }

  if (!isDomainAllowed(url, fetchConfig.allowedDomains || [])) {
    return {
      content: [
        {
          type: 'text',
          text: `Access denied: ${url} is not in the allowed domains`,
        },
      ],
      isError: true,
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ChatInterface/1.0',
      },
      // Don't follow redirects to different hosts (SSRF prevention)
      redirect: 'manual',
    });

    // Check for redirect to different host
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const originalHost = new URL(url).host;
        const redirectHost = new URL(location, url).host;
        if (originalHost !== redirectHost) {
          return {
            content: [
              {
                type: 'text',
                text: `Redirect to different host blocked: ${location}`,
              },
            ],
            isError: true,
          };
        }
      }
    }

    const text = await response.text();

    // Limit response size
    const maxSize = 100000; // 100KB
    const truncated =
      text.length > maxSize ? text.slice(0, maxSize) + '\n...(truncated)' : text;

    return {
      content: [
        {
          type: 'text',
          text: `Status: ${response.status}\n\n${truncated}`,
        },
      ],
      isError: !response.ok,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

export async function shellExecute(
  command: string,
  config: BuiltinToolsConfig
): Promise<MCPCallToolResult> {
  const shellConfig = config.shell;

  if (!shellConfig?.enabled) {
    return {
      content: [{ type: 'text', text: 'Shell execution is disabled' }],
      isError: true,
    };
  }

  if (!isCommandAllowed(command, shellConfig.allowedCommands || [])) {
    return {
      content: [
        {
          type: 'text',
          text: `Command not allowed: ${command}. Allowed commands: ${shellConfig.allowedCommands?.join(', ') || 'none'}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024, // 1MB max output
    });

    let output = '';
    if (stdout) output += `stdout:\n${stdout}\n`;
    if (stderr) output += `stderr:\n${stderr}`;

    return {
      content: [{ type: 'text', text: output || '(no output)' }],
      isError: false,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    let output = `Error: ${execError.message || String(error)}\n`;
    if (execError.stdout) output += `stdout:\n${execError.stdout}\n`;
    if (execError.stderr) output += `stderr:\n${execError.stderr}`;

    return {
      content: [{ type: 'text', text: output }],
      isError: true,
    };
  }
}

// Get tool definitions for enabled built-in tools

export function getBuiltinTools(config: BuiltinToolsConfig): UnifiedTool[] {
  const tools: UnifiedTool[] = [];

  if (config.filesystem?.enabled) {
    tools.push({
      source: 'builtin',
      name: 'filesystem_read',
      description: 'Read the contents of a file at the specified path',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to read',
          },
        },
        required: ['path'],
      },
    });

    tools.push({
      source: 'builtin',
      name: 'filesystem_list',
      description: 'List the contents of a directory at the specified path',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the directory to list',
          },
        },
        required: ['path'],
      },
    });
  }

  if (config.fetch?.enabled) {
    tools.push({
      source: 'builtin',
      name: 'fetch_url',
      description: 'Fetch the content of a URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch',
          },
        },
        required: ['url'],
      },
    });
  }

  if (config.shell?.enabled) {
    tools.push({
      source: 'builtin',
      name: 'shell_execute',
      description:
        'Execute a shell command. Only allowed commands can be executed.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute',
          },
        },
        required: ['command'],
      },
    });
  }

  return tools;
}

// Execute a built-in tool

export async function executeBuiltinTool(
  toolName: string,
  params: Record<string, unknown>,
  config: BuiltinToolsConfig
): Promise<MCPCallToolResult> {
  switch (toolName) {
    case 'filesystem_read':
      return filesystemRead(params.path as string, config);

    case 'filesystem_list':
      return filesystemList(params.path as string, config);

    case 'fetch_url':
      return fetchUrl(params.url as string, config);

    case 'shell_execute':
      return shellExecute(params.command as string, config);

    default:
      return {
        content: [{ type: 'text', text: `Unknown built-in tool: ${toolName}` }],
        isError: true,
      };
  }
}
