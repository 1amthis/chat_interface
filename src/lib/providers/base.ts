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
- **update_artifact**: Update an artifact using either full \`content\` replacement or a targeted \`patch\`.
- **read_artifact**: Read an artifact's current content before editing it.

### When to use artifacts vs. inline code
- Use **create_artifact** for: complete programs, full HTML pages, React components, diagrams, structured documents, spreadsheets, slide outlines, or any content that benefits from a preview panel.
- Use **inline code blocks** for: short snippets, one-liners, explanations with small code examples, or partial code shown for illustration.
- When generating files for export, prefer:
  - **document** for DOCX/PDF style output
  - **spreadsheet** for XLSX output (CSV or JSON-table content)
  - **presentation** for PPTX output (rich JSON with theme, layouts, tables, charts)
- Structured content formats that export best:
  - **document**: rich JSON with \`theme\`, \`title\`, and \`blocks\` array for rich output (preferred), or markdown for basic output
  - **spreadsheet**: CSV/TSV, markdown tables, array-of-objects JSON, or \`{ "sheets": { ... } }\`
  - **presentation**: JSON with \`theme\` and \`slides\` array for rich output (preferred), or markdown with \`---\` breaks for basic output
- Optionally set \`output_format\` on create/update to hint preferred export target (\`source\`, \`docx\`, \`pdf\`, \`xlsx\`, \`pptx\`).
- For localized edits, prefer \`update_artifact\` with \`patch\` instead of rewriting entire content.
- Patch format (repeat blocks as needed):
  \`\`\`
  <<<<<<< SEARCH
  exact old text
  =======
  new text
  >>>>>>> REPLACE
  \`\`\`
- Each SEARCH block must match exactly once in the current artifact content.

### Presentation Design Guidelines

When creating presentations with \`type: "presentation"\`, output structured JSON:

\`\`\`json
{
  "theme": { "background": "FFFFFF", "titleColor": "1A1A2E", "bodyColor": "333333", "accentColor": "3B82F6", "titleFont": "Arial", "bodyFont": "Calibri" },
  "slides": [
    { "layout": "title", "title": "Presentation Title", "subtitle": "Subtitle text" },
    { "layout": "title-content", "title": "Slide Title", "bullets": ["Point one", "Point two", "Point three"] },
    { "layout": "section", "title": "Section Divider", "background": "3B82F6" },
    { "layout": "two-column", "title": "Comparison", "bullets": ["Left point 1", "Left point 2"], "body": "Right column text" },
    { "layout": "title-content", "title": "Data", "table": { "headers": ["Metric", "Q1", "Q2"], "rows": [["Revenue", "$1.2M", "$1.5M"]], "headerFill": "3B82F6", "headerColor": "FFFFFF" } },
    { "layout": "title-content", "title": "Chart", "chart": { "type": "bar", "data": [{"name": "Sales", "labels": ["Q1","Q2","Q3"], "values": [100,150,200]}], "chartColors": ["3B82F6","10B981","F59E0B"] } }
  ]
}
\`\`\`

**Layouts**: \`title\`, \`title-content\` (default), \`section\`, \`two-column\`, \`blank\`, \`image-left\`, \`image-right\`.
**Colors**: 6-char hex WITHOUT \`#\` prefix (e.g. \`"3B82F6"\`). Good palettes: Navy/Gold (\`"1A1A2E"\`/\`"D4AF37"\`), Teal/Coral (\`"0D9488"\`/\`"F97316"\`), Blue/White (\`"3B82F6"\`/\`"FFFFFF"\`).
**Rules**: Start with \`title\` layout, end with summary. Use \`section\` dividers between topics. Keep 3-5 bullets per slide. Vary layouts — avoid repeating the same layout 3+ times. Avoid all-text slides.
- When updating, use **read_artifact** first if the artifact content is not visible in the recent conversation. Prefer **update_artifact** with \`patch\` for focused changes, and use full \`content\` only for broad rewrites.

### Document Design Guidelines

When creating documents with \`type: "document"\`, output structured JSON:

\`\`\`json
{
  "theme": { "primaryColor": "1A1A2E", "bodyColor": "333333", "accentColor": "3B82F6", "headingFont": "Georgia", "bodyFont": "Calibri", "fontSize": 11, "lineSpacing": 1.15 },
  "title": "Document Title",
  "subtitle": "Optional subtitle or author line",
  "header": "Optional Running Header",
  "showPageNumbers": true,
  "blocks": [
    { "type": "heading", "text": "Introduction", "level": 2 },
    { "type": "paragraph", "text": "A plain paragraph of body text." },
    { "type": "paragraph", "text": [{ "text": "A paragraph with " }, { "text": "bold", "bold": true }, { "text": " and " }, { "text": "italic", "italic": true }, { "text": " formatting." }] },
    { "type": "list", "items": ["First item", "Second item", "Third item"], "ordered": false },
    { "type": "table", "table": { "headers": ["Metric", "Value"], "rows": [["Revenue", "$1.2M"], ["Growth", "15%"]], "headerFill": "3B82F6", "headerColor": "FFFFFF" } },
    { "type": "code", "code": { "code": "const x = 42;", "language": "javascript" } },
    { "type": "blockquote", "text": "An important quote or excerpt." },
    { "type": "callout", "callout": { "text": "This is a helpful tip.", "type": "tip" } },
    { "type": "break", "break": { "type": "page-break" } }
  ]
}
\`\`\`

**Block types**: \`heading\` (levels 1-6), \`paragraph\`, \`list\` (ordered/unordered), \`table\`, \`code\`, \`image\`, \`blockquote\`, \`callout\` (note/info/warning/tip), \`break\` (horizontal-rule/page-break).
**Rich text**: Paragraph and heading \`text\` can be a plain string OR an array of text runs: \`[{ "text": "bold text", "bold": true }, { "text": "linked", "hyperlink": "https://..." }]\`. Runs support \`bold\`, \`italic\`, \`underline\`, \`strikethrough\`, \`color\`, \`hyperlink\`, \`code\`, \`superscript\`, \`subscript\`.
**Colors**: 6-char hex WITHOUT \`#\` prefix (e.g. \`"3B82F6"\`).
**Rules**: Start with a descriptive title. Use headings to organize hierarchically. Keep paragraphs focused. Use tables for structured data. Use callouts for important notes. Vary block types — avoid long runs of plain paragraphs.`;

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
