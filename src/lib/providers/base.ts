/**
 * Shared utilities for all providers
 */

import { Artifact } from '@/types';

/** Artifact tool names - duplicated here to avoid importing server-only definitions.ts */
const ARTIFACT_TOOL_NAMES = ['create_artifact', 'update_artifact', 'read_artifact'];

/**
 * Merge system prompts: global + project + conversation
 * Returns merged prompt with proper formatting
 */
export function mergeSystemPrompts(
  globalPrompt?: string,
  projectInstructions?: string,
  conversationPrompt?: string
): string | undefined {
  const parts: string[] = [];

  if (globalPrompt?.trim()) {
    parts.push(globalPrompt.trim());
  }

  if (projectInstructions?.trim()) {
    parts.push(projectInstructions.trim());
  }

  if (conversationPrompt?.trim()) {
    parts.push(conversationPrompt.trim());
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * Check if a model should use the OpenAI Responses API for reasoning summaries
 */
export function isOpenAIReasoningModel(model: string): boolean {
  return /^gpt-5(\b|[.-])/.test(model) || /^o[134]/.test(model) || model.includes('o1-') || model.includes('o3-') || model.includes('o4-');
}

/**
 * Maximum number of times a single tool can be called per user message.
 * Prevents loops while still allowing multiple searches with different queries.
 */
const MAX_SAME_TOOL_CALLS = 3;

/**
 * Check if a tool has reached its per-tool call limit in this turn
 */
export function toolCallLimitReached(
  toolName: string,
  toolExecutions?: { toolName: string; originalToolName?: string }[]
): boolean {
  if (!toolExecutions) return false;
  const count = toolExecutions.filter(
    te => te.toolName === toolName || te.originalToolName === toolName
  ).length;
  return count >= MAX_SAME_TOOL_CALLS;
}

/**
 * Check if a tool name is an artifact tool (exempt from per-tool call limits)
 */
export function isArtifactTool(toolName: string): boolean {
  return ARTIFACT_TOOL_NAMES.includes(toolName);
}

/**
 * Generate a unique tool call ID for Gemini (which doesn't provide one)
 */
export function generateGeminiToolCallId(): string {
  return `gc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build system prompt instructions for artifact tools.
 * Includes guidance on when to use artifact tools and a list of existing artifacts.
 */
export function buildArtifactSystemPrompt(existingArtifacts?: Artifact[]): string {
  const MAX_LISTED_ARTIFACTS = 20;

  let prompt = `## Artifacts

You have access to artifact tools for creating and managing substantial content:

- **create_artifact**: Create a new artifact (code, html, react, markdown, svg, mermaid, document, spreadsheet, presentation).
- **update_artifact**: Replace an artifact's content with a new version. Always provide the complete content, not a diff.
- **read_artifact**: Read an artifact's current content before editing it.

### When to use artifacts vs. inline code
- Use **create_artifact** for: complete programs, full HTML pages, React components, diagrams, structured documents, spreadsheets, slide outlines, or any content that benefits from a preview panel.
- Use **inline code blocks** for: short snippets, one-liners, explanations with small code examples, or partial code shown for illustration.
- When generating files for export, prefer:
  - **document** for DOCX/PDF style output
  - **spreadsheet** for XLSX output (CSV or JSON-table content)
  - **presentation** for PPTX output (slides separated with \`---\`, or JSON slides)
- Structured content formats that export best:
  - **document**: markdown headings/lists/tables OR JSON with \`blocks\` / \`sections\`
  - **spreadsheet**: CSV/TSV, markdown tables, array-of-objects JSON, or \`{ "sheets": { ... } }\`
  - **presentation**: markdown with \`---\` slide breaks or JSON \`{ "slides": [ { "title": "...", "bullets": [...] } ] }\`
- Optionally set \`output_format\` on create/update to hint preferred export target (\`source\`, \`docx\`, \`pdf\`, \`xlsx\`, \`pptx\`).
- When updating, use **read_artifact** first if the artifact content is not visible in the recent conversation, then **update_artifact** with the full new content.`;

  if (existingArtifacts && existingArtifacts.length > 0) {
    const listed = existingArtifacts.slice(-MAX_LISTED_ARTIFACTS);
    prompt += `\n\n### Existing artifacts in this conversation\n`;
    for (const artifact of listed) {
      prompt += `- ID: \`${artifact.id}\` | Type: ${artifact.type} | Title: "${artifact.title}"`;
      if (artifact.language) prompt += ` | Language: ${artifact.language}`;
      prompt += `\n`;
    }
    if (existingArtifacts.length > MAX_LISTED_ARTIFACTS) {
      prompt += `(${existingArtifacts.length - MAX_LISTED_ARTIFACTS} older artifacts omitted)\n`;
    }
  }

  return prompt;
}
