import { NextRequest } from 'next/server';
import { streamChat, ChatMessage, ToolExecutionResult } from '@/lib/providers';
import { ChatSettings, WebSearchResponse, GoogleDriveSearchResponse, UnifiedTool, ContextBreakdown, ContextBreakdownSection } from '@/types';
import { getMCPStatusAndTools } from '@/lib/mcp/manager';
import { getBuiltinTools } from '@/lib/mcp/builtin-tools';
import { builtinToolsConfigSchema, mcpServerConfigArraySchema, validateCSRF } from '@/lib/mcp/server-config';
import { estimateTokens, countInputTokensWithProviderAPI } from '@/lib/token-estimation';
import { getModelMetadata } from '@/lib/model-metadata';
import { discoverProjectSkills } from '@/lib/skills';
import { getProjectSkillsTool } from '@/lib/skills/tool';

export const dynamic = 'force-dynamic';

/**
 * Extract a detailed error message from provider SDK errors.
 * The OpenAI SDK (used by OpenAI, Mistral, Cerebras) throws APIError
 * with status, error body, code, param, and type fields.
 */
function extractErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';

  const parts: string[] = [];

  // OpenAI SDK APIError has these extra fields
  const apiErr = error as {
    status?: number;
    error?: unknown;
    code?: string | null;
    param?: string | null;
    type?: string;
    requestID?: string | null;
  };

  if (apiErr.status) {
    parts.push(`[${apiErr.status}]`);
  }

  // Try to get a meaningful message from the error body
  if (apiErr.error && typeof apiErr.error === 'object') {
    const body = apiErr.error as Record<string, unknown>;
    const msg = body.message || body.detail || body.error;
    if (typeof msg === 'string') {
      parts.push(msg);
    } else if (msg && typeof msg === 'object') {
      const nested = (msg as Record<string, unknown>).message;
      if (typeof nested === 'string') {
        parts.push(nested);
      } else {
        parts.push(JSON.stringify(msg));
      }
    } else {
      // Stringify the whole body for debugging
      parts.push(JSON.stringify(apiErr.error));
    }
  } else if (error.message) {
    parts.push(error.message);
  }

  if (apiErr.code) parts.push(`(code: ${apiErr.code})`);
  if (apiErr.param) parts.push(`(param: ${apiErr.param})`);
  if (apiErr.type) parts.push(`(type: ${apiErr.type})`);

  return parts.join(' ') || error.message || 'Unknown error';
}

function allocateProportional(values: number[], targetTotal: number): number[] {
  const safeTarget = Math.max(0, Math.floor(targetTotal));
  if (safeTarget === 0) {
    return values.map(() => 0);
  }

  const normalized = values.map((v) => Math.max(0, v));
  const sum = normalized.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) {
    const uniform = Math.floor(safeTarget / normalized.length);
    const remainder = safeTarget - uniform * normalized.length;
    return normalized.map((_, idx) => uniform + (idx < remainder ? 1 : 0));
  }

  const rawShares = normalized.map((v) => (v / sum) * safeTarget);
  const allocated = rawShares.map((share) => Math.floor(share));
  const remainder = safeTarget - allocated.reduce((acc, v) => acc + v, 0);

  if (remainder > 0) {
    const fractions = rawShares
      .map((share, idx) => ({ idx, frac: share - allocated[idx] }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < remainder; i++) {
      const target = fractions[i % fractions.length];
      allocated[target.idx] += 1;
    }
  }

  return allocated;
}

function rescaleSectionsToTotal(sections: ContextBreakdownSection[], targetTotal: number): void {
  if (sections.length === 0) return;

  const sectionValues = sections.map((section) => section.estimatedTokens);
  const scaledSectionValues = allocateProportional(sectionValues, targetTotal);

  for (let i = 0; i < sections.length; i++) {
    const originalSectionTokens = Math.max(0, sections[i].estimatedTokens);
    const newSectionTokens = scaledSectionValues[i] ?? 0;
    sections[i].estimatedTokens = newSectionTokens;

    if (sections[i].details && sections[i].details!.length > 0 && originalSectionTokens > 0) {
      const detailValues = sections[i].details!.map((detail) => detail.estimatedTokens);
      const scaledDetails = allocateProportional(detailValues, newSectionTokens);
      sections[i].details = sections[i].details!.map((detail, idx) => ({
        ...detail,
        estimatedTokens: scaledDetails[idx] ?? 0,
      }));
    }
  }
}

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const {
      messages,
      settings,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      memorySearchEnabled,
      ragEnabled,
      toolExecutions,
      artifactsEnabled,
      projectWorkspaceRoot,
      projectSkillsEnabled,
    } = body as {
      messages: ChatMessage[];
      settings: ChatSettings;
      systemPrompt?: string;
      webSearchEnabled?: boolean;
      searchResults?: WebSearchResponse;
      googleDriveEnabled?: boolean;
      driveSearchResults?: GoogleDriveSearchResponse;
      memorySearchEnabled?: boolean;
      ragEnabled?: boolean;
      toolExecutions?: ToolExecutionResult[];
      artifactsEnabled?: boolean;
      projectWorkspaceRoot?: string;
      projectSkillsEnabled?: boolean;
    };

    // Collect MCP and built-in tools if enabled
    const mcpTools: UnifiedTool[] = [];
    let projectSkillsCount = 0;

    if (settings.mcpEnabled) {
      if (settings.mcpServers && settings.mcpServers.length > 0) {
        const mcpValidation = mcpServerConfigArraySchema.safeParse(settings.mcpServers);
        if (mcpValidation.success) {
          const { tools } = await getMCPStatusAndTools(mcpValidation.data);
          mcpTools.push(...tools);
        } else {
          console.warn('[chat/route] Ignoring invalid MCP server configuration');
        }
      }
    }

    // Always load builtin tools regardless of mcpEnabled (SQLite, filesystem, etc. are independent)
    if (settings.builtinTools) {
      const builtinValidation = builtinToolsConfigSchema.safeParse(settings.builtinTools);
      if (builtinValidation.success) {
        const builtinTools = getBuiltinTools(builtinValidation.data);
        mcpTools.push(...builtinTools);
      } else {
        console.warn('[chat/route] Ignoring invalid built-in tools configuration');
      }
    }

    if (projectSkillsEnabled && projectWorkspaceRoot?.trim()) {
      try {
        const projectSkills = await discoverProjectSkills(projectWorkspaceRoot.trim());
        if (projectSkills.length > 0) {
          mcpTools.push(getProjectSkillsTool());
          projectSkillsCount = projectSkills.length;
        }
      } catch (error) {
        console.warn('[chat/route] Failed to discover project skills:', error);
      }
    }

    // Build context breakdown for the client
    const modelMeta = getModelMetadata(settings.model, settings.provider);
    const contextWindowSize = modelMeta?.contextWindow || 128_000;

    const sections: ContextBreakdownSection[] = [];
    const sectionColors = {
      system: '#3b82f6',   // blue
      tools: '#8b5cf6',    // purple
      messages: '#22c55e', // green
      toolResults: '#f97316', // orange
    };

    // System prompt
    const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
    if (systemTokens > 0) {
      sections.push({
        label: 'System Prompt',
        estimatedTokens: systemTokens,
        percentage: 0, // computed below
        color: sectionColors.system,
      });
    }

    // Tool definitions
    const allTools = [...mcpTools];
    // Count built-in search/drive/memory/rag/artifact tools that get added by providers
    let builtinToolCount = 0;
    if (webSearchEnabled) builtinToolCount++;
    if (googleDriveEnabled) builtinToolCount++;
    if (memorySearchEnabled) builtinToolCount++;
    if (ragEnabled) builtinToolCount++;
    builtinToolCount++; // ask_question
    if (artifactsEnabled) builtinToolCount += 3; // create, update, read
    if (projectSkillsCount > 0) builtinToolCount++;
    const toolDefsText = JSON.stringify(allTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })));
    const toolTokens = estimateTokens(toolDefsText) + (builtinToolCount * 150); // ~150 tokens per built-in tool
    if (toolTokens > 0 && (allTools.length > 0 || builtinToolCount > 0)) {
      sections.push({
        label: 'Tool Definitions',
        estimatedTokens: toolTokens,
        percentage: 0,
        color: sectionColors.tools,
        details: [
          ...(allTools.length > 0 ? [{ label: `MCP/Builtin tools (${allTools.length})`, estimatedTokens: estimateTokens(toolDefsText) }] : []),
          ...(builtinToolCount > 0 ? [{ label: `Search/Artifact tools (${builtinToolCount})`, estimatedTokens: builtinToolCount * 150 }] : []),
        ],
      });
    }

    // Conversation messages
    const messageDetails: { label: string; estimatedTokens: number }[] = [];
    let totalMessageTokens = 0;
    for (const msg of messages) {
      const contentTokens = estimateTokens(msg.content || '');
      const attachmentTokens = msg.attachments
        ? msg.attachments.reduce((sum: number, a: { type: string; data?: string }) => {
            // Images count ~85 tokens for low-detail, text attachments by content length
            if (a.type === 'image') return sum + 85;
            if (a.data) return sum + estimateTokens(a.data);
            return sum;
          }, 0)
        : 0;
      const msgTokens = contentTokens + attachmentTokens;
      totalMessageTokens += msgTokens;
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      const preview = (msg.content || '').slice(0, 40).replace(/\n/g, ' ');
      messageDetails.push({
        label: `${roleLabel}: ${preview}${(msg.content || '').length > 40 ? '...' : ''}`,
        estimatedTokens: msgTokens,
      });
    }
    if (totalMessageTokens > 0) {
      sections.push({
        label: 'Conversation Messages',
        estimatedTokens: totalMessageTokens,
        percentage: 0,
        color: sectionColors.messages,
        details: messageDetails,
      });
    }

    // Tool execution results
    let toolResultTokens = 0;
    const toolResultDetails: { label: string; estimatedTokens: number }[] = [];
    if (toolExecutions && toolExecutions.length > 0) {
      for (const exec of toolExecutions) {
        const resultStr = typeof exec.result === 'string' ? exec.result : JSON.stringify(exec.result);
        const tokens = estimateTokens(resultStr);
        toolResultTokens += tokens;
        toolResultDetails.push({
          label: `${exec.toolName} result`,
          estimatedTokens: tokens,
        });
      }
      sections.push({
        label: 'Tool Results',
        estimatedTokens: toolResultTokens,
        percentage: 0,
        color: sectionColors.toolResults,
        details: toolResultDetails,
      });
    }

    const heuristicTotalTokens = systemTokens + toolTokens + totalMessageTokens + toolResultTokens;

    // Try provider-native token counting for an authoritative total, then
    // redistribute section estimates proportionally to match it.
    let totalEstimatedTokens = heuristicTotalTokens;
    let countingMethod: ContextBreakdown['countingMethod'] = 'heuristic';
    let countingSource = 'local.heuristic';

    const providerCount = await countInputTokensWithProviderAPI({
      messages,
      settings,
      systemPrompt,
      webSearchEnabled,
      searchResults,
      googleDriveEnabled,
      driveSearchResults,
      memorySearchEnabled,
      mcpTools,
      toolExecutions,
      ragEnabled,
      artifactsEnabled,
    });

    if (providerCount && providerCount.totalTokens > 0) {
      totalEstimatedTokens = providerCount.totalTokens;
      countingMethod = 'provider_api';
      countingSource = providerCount.source;

      if (sections.length > 0) {
        rescaleSectionsToTotal(sections, totalEstimatedTokens);
      } else {
        sections.push({
          label: 'Conversation Context',
          estimatedTokens: totalEstimatedTokens,
          percentage: 0,
          color: '#22c55e',
        });
      }
    }

    // Compute percentages
    for (const section of sections) {
      section.percentage = contextWindowSize > 0 ? (section.estimatedTokens / contextWindowSize) * 100 : 0;
    }

    const contextBreakdown: ContextBreakdown = {
      sections,
      totalEstimatedTokens,
      contextWindowSize,
      percentUsed: contextWindowSize > 0 ? (totalEstimatedTokens / contextWindowSize) * 100 : 0,
      model: settings.model,
      countingMethod,
      countingProvider: settings.provider,
      countingSource,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit context breakdown as the first event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ context_breakdown: contextBreakdown })}\n\n`
          ));

          for await (const chunk of streamChat(
            messages,
            settings,
            systemPrompt,
            webSearchEnabled,
            searchResults,
            googleDriveEnabled,
            driveSearchResults,
            memorySearchEnabled,
            mcpTools.length > 0 ? mcpTools : undefined,
            toolExecutions,
            ragEnabled,
            artifactsEnabled
          )) {
            if (chunk.type === 'content') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
            } else if (chunk.type === 'reasoning') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reasoning: chunk.reasoning })}\n\n`));
            } else if (chunk.type === 'usage') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: chunk.usage })}\n\n`));
            } else if (chunk.type === 'tool_call') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                tool_call: {
                  id: chunk.toolCallId,
                  name: chunk.toolName,
                  originalName: chunk.originalToolName, // Prefixed name for Anthropic API
                  params: chunk.toolParams,
                  source: chunk.toolSource,
                  serverId: chunk.toolServerId,
                  thinkingSignature: chunk.toolThinkingSignature,
                },
              })}\n\n`));
            } else if (chunk.type === 'tool_calls') {
              // Multiple parallel tool calls
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                tool_calls: chunk.toolCalls,
              })}\n\n`));
            } else if (chunk.type === 'search_status') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ search_status: chunk.status })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const errorMessage = extractErrorMessage(error);
          console.error(
            `[chat/route] Stream error [provider=${settings.provider} model=${settings.model}]`,
            errorMessage,
            error
          );
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[chat/route] Request error:', errorMessage, error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
