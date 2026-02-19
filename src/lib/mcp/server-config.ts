/**
 * Shared zod schemas for MCP server configuration validation
 */

import { z } from 'zod';

export const mcpTransportSchema = z.enum(['stdio', 'sse', 'streamable-http', 'http']);

export const mcpServerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  transport: mcpTransportSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const mcpServerConfigArraySchema = z.array(mcpServerConfigSchema);

export const builtinToolsConfigSchema = z.object({
  filesystem: z.object({
    enabled: z.boolean(),
    allowedPaths: z.array(z.string()).optional(),
  }).optional(),
  shell: z.object({
    enabled: z.boolean(),
    allowedCommands: z.array(z.string()).optional(),
  }).optional(),
  fetch: z.object({
    enabled: z.boolean(),
    allowedDomains: z.array(z.string()).optional(),
  }).optional(),
  sqlite: z.object({
    enabled: z.boolean(),
    databasePath: z.string().optional(),
    readOnly: z.boolean().optional(),
  }).optional(),
});

/**
 * Check if the request origin matches localhost or the app host.
 * Returns true if the request passes CSRF validation.
 */
export function validateCSRF(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // At least one must be present
  const source = origin || referer;
  if (!source) {
    // Same-origin requests from fetch() always include origin
    // Missing both headers suggests a cross-origin attack
    return false;
  }

  try {
    const url = new URL(source);
    const hostname = url.hostname;
    // Allow localhost and common local development hostnames
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}
