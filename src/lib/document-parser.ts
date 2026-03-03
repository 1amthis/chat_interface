import type { RichDocument, DocumentBlock, DocumentSection, DocRichText, DocTextRun, DocListItem, DocTable, DocTableCell } from '@/types';

// ===== Flat block type for backward-compatible consumers (PDF, slide conversion) =====

export type FlatBlock =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code'; text: string; language?: string };

// ===== Utility helpers =====

function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content.trim());
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function normalizeTextValue(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

// ===== Markdown parsing helpers =====

function isMarkdownTableHeaderLine(line: string, nextLine?: string): boolean {
  if (!line.includes('|') || !nextLine) return false;
  return /^[:\-|\s]+$/.test(nextLine.trim());
}

function splitMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

function looksLikeListItem(line: string): boolean {
  return /^([-*+]|\d+\.)\s+/.test(line.trim());
}

// ===== Markdown → FlatBlock[] parser =====

function parseBlocksFromText(content: string): FlatBlock[] {
  const lines = normalizeLineEndings(content).split('\n');
  const blocks: FlatBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n'), language });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 6),
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    if (looksLikeListItem(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && looksLikeListItem(lines[i])) {
        items.push(lines[i].trim().replace(/^([-*+]|\d+\.)\s+/, '').trim());
        i++;
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', items, ordered });
      }
      continue;
    }

    if (isMarkdownTableHeaderLine(line, lines[i + 1])) {
      const headers = splitMarkdownTableCells(line);
      i += 2; // header + divider
      const rows: string[][] = [];

      while (i < lines.length && lines[i].includes('|')) {
        rows.push(splitMarkdownTableCells(lines[i]));
        i++;
      }

      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const paragraphLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) break;
      if (next.startsWith('```')) break;
      if (/^(#{1,6})\s+/.test(next)) break;
      if (looksLikeListItem(next)) break;
      if (isMarkdownTableHeaderLine(next, lines[i + 1])) break;
      paragraphLines.push(next);
      i++;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' ').trim(),
    });
  }

  return blocks;
}

// ===== JSON → FlatBlock[] parser (old format compat) =====

function parseFlatBlockFromSpec(block: unknown): FlatBlock[] {
  if (typeof block === 'string') {
    return parseBlocksFromText(block);
  }

  if (!isObject(block)) {
    return [];
  }

  const type = normalizeTextValue(block.type).toLowerCase();
  if (!type) {
    return [];
  }

  if (type === 'heading') {
    const text = normalizeTextValue(block.text || block.title);
    if (!text) return [];
    const rawLevel = Number(block.level);
    const level = Number.isFinite(rawLevel) ? Math.min(Math.max(Math.floor(rawLevel), 1), 6) : 1;
    return [{ type: 'heading', text, level }];
  }

  if (type === 'paragraph') {
    const text = normalizeTextValue(block.text || block.content);
    return text ? [{ type: 'paragraph', text }] : [];
  }

  if (type === 'list') {
    const items = toStringArray(block.items);
    if (items.length === 0) return [];
    const ordered = Boolean(block.ordered);
    return [{ type: 'list', items, ordered }];
  }

  if (type === 'table') {
    const tableObj = isObject(block.table) ? block.table : block;
    const headers = toStringArray(tableObj.headers);
    const rows = Array.isArray(tableObj.rows)
      ? tableObj.rows.map((row: unknown) => Array.isArray(row) ? row.map(cell => String(cell ?? '').trim()) : [])
      : [];
    if (headers.length === 0 && rows.length === 0) return [];
    return [{ type: 'table', headers, rows }];
  }

  if (type === 'code') {
    const codeObj = isObject(block.code) ? block.code : block;
    const text = normalizeTextValue(codeObj.code || codeObj.text || codeObj.content);
    if (!text) return [];
    const language = normalizeTextValue(codeObj.language) || undefined;
    return [{ type: 'code', text, language }];
  }

  return [];
}

function parseFlatBlocksFromJson(value: unknown): FlatBlock[] | null {
  if (Array.isArray(value)) {
    const blocks = value.flatMap(parseFlatBlockFromSpec);
    return blocks.length > 0 ? blocks : null;
  }

  if (!isObject(value)) {
    return null;
  }

  const blocks: FlatBlock[] = [];

  if (typeof value.title === 'string' && value.title.trim()) {
    blocks.push({ type: 'heading', text: value.title.trim(), level: 1 });
  }

  if (Array.isArray(value.blocks)) {
    blocks.push(...value.blocks.flatMap(parseFlatBlockFromSpec));
  }

  if (Array.isArray(value.sections)) {
    for (const section of value.sections) {
      if (!isObject(section)) continue;

      const heading = normalizeTextValue(section.heading || section.title);
      if (heading) {
        blocks.push({ type: 'heading', text: heading, level: 2 });
      }

      const paragraphs = toStringArray(section.paragraphs);
      for (const paragraph of paragraphs) {
        blocks.push({ type: 'paragraph', text: paragraph });
      }

      if (Array.isArray(section.blocks)) {
        blocks.push(...section.blocks.flatMap(parseFlatBlockFromSpec));
      }

      const bullets = toStringArray(section.bullets);
      if (bullets.length > 0) {
        blocks.push({ type: 'list', ordered: false, items: bullets });
      }

      if (section.table && isObject(section.table)) {
        const headers = toStringArray(section.table.headers);
        const rows = Array.isArray(section.table.rows)
          ? section.table.rows.map((row: unknown) => Array.isArray(row) ? row.map((cell: unknown) => String(cell ?? '').trim()) : [])
          : [];
        if (headers.length > 0 || rows.length > 0) {
          blocks.push({ type: 'table', headers, rows });
        }
      }
    }
  }

  const topParagraphs = toStringArray(value.paragraphs);
  for (const paragraph of topParagraphs) {
    blocks.push({ type: 'paragraph', text: paragraph });
  }

  const topBullets = toStringArray(value.bullets);
  if (topBullets.length > 0) {
    blocks.push({ type: 'list', ordered: false, items: topBullets });
  }

  if (typeof value.content === 'string' && value.content.trim()) {
    blocks.push(...parseBlocksFromText(value.content));
  }

  return blocks.length > 0 ? blocks : null;
}

// ===== Backward-compatible parseDocumentBlocks (for PDF and slide conversion) =====

export function parseDocumentBlocks(content: string, fallbackTitle?: string): FlatBlock[] {
  const parsed = safeJsonParse(content);
  let blocks: FlatBlock[] | null = parsed ? parseFlatBlocksFromJson(parsed) : null;

  if (!blocks || blocks.length === 0) {
    blocks = parseBlocksFromText(content);
  }

  if (fallbackTitle && !blocks.some(block => block.type === 'heading')) {
    blocks = [{ type: 'heading', level: 1, text: fallbackTitle }, ...blocks];
  }

  if (blocks.length === 0) {
    return fallbackTitle
      ? [{ type: 'heading', level: 1, text: fallbackTitle }]
      : [{ type: 'paragraph', text: '' }];
  }

  return blocks;
}

// ===== Rich Document parsing (new format) =====

/** Validate and coerce a DocRichText value */
function parseDocRichText(value: unknown): DocRichText | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const runs = value.filter(
      (run): run is DocTextRun =>
        isObject(run) && typeof (run as Record<string, unknown>).text === 'string'
    );
    return runs.length > 0 ? runs : null;
  }
  return null;
}

/** Parse a DocTable from JSON */
function parseDocTable(value: unknown): DocTable | null {
  if (!isObject(value)) return null;
  const rows = Array.isArray(value.rows)
    ? value.rows.map((row: unknown) => {
        if (!Array.isArray(row)) return [];
        return row.map((cell: unknown): string | DocTableCell => {
          if (typeof cell === 'string') return cell;
          if (isObject(cell) && typeof cell.text === 'string') return cell as unknown as DocTableCell;
          return String(cell ?? '');
        });
      })
    : [];
  if (rows.length === 0 && !Array.isArray(value.headers)) return null;
  const headers = Array.isArray(value.headers)
    ? value.headers.map((h: unknown): string | DocTableCell => {
        if (typeof h === 'string') return h;
        if (isObject(h) && typeof h.text === 'string') return h as unknown as DocTableCell;
        return String(h ?? '');
      })
    : undefined;
  return {
    headers,
    rows,
    headerFill: typeof value.headerFill === 'string' ? value.headerFill : undefined,
    headerColor: typeof value.headerColor === 'string' ? value.headerColor : undefined,
    borderColor: typeof value.borderColor === 'string' ? value.borderColor : undefined,
    caption: typeof value.caption === 'string' ? value.caption : undefined,
  };
}

/** Parse a DocListItem from JSON */
function parseDocListItem(value: unknown): string | DocListItem {
  if (typeof value === 'string') return value;
  if (isObject(value)) {
    const text = parseDocRichText(value.text);
    if (!text) return String(value.text ?? '');
    const children = Array.isArray(value.children)
      ? value.children.map(parseDocListItem).map(
          (c): DocListItem => typeof c === 'string' ? { text: c } : c
        )
      : undefined;
    return { text, children };
  }
  return String(value ?? '');
}

/** Parse a single DocumentBlock from JSON */
function parseDocumentBlock(value: unknown): DocumentBlock | null {
  if (!isObject(value)) return null;

  const type = normalizeTextValue(value.type).toLowerCase();

  if (type === 'heading') {
    const text = parseDocRichText(value.text || value.title);
    if (!text) return null;
    const rawLevel = Number(value.level);
    const level = (Number.isFinite(rawLevel) ? Math.min(Math.max(Math.floor(rawLevel), 1), 6) : 1) as 1 | 2 | 3 | 4 | 5 | 6;
    return { type: 'heading', text, level };
  }

  if (type === 'paragraph') {
    const text = parseDocRichText(value.text || value.content);
    if (!text) return null;
    return { type: 'paragraph', text };
  }

  if (type === 'list') {
    const items = Array.isArray(value.items)
      ? value.items.map(parseDocListItem)
      : [];
    if (items.length === 0) return null;
    return { type: 'list', items, ordered: Boolean(value.ordered) };
  }

  if (type === 'table') {
    const table = parseDocTable(value.table || value);
    if (!table) return null;
    return { type: 'table', table };
  }

  if (type === 'code') {
    const codeObj = isObject(value.code) ? value.code : value;
    const code = normalizeTextValue(codeObj.code || codeObj.text || codeObj.content);
    if (!code) return null;
    const language = normalizeTextValue(codeObj.language) || undefined;
    const caption = typeof codeObj.caption === 'string' ? codeObj.caption : undefined;
    return { type: 'code', code: { code, language, caption } };
  }

  if (type === 'image') {
    const imgObj = isObject(value.image) ? value.image : value;
    const data = typeof imgObj.data === 'string' ? imgObj.data : undefined;
    const path = typeof imgObj.path === 'string' ? imgObj.path : undefined;
    if (!data && !path) return null;
    return {
      type: 'image',
      image: {
        data,
        path,
        width: typeof imgObj.width === 'number' ? imgObj.width : undefined,
        height: typeof imgObj.height === 'number' ? imgObj.height : undefined,
        alt: typeof imgObj.alt === 'string' ? imgObj.alt : undefined,
        caption: typeof imgObj.caption === 'string' ? imgObj.caption : undefined,
        align: (imgObj.align === 'left' || imgObj.align === 'center' || imgObj.align === 'right') ? imgObj.align : undefined,
      },
    };
  }

  if (type === 'blockquote') {
    const text = parseDocRichText(value.text);
    if (!text) return null;
    return { type: 'blockquote', text };
  }

  if (type === 'callout') {
    const calloutObj = isObject(value.callout) ? value.callout : value;
    const text = parseDocRichText(calloutObj.text);
    if (!text) return null;
    const calloutType = calloutObj.type;
    return {
      type: 'callout',
      callout: {
        text,
        type: (calloutType === 'note' || calloutType === 'info' || calloutType === 'warning' || calloutType === 'tip')
          ? calloutType
          : undefined,
      },
    };
  }

  if (type === 'break') {
    const breakObj = isObject(value.break) ? value.break : value;
    const breakType = normalizeTextValue(breakObj.type || breakObj.break);
    if (breakType === 'page-break' || breakType === 'page_break' || breakType === 'pagebreak') {
      return { type: 'break', break: { type: 'page-break' } };
    }
    return { type: 'break', break: { type: 'horizontal-rule' } };
  }

  return null;
}

/** Parse a DocumentSection from JSON */
function parseDocumentSection(value: unknown): DocumentSection | null {
  if (!isObject(value)) return null;
  const heading = typeof value.heading === 'string' ? value.heading
    : typeof value.title === 'string' ? value.title
    : undefined;
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map(parseDocumentBlock).filter((b): b is DocumentBlock => b !== null)
    : [];
  if (!heading && blocks.length === 0) return null;
  return { heading, blocks };
}

/** Convert FlatBlock[] to DocumentBlock[] for legacy format support */
function flatBlocksToDocumentBlocks(flatBlocks: FlatBlock[]): DocumentBlock[] {
  return flatBlocks.map((fb): DocumentBlock => {
    switch (fb.type) {
      case 'heading':
        return { type: 'heading', text: fb.text, level: Math.min(Math.max(fb.level, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6 };
      case 'paragraph':
        return { type: 'paragraph', text: fb.text };
      case 'list':
        return { type: 'list', items: fb.items, ordered: fb.ordered };
      case 'table':
        return { type: 'table', table: { headers: fb.headers, rows: fb.rows } };
      case 'code':
        return { type: 'code', code: { code: fb.text, language: fb.language } };
    }
  });
}

/** Check if a value looks like a new-format DocumentBlock */
function isDocumentBlock(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = normalizeTextValue(value.type).toLowerCase();
  return ['heading', 'paragraph', 'list', 'table', 'code', 'image', 'blockquote', 'callout', 'break'].includes(type);
}

/**
 * Parse document content into a RichDocument.
 * Tries rich JSON format first, falls back to legacy JSON format, then markdown.
 */
export function parseDocumentContent(content: string, fallbackTitle?: string): RichDocument {
  const parsed = safeJsonParse(content);

  if (parsed !== null) {
    // Try rich { theme?, title?, blocks?, sections? } format
    if (isObject(parsed)) {
      const hasBlocks = Array.isArray(parsed.blocks) && parsed.blocks.length > 0;
      const hasSections = Array.isArray(parsed.sections) && parsed.sections.length > 0;
      const hasTitle = typeof parsed.title === 'string';
      const hasTheme = isObject(parsed.theme);

      if (hasBlocks || hasSections || (hasTitle && (hasTheme || hasBlocks || hasSections))) {
        const theme = hasTheme ? parsed.theme as RichDocument['theme'] : undefined;
        const title = hasTitle ? parsed.title as string : undefined;
        const subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle : undefined;

        // Try parsing blocks as new DocumentBlock[] format
        let blocks: DocumentBlock[] | undefined;
        if (hasBlocks) {
          const parsedBlocks = (parsed.blocks as unknown[])
            .map(parseDocumentBlock)
            .filter((b): b is DocumentBlock => b !== null);
          if (parsedBlocks.length > 0) {
            blocks = parsedBlocks;
          } else {
            // Fall back to flat block parsing for legacy format
            const flatBlocks = (parsed.blocks as unknown[]).flatMap(parseFlatBlockFromSpec);
            if (flatBlocks.length > 0) {
              blocks = flatBlocksToDocumentBlocks(flatBlocks);
            }
          }
        }

        let sections: DocumentSection[] | undefined;
        if (hasSections) {
          const parsedSections = (parsed.sections as unknown[])
            .map(parseDocumentSection)
            .filter((s): s is DocumentSection => s !== null);
          if (parsedSections.length > 0) {
            sections = parsedSections;
          }
        }

        if (blocks || sections) {
          return {
            theme,
            title: title || fallbackTitle,
            subtitle,
            blocks,
            sections,
            author: typeof parsed.author === 'string' ? parsed.author : undefined,
            date: typeof parsed.date === 'string' ? parsed.date : undefined,
            header: typeof parsed.header === 'string' ? parsed.header : undefined,
            footer: typeof parsed.footer === 'string' ? parsed.footer : undefined,
            showPageNumbers: typeof parsed.showPageNumbers === 'boolean' ? parsed.showPageNumbers : undefined,
          };
        }
      }
    }

    // Try plain array of DocumentBlock[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (parsed.some(isDocumentBlock)) {
        const blocks = parsed
          .map(parseDocumentBlock)
          .filter((b): b is DocumentBlock => b !== null);
        if (blocks.length > 0) {
          return { title: fallbackTitle, blocks };
        }
      }
    }

    // Try legacy JSON format (old parseRichBlocksFromJson shape)
    const flatBlocks = parseFlatBlocksFromJson(parsed);
    if (flatBlocks && flatBlocks.length > 0) {
      return {
        title: fallbackTitle,
        blocks: flatBlocksToDocumentBlocks(flatBlocks),
      };
    }
  }

  // Fall back to markdown parsing
  const flatBlocks = parseBlocksFromText(content);
  const blocks = flatBlocksToDocumentBlocks(flatBlocks);

  if (blocks.length === 0) {
    return {
      title: fallbackTitle,
      blocks: fallbackTitle
        ? [{ type: 'heading', text: fallbackTitle, level: 1 as const }]
        : [{ type: 'paragraph', text: '' }],
    };
  }

  // If no heading block and we have a fallback title, prepend it
  if (fallbackTitle && !blocks.some(b => b.type === 'heading')) {
    blocks.unshift({ type: 'heading', text: fallbackTitle, level: 1 as const });
  }

  return { title: fallbackTitle, blocks };
}
