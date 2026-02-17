import { promises as fs, realpathSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as dns from 'dns';
import * as net from 'net';
import type { UnifiedTool, BuiltinToolsConfig } from '@/types';
import type { MCPCallToolResult } from './types';

const execFileAsync = promisify(execFile);

// Security validation helpers

/** Shell metacharacters that indicate command injection attempts */
const SHELL_METACHARACTERS = /[;|&$`(){}<>\n\\]/;

function isPathAllowed(targetPath: string, allowedPaths: string[]): boolean {
  if (allowedPaths.length === 0) {
    return true; // No restrictions
  }

  try {
    // Use realpathSync to resolve symlinks, preventing TOCTOU attacks
    const normalizedTarget = realpathSync(targetPath);

    for (const allowed of allowedPaths) {
      try {
        const normalizedAllowed = realpathSync(allowed);
        if (
          normalizedTarget === normalizedAllowed ||
          normalizedTarget.startsWith(normalizedAllowed + path.sep)
        ) {
          return true;
        }
      } catch {
        // If allowed path doesn't exist, skip it
        continue;
      }
    }
  } catch {
    // For new files that don't exist yet, resolve the parent directory
    const parentDir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);
    try {
      const resolvedParent = realpathSync(parentDir);
      const resolvedTarget = path.join(resolvedParent, baseName);

      for (const allowed of allowedPaths) {
        try {
          const normalizedAllowed = realpathSync(allowed);
          if (
            resolvedTarget === normalizedAllowed ||
            resolvedTarget.startsWith(normalizedAllowed + path.sep)
          ) {
            return true;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Parent directory doesn't exist either - reject
      return false;
    }
  }

  return false;
}

/** Check if a string looks like an IP address (v4 or v6) */
function isIPAddress(hostname: string): boolean {
  return net.isIP(hostname) !== 0;
}

/** Check if an IP address is in a private/reserved range */
function isPrivateIP(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 0.0.0.0
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  }

  // IPv6 private/reserved ranges
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 (loopback)
    if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
    // :: (unspecified)
    if (normalized === '::') return true;
    // fc00::/7 (unique local)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // fe80::/10 (link-local)
    if (normalized.startsWith('fe80')) return true;
    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const v4mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (v4mapped) return isPrivateIP(v4mapped[1]);
    return false;
  }

  return false;
}

/**
 * Validate a URL for SSRF protection:
 * - Only http: and https: protocols allowed
 * - No private/reserved IP addresses
 * - DNS resolution check to prevent DNS rebinding
 */
async function validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }

  // Protocol whitelist
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol not allowed: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname;

  // Block direct IP addresses unless they're in allowed domains
  if (isIPAddress(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: `Private IP address blocked: ${hostname}` };
    }
    // Allow public IPs (they'll still need to pass domain allowlist if configured)
    return { valid: true };
  }

  // Resolve hostname and check for private IPs (DNS rebinding protection)
  try {
    const dnsLookup = promisify(dns.lookup);
    const result = await dnsLookup(hostname);
    if (isPrivateIP(result.address)) {
      return { valid: false, error: `Hostname ${hostname} resolves to private IP: ${result.address}` };
    }
  } catch {
    return { valid: false, error: `Could not resolve hostname: ${hostname}` };
  }

  return { valid: true };
}

function isDomainAllowed(url: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) {
    return true; // No restrictions
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block IP-based URLs unless the exact IP is in the allowlist
    if (isIPAddress(hostname)) {
      return allowedDomains.some(d => d.toLowerCase() === hostname);
    }

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

/**
 * Parse and validate a shell command string.
 * Tokenizes respecting quoted strings, validates base command against allowlist,
 * and rejects arguments containing shell metacharacters.
 * Returns parsed command + args, or null if rejected.
 */
function parseAndValidateCommand(
  command: string,
  allowedCommands: string[]
): { command: string; args: string[] } | null {
  if (allowedCommands.length === 0) {
    return null; // Shell disabled by default if no allowlist
  }

  // Tokenize the command string respecting quoted strings
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);

  // Unclosed quotes
  if (inSingle || inDouble) {
    return null;
  }

  if (tokens.length === 0) {
    return null;
  }

  const baseCommand = tokens[0];
  const args = tokens.slice(1);

  // Validate base command against allowlist
  if (!allowedCommands.includes(baseCommand)) {
    return null;
  }

  // Reject arguments containing shell metacharacters
  for (const arg of args) {
    if (SHELL_METACHARACTERS.test(arg)) {
      return null;
    }
  }

  return { command: baseCommand, args };
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

// HTML cleaning helpers for fetch_url

/** Extract <title> text from HTML */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
}

/** Extract the main content region from HTML */
function extractMainContent(html: string): { content: string; isolated: boolean } {
  // Try <main> first
  const mainMatch = html.match(/<main[\s>][\s\S]*?<\/main>/i);
  if (mainMatch) return { content: mainMatch[0], isolated: true };

  // Try <article> (use the longest one as a heuristic for "largest")
  const articleMatches = html.match(/<article[\s>][\s\S]*?<\/article>/gi);
  if (articleMatches && articleMatches.length > 0) {
    const longest = articleMatches.reduce((a, b) => (a.length >= b.length ? a : b));
    return { content: longest, isolated: true };
  }

  // Try <div role="main">
  const roleMainMatch = html.match(/<div[^>]+role\s*=\s*["']main["'][^>]*>[\s\S]*?<\/div>/i);
  if (roleMainMatch) return { content: roleMainMatch[0], isolated: true };

  // Try <body>
  const bodyMatch = html.match(/<body[\s>][\s\S]*?<\/body>/i);
  if (bodyMatch) return { content: bodyMatch[0], isolated: false };

  return { content: html, isolated: false };
}

/** Remove noise elements and their content */
function removeNoiseTags(html: string, isolated: boolean): string {
  const alwaysRemove = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'aside', 'iframe', 'form', 'select'];
  const tags = isolated ? [...alwaysRemove, 'header'] : alwaysRemove;
  let result = html;
  for (const tag of tags) {
    result = result.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    // Also remove self-closing variants
    result = result.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), '');
  }
  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  return result;
}

/** Convert structural HTML elements to plain text equivalents */
function convertStructuralElements(html: string): string {
  let text = html;

  // Convert headings to markdown-style
  for (let i = 1; i <= 6; i++) {
    const prefix = '#'.repeat(i);
    text = text.replace(
      new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'),
      (_, content) => `\n\n${prefix} ${content.trim()}\n\n`
    );
  }

  // Convert <pre> to fenced code blocks
  text = text.replace(
    /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_, content) => `\n\n\`\`\`\n${content}\n\`\`\`\n\n`
  );
  text = text.replace(
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    (_, content) => `\n\n\`\`\`\n${content}\n\`\`\`\n\n`
  );

  // Convert inline code
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Convert bold/strong
  text = text.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**');

  // Convert italic/em
  text = text.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*');

  // Convert links: <a href="url">text</a> -> text (url)
  text = text.replace(
    /<a[^>]+href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, linkText) => {
      const cleanText = linkText.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return cleanText;
      }
      return cleanText === href ? href : `${cleanText} (${href})`;
    }
  );

  // Convert table cells
  text = text.replace(/<\/th>\s*<th[^>]*>/gi, ' | ');
  text = text.replace(/<\/td>\s*<td[^>]*>/gi, ' | ');
  text = text.replace(/<tr[^>]*>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '');

  // Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `\n- ${content.trim()}`);

  // Convert paragraphs and line breaks
  text = text.replace(/<p[^>]*>/gi, '\n\n');
  text = text.replace(/<\/p>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Convert blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.trim().split('\n').map((line: string) => `> ${line}`).join('\n');
  });

  return text;
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&bull;': '\u2022',
    '&hellip;': '\u2026',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }

  // Decode numeric entities: &#123; and &#x1A;
  result = result.replace(/&#(\d+);/g, (_, num) => {
    const code = parseInt(num, 10);
    return code > 0 && code < 0x10FFFF ? String.fromCodePoint(code) : '';
  });
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return code > 0 && code < 0x10FFFF ? String.fromCodePoint(code) : '';
  });

  return result;
}

/** Collapse whitespace and limit consecutive newlines */
function normalizeWhitespace(text: string): string {
  // Strip all remaining HTML tags
  let result = text.replace(/<[^>]+>/g, '');
  // Collapse runs of spaces/tabs (but not newlines)
  result = result.replace(/[^\S\n]+/g, ' ');
  // Trim each line
  result = result.split('\n').map(line => line.trim()).join('\n');
  // Limit consecutive newlines to 2
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

/** Clean HTML to readable plain text */
function cleanHtml(html: string): { title: string | null; content: string } {
  const title = extractTitle(html);
  const { content: mainContent, isolated } = extractMainContent(html);
  const stripped = removeNoiseTags(mainContent, isolated);
  const converted = convertStructuralElements(stripped);
  const decoded = decodeHtmlEntities(converted);
  const normalized = normalizeWhitespace(decoded);
  return { title, content: normalized };
}

/** Content types that indicate binary data */
const BINARY_CONTENT_TYPES = [
  'image/', 'audio/', 'video/', 'application/pdf', 'application/zip',
  'application/gzip', 'application/octet-stream', 'application/wasm',
  'font/', 'application/x-tar',
];

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

  // SSRF protection: validate URL before fetching
  const urlValidation = await validateUrl(url);
  if (!urlValidation.valid) {
    return {
      content: [
        {
          type: 'text',
          text: `URL blocked: ${urlValidation.error}`,
        },
      ],
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
    let currentUrl = url;
    let response: Response | null = null;
    const maxRedirects = 5;

    // Follow redirects manually with SSRF validation at each hop
    for (let i = 0; i <= maxRedirects; i++) {
      response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'ChatInterface/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break; // No location header, stop redirecting

        const redirectUrl = new URL(location, currentUrl).href;

        // Validate redirect URL for SSRF
        const redirectValidation = await validateUrl(redirectUrl);
        if (!redirectValidation.valid) {
          return {
            content: [{ type: 'text', text: `Redirect blocked: ${redirectValidation.error}` }],
            isError: true,
          };
        }

        // Also check redirect against domain allowlist
        if (!isDomainAllowed(redirectUrl, fetchConfig.allowedDomains || [])) {
          return {
            content: [{ type: 'text', text: `Redirect to different domain blocked: ${location}` }],
            isError: true,
          };
        }

        currentUrl = redirectUrl;
        continue;
      }

      break; // Not a redirect, we're done
    }

    if (!response) {
      return {
        content: [{ type: 'text', text: 'Error fetching URL: no response received' }],
        isError: true,
      };
    }

    // Check for binary content types — don't read body as text
    const contentType = response.headers.get('content-type') || '';
    const isBinary = BINARY_CONTENT_TYPES.some(prefix => contentType.toLowerCase().includes(prefix));
    if (isBinary) {
      const contentLength = response.headers.get('content-length');
      const sizeInfo = contentLength ? ` (${Math.round(parseInt(contentLength) / 1024)} KB)` : '';
      return {
        content: [{
          type: 'text',
          text: `URL: ${currentUrl}\nStatus: ${response.status}\nContent-Type: ${contentType}\n\nBinary content detected${sizeInfo}. This content type cannot be displayed as text.`,
        }],
        isError: false,
      };
    }

    const rawText = await response.text();

    // Detect content type
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
    const isJson = contentType.includes('application/json') || contentType.includes('+json');
    const looksLikeHtml = !isHtml && /^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(rawText.slice(0, 500));

    let processedContent: string;
    let title: string | null = null;
    let contentTypeLabel: string;

    if (isHtml || looksLikeHtml) {
      // Cap raw HTML at 5MB before running regexes
      const htmlToProcess = rawText.length > 5_000_000 ? rawText.slice(0, 5_000_000) : rawText;
      const cleaned = cleanHtml(htmlToProcess);
      title = cleaned.title;
      processedContent = cleaned.content;
      contentTypeLabel = 'HTML (cleaned)';

      // SPA fallback: if cleaned content is essentially empty
      if (processedContent.length < 50) {
        processedContent = 'Page content appears to be dynamically rendered via JavaScript and could not be extracted.';
      }
    } else if (isJson) {
      contentTypeLabel = 'JSON';
      try {
        const parsed = JSON.parse(rawText);
        processedContent = JSON.stringify(parsed, null, 2);
      } catch {
        processedContent = rawText;
      }
    } else {
      contentTypeLabel = contentType || 'unknown';
      processedContent = rawText;
    }

    // Limit processed content size
    const maxSize = 100_000; // 100KB
    if (processedContent.length > maxSize) {
      processedContent = processedContent.slice(0, maxSize) + '\n...(truncated)';
    }

    // Build structured response
    const parts = [`URL: ${currentUrl}`, `Status: ${response.status}`];
    if (title) parts.push(`Title: ${title}`);
    parts.push(`Content-Type: ${contentTypeLabel}`);
    parts.push('', processedContent);

    return {
      content: [{ type: 'text', text: parts.join('\n') }],
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

  const parsed = parseAndValidateCommand(command, shellConfig.allowedCommands || []);
  if (!parsed) {
    return {
      content: [
        {
          type: 'text',
          text: `Command not allowed: ${command}. Allowed commands: ${shellConfig.allowedCommands?.join(', ') || 'none'}. Arguments must not contain shell metacharacters.`,
        },
      ],
      isError: true,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(parsed.command, parsed.args, {
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
      description: 'Fetch a URL and extract its readable content. HTML pages are automatically cleaned to plain text with scripts, styles, and navigation removed. JSON responses are pretty-printed.',
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
    case 'filesystem_read': {
      if (typeof params.path !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid parameter: "path" must be a string' }],
          isError: true,
        };
      }
      return filesystemRead(params.path, config);
    }

    case 'filesystem_list': {
      if (typeof params.path !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid parameter: "path" must be a string' }],
          isError: true,
        };
      }
      return filesystemList(params.path, config);
    }

    case 'fetch_url': {
      if (typeof params.url !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid parameter: "url" must be a string' }],
          isError: true,
        };
      }
      return fetchUrl(params.url, config);
    }

    case 'shell_execute': {
      if (typeof params.command !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid parameter: "command" must be a string' }],
          isError: true,
        };
      }
      return shellExecute(params.command, config);
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown built-in tool: ${toolName}` }],
        isError: true,
      };
  }
}
