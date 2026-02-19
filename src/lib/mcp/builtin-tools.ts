import { promises as fs, realpathSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as dns from 'dns';
import * as net from 'net';
import { parse as parseHtml, Node, HTMLElement as NHTMLElement } from 'node-html-parser';
import type { UnifiedTool, BuiltinToolsConfig } from '@/types';
import type { MCPCallToolResult } from './types';

// SQLite types and lazy loader
type Database = import('better-sqlite3').Database;

// Connection cache: key = "path:readonly"
const dbCache = new Map<string, Database>();

// Lazily loaded better-sqlite3 constructor (avoids breaking the entire module if native addon is missing)
let _BetterSqlite3: typeof import('better-sqlite3') | null = null;

function getBetterSqlite3(): typeof import('better-sqlite3') {
  if (!_BetterSqlite3) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
    } catch (e) {
      throw new Error(
        `better-sqlite3 native module failed to load: ${e instanceof Error ? e.message : String(e)}. ` +
        'Run "npm rebuild better-sqlite3" or reinstall with "npm install better-sqlite3".'
      );
    }
  }
  return _BetterSqlite3;
}

function getDb(dbPath: string, readOnly: boolean): Database {
  const BetterSqlite3 = getBetterSqlite3();
  const key = `${dbPath}:${readOnly}`;
  if (!dbCache.has(key)) {
    const db = new BetterSqlite3(dbPath, { readonly: readOnly, fileMustExist: true });
    dbCache.set(key, db);
  }
  return dbCache.get(key)!;
}

/** Returns true if the SQL statement mutates data or schema */
function isMutatingSQL(sql: string): boolean {
  const trimmed = sql.trimStart().toUpperCase();
  return /^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|VACUUM)\b/.test(trimmed);
}

const SQL_MAX_ROWS = 500;

/** Result shape for SELECT queries */
interface SqlSelectResult {
  __sql_result__: true;
  type: 'select';
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
}

/** Result shape for mutating statements */
interface SqlMutateResult {
  __sql_result__: true;
  type: 'mutate';
  statement: string;
  changes: number;
  lastInsertRowid: number | bigint;
}

export async function executeSql(
  query: string,
  config: BuiltinToolsConfig
): Promise<MCPCallToolResult> {
  const sqliteConfig = config.sqlite;

  if (!sqliteConfig?.enabled) {
    return { content: [{ type: 'text', text: 'SQLite access is disabled' }], isError: true };
  }

  if (!sqliteConfig.databasePath) {
    return { content: [{ type: 'text', text: 'No database path configured' }], isError: true };
  }

  const readOnly = sqliteConfig.readOnly !== false; // default true

  if (readOnly && isMutatingSQL(query)) {
    return {
      content: [{ type: 'text', text: 'Mutation not allowed: database is opened in read-only mode' }],
      isError: true,
    };
  }

  try {
    const db = getDb(sqliteConfig.databasePath, readOnly);
    const stmt = db.prepare(query);

    const isSelect = !isMutatingSQL(query);

    if (isSelect) {
      const rawRows = stmt.all() as Record<string, unknown>[];
      const truncated = rawRows.length > SQL_MAX_ROWS;
      const limited = truncated ? rawRows.slice(0, SQL_MAX_ROWS) : rawRows;
      const columns = limited.length > 0 ? Object.keys(limited[0]) : stmt.columns().map((c) => c.name);
      const rows = limited.map((r) => columns.map((c) => r[c]));

      const result: SqlSelectResult = {
        __sql_result__: true,
        type: 'select',
        columns,
        rows,
        rowCount: truncated ? rawRows.length : rows.length,
        truncated,
      };
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
    } else {
      const info = stmt.run();
      const result: SqlMutateResult = {
        __sql_result__: true,
        type: 'mutate',
        statement: query.trimStart().toUpperCase().split(/\s+/)[0],
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
      };
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `SQL error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}

export async function getDbSchema(
  config: BuiltinToolsConfig,
  tableName?: string
): Promise<MCPCallToolResult> {
  const sqliteConfig = config.sqlite;

  if (!sqliteConfig?.enabled) {
    return { content: [{ type: 'text', text: 'SQLite access is disabled' }], isError: true };
  }

  if (!sqliteConfig.databasePath) {
    return { content: [{ type: 'text', text: 'No database path configured' }], isError: true };
  }

  try {
    const db = getDb(sqliteConfig.databasePath, true); // always read-only for schema

    // Get list of tables (or just the requested one)
    const tableRows = db.prepare(
      tableName
        ? `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        : `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all(...(tableName ? [tableName] : [])) as { name: string }[];

    const tables: Record<string, unknown>[] = [];

    for (const { name } of tableRows) {
      const columns = db.prepare(`PRAGMA table_info(${JSON.stringify(name)})`).all() as {
        cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number;
      }[];

      const fkeys = db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(name)})`).all() as {
        id: number; seq: number; table: string; from: string; to: string;
      }[];

      const indexList = db.prepare(`PRAGMA index_list(${JSON.stringify(name)})`).all() as {
        seq: number; name: string; unique: number; origin: string; partial: number;
      }[];

      const indexes: { name: string; unique: boolean; columns: string[] }[] = [];
      for (const idx of indexList) {
        const idxCols = db.prepare(`PRAGMA index_info(${JSON.stringify(idx.name)})`).all() as {
          seqno: number; cid: number; name: string;
        }[];
        indexes.push({ name: idx.name, unique: idx.unique === 1, columns: idxCols.map((c) => c.name) });
      }

      let rowCount = 0;
      try {
        const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM ${JSON.stringify(name)}`).get() as { cnt: number };
        rowCount = countRow.cnt;
      } catch {
        // ignore count errors for virtual tables etc.
      }

      tables.push({
        name,
        rowCount,
        columns: columns.map((c) => ({
          name: c.name,
          type: c.type,
          notNull: c.notnull === 1,
          defaultValue: c.dflt_value,
          primaryKey: c.pk > 0,
        })),
        foreignKeys: fkeys.map((f) => ({ from: f.from, toTable: f.table, toColumn: f.to })),
        indexes,
      });
    }

    const schema = { tables };
    return { content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }], isError: false };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Schema error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}

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

const NOISE_TAGS = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'aside', 'iframe', 'form', 'select'];
const NOISE_TAGS_ISOLATED = [...NOISE_TAGS, 'header'];

/** Convert a node-html-parser subtree to Markdown text */
function nodeToMarkdown(node: Node): string {
  // Text node
  if (node.nodeType === 3) {
    return node.rawText;
  }

  const el = node as NHTMLElement;
  const tag = (el.rawTagName || '').toLowerCase();
  const children = () => el.childNodes.map(nodeToMarkdown).join('');

  // Headings
  const headingLevel = tag.match(/^h([1-6])$/);
  if (headingLevel) {
    const prefix = '#'.repeat(Number(headingLevel[1]));
    return `\n\n${prefix} ${children().trim()}\n\n`;
  }

  switch (tag) {
    case 'pre': {
      const codeNode = el.querySelector('code');
      const content = codeNode ? codeNode.innerText : el.innerText;
      return `\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
    }
    case 'code':
      return `\`${el.innerText}\``;
    case 'b':
    case 'strong':
      return `**${children().trim()}**`;
    case 'i':
    case 'em':
      return `*${children().trim()}*`;
    case 'a': {
      const href = el.getAttribute('href') || '';
      const text = children().trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return text;
      return text === href ? href : `${text} (${href})`;
    }
    case 'li':
      return `\n- ${children().trim()}`;
    case 'p':
      return `\n\n${children().trim()}\n\n`;
    case 'br':
      return '\n';
    case 'hr':
      return '\n---\n';
    case 'blockquote':
      return children().trim().split('\n').map((l: string) => `> ${l}`).join('\n');
    case 'tr':
      return `\n${children()}`;
    case 'td':
    case 'th':
      return `${children().trim()} | `;
    default:
      return children();
  }
}

/** Clean HTML to readable Markdown using node-html-parser */
function cleanHtml(html: string): { title: string | null; content: string } {
  const root = parseHtml(html, { blockTextElements: { pre: true } });

  const title = root.querySelector('title')?.innerText?.trim() ?? null;

  // Find main content region (first match wins)
  const contentRoot =
    root.querySelector('main') ??
    root.querySelector('article') ??
    root.querySelector('[role="main"]') ??
    root.querySelector('body') ??
    root;

  const isolated = contentRoot !== root && contentRoot.rawTagName !== 'body';

  // Remove noise tags in-place
  const noiseTags = isolated ? NOISE_TAGS_ISOLATED : NOISE_TAGS;
  for (const tag of noiseTags) {
    contentRoot.querySelectorAll(tag).forEach(el => el.remove());
  }

  const markdown = nodeToMarkdown(contentRoot);

  // Normalize whitespace
  let content = markdown
    .replace(/[^\S\n]+/g, ' ')
    .split('\n').map((l: string) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, content };
}

/** Content types that indicate binary data */
const BINARY_CONTENT_TYPES = [
  'image/', 'audio/', 'video/', 'application/pdf', 'application/zip',
  'application/gzip', 'application/octet-stream', 'application/wasm',
  'font/', 'application/x-tar',
];

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_MAX_SIZE = 5_000; // default page size (model can paginate with start_index)

export async function fetchUrl(
  url: string,
  config: BuiltinToolsConfig,
  options: { startIndex?: number; maxLength?: number; raw?: boolean } = {}
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
      content: [{ type: 'text', text: `URL blocked: ${urlValidation.error}` }],
      isError: true,
    };
  }

  if (!isDomainAllowed(url, fetchConfig.allowedDomains || [])) {
    return {
      content: [{ type: 'text', text: `Access denied: ${url} is not in the allowed domains` }],
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
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;

        const redirectUrl = new URL(location, currentUrl).href;

        const redirectValidation = await validateUrl(redirectUrl);
        if (!redirectValidation.valid) {
          return {
            content: [{ type: 'text', text: `Redirect blocked: ${redirectValidation.error}` }],
            isError: true,
          };
        }

        if (!isDomainAllowed(redirectUrl, fetchConfig.allowedDomains || [])) {
          return {
            content: [{ type: 'text', text: `Redirect to different domain blocked: ${location}` }],
            isError: true,
          };
        }

        currentUrl = redirectUrl;
        continue;
      }

      break;
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

    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
    const isJson = contentType.includes('application/json') || contentType.includes('+json');
    const looksLikeHtml = !isHtml && /^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(rawText.slice(0, 500));

    let processedContent: string;
    let title: string | null = null;
    let contentTypeLabel: string;

    if (options.raw) {
      // Raw mode: return content as-is without any HTML cleaning
      processedContent = rawText;
      contentTypeLabel = contentType || 'unknown';
    } else if (isHtml || looksLikeHtml) {
      const cleaned = cleanHtml(rawText);
      title = cleaned.title;
      processedContent = cleaned.content;
      contentTypeLabel = 'HTML (cleaned)';

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

    // Apply pagination
    const startIndex = options.startIndex ?? 0;
    const maxLength = options.maxLength ?? FETCH_MAX_SIZE;
    const totalLength = processedContent.length;
    const page = processedContent.slice(startIndex, startIndex + maxLength);
    const hasMore = startIndex + maxLength < totalLength;

    // Build structured response
    const parts = [`URL: ${currentUrl}`, `Status: ${response.status}`];
    if (title) parts.push(`Title: ${title}`);
    parts.push(`Content-Type: ${contentTypeLabel}`);
    if (totalLength > maxLength) {
      parts.push(`Characters: ${startIndex + 1}-${startIndex + page.length} of ${totalLength}${hasMore ? ' (use start_index to read more)' : ''}`);
    }
    parts.push('', page);

    return {
      content: [{ type: 'text', text: parts.join('\n') }],
      isError: !response.ok,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error fetching URL: ${msg}` }],
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
      description: 'Fetch a URL and extract its readable content. HTML pages are cleaned to Markdown with noise (scripts, styles, nav) removed. JSON responses are pretty-printed. For large pages use start_index to read in chunks.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch',
          },
          start_index: {
            type: 'number',
            description: 'Character offset to start reading from (default: 0). Use to paginate through large pages.',
          },
          max_length: {
            type: 'number',
            description: `Maximum number of characters to return (default: ${FETCH_MAX_SIZE}). Reduce for faster responses.`,
          },
          raw: {
            type: 'boolean',
            description: 'If true, return raw content without HTML cleaning or JSON formatting.',
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

  if (config.sqlite?.enabled) {
    tools.push({
      source: 'builtin',
      name: 'execute_sql',
      description:
        'Query the connected SQLite database. Use this when the user asks about data stored in the database, wants to look up records, run analytics, or explore table contents. Write a SQL query (SELECT, PRAGMA, WITH) and get results as JSON with columns and rows. Max 500 rows returned. Call get_db_schema first if you need to discover table and column names.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The SQL query to execute (e.g. SELECT * FROM users LIMIT 10)',
          },
        },
        required: ['query'],
      },
    });

    tools.push({
      source: 'builtin',
      name: 'get_db_schema',
      description:
        'Discover the structure of the connected SQLite database. Use this before execute_sql to learn which tables and columns exist. Returns table names, column names and types, primary keys, foreign keys, indexes, and row counts. Always call this first when the user asks about the database.',
      parameters: {
        type: 'object',
        properties: {
          table_name: {
            type: 'string',
            description: 'Get schema for this specific table only. If omitted, returns schema for all tables.',
          },
        },
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
      return fetchUrl(params.url, config, {
        startIndex: typeof params.start_index === 'number' ? params.start_index : undefined,
        maxLength: typeof params.max_length === 'number' ? params.max_length : undefined,
        raw: typeof params.raw === 'boolean' ? params.raw : undefined,
      });
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

    case 'execute_sql': {
      if (typeof params.query !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid parameter: "query" must be a string' }],
          isError: true,
        };
      }
      return executeSql(params.query, config);
    }

    case 'get_db_schema': {
      const tableName = typeof params.table_name === 'string' ? params.table_name : undefined;
      return getDbSchema(config, tableName);
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown built-in tool: ${toolName}` }],
        isError: true,
      };
  }
}
