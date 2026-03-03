import { Artifact, ArtifactOutputFormat } from '@/types';
import { parseDocumentContent, parseDocumentBlocks } from './document-parser';
import type { FlatBlock } from './document-parser';

export interface ArtifactExportOption {
  format: ArtifactOutputFormat;
  label: string;
}

export interface SlideContent {
  title: string;
  subtitle?: string;
  bullets: string[];
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const SOURCE_EXTENSIONS: Record<Artifact['type'], string> = {
  code: 'txt',
  html: 'html',
  react: 'jsx',
  markdown: 'md',
  svg: 'svg',
  mermaid: 'mmd',
  document: 'md',
  spreadsheet: 'csv',
  presentation: 'json',
};

const SOURCE_MIME_TYPES: Record<Artifact['type'], string> = {
  code: 'text/plain',
  html: 'text/html',
  react: 'text/plain',
  markdown: 'text/markdown',
  svg: 'image/svg+xml',
  mermaid: 'text/plain',
  document: 'text/markdown',
  spreadsheet: 'text/csv',
  presentation: 'application/json',
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  swift: 'swift',
  kotlin: 'kt',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yml',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  html: 'html',
  shell: 'sh',
  bash: 'sh',
  markdown: 'md',
  csv: 'csv',
};

const COMMON_EXPORT_OPTIONS: ArtifactExportOption[] = [
  { format: 'source', label: 'Source' },
  { format: 'docx', label: 'DOCX' },
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'XLSX' },
  { format: 'pptx', label: 'PPTX' },
];

export function sanitizeFilename(value: string): string {
  const safe = value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'artifact';
}

export function getSourceFileExtension(artifact: Artifact): string {
  if (artifact.type === 'code' && artifact.language) {
    const ext = LANGUAGE_EXTENSIONS[artifact.language.toLowerCase()];
    if (ext) return ext;
  }
  return SOURCE_EXTENSIONS[artifact.type];
}

function getSourceMimeType(artifact: Artifact): string {
  return SOURCE_MIME_TYPES[artifact.type];
}

export function getArtifactExportOptions(artifact: Artifact): ArtifactExportOption[] {
  const sourceExt = getSourceFileExtension(artifact);

  if (artifact.type === 'spreadsheet') {
    return [
      { format: 'source', label: `Source (.${sourceExt})` },
      { format: 'xlsx', label: 'XLSX (.xlsx)' },
      { format: 'pdf', label: 'PDF (.pdf)' },
      { format: 'docx', label: 'DOCX (.docx)' },
      { format: 'pptx', label: 'PPTX (.pptx)' },
    ];
  }

  if (artifact.type === 'presentation') {
    return [
      { format: 'source', label: `Source (.${sourceExt})` },
      { format: 'pptx', label: 'PPTX (.pptx)' },
      { format: 'pdf', label: 'PDF (.pdf)' },
      { format: 'docx', label: 'DOCX (.docx)' },
      { format: 'xlsx', label: 'XLSX (.xlsx)' },
    ];
  }

  const preferredOrder: ArtifactOutputFormat[] = artifact.type === 'document'
    ? ['source', 'docx', 'pdf', 'pptx', 'xlsx']
    : COMMON_EXPORT_OPTIONS.map(option => option.format);

  return preferredOrder.map((format) => {
    if (format === 'source') {
      return { format, label: `Source (.${sourceExt})` };
    }
    return {
      format,
      label: `${format.toUpperCase()} (.${format})`,
    };
  });
}

export function getExportFilename(artifact: Artifact, format: ArtifactOutputFormat): string {
  const basename = sanitizeFilename(artifact.title);
  const extension = format === 'source' ? getSourceFileExtension(artifact) : format;
  return `${basename}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function generateArtifactExportBlob(
  artifact: Artifact,
  format: ArtifactOutputFormat
): Promise<Blob> {
  if (format === 'source') {
    return new Blob([artifact.content], { type: getSourceMimeType(artifact) });
  }

  if (format === 'pdf') {
    const content = artifact.type === 'html' || artifact.type === 'react' || artifact.type === 'svg'
      ? normalizeForTextExport(artifact)
      : artifact.content;
    return generatePdfBlob(content, artifact.title);
  }

  if (format === 'docx') {
    const content = artifact.type === 'html' || artifact.type === 'react' || artifact.type === 'svg'
      ? normalizeForTextExport(artifact)
      : artifact.content;
    return generateDocxBlob(content, artifact.title);
  }

  if (format === 'xlsx') {
    return generateXlsxBlob(artifact.content, artifact.title);
  }

  return generatePptxBlob(artifact.content, artifact.title);
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function stripHtmlTags(input: string): string {
  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, 'text/html');
    return doc.body.textContent || '';
  }

  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeForTextExport(artifact: Artifact): string {
  if (artifact.type === 'html' || artifact.type === 'react' || artifact.type === 'svg') {
    return normalizeLineEndings(stripHtmlTags(artifact.content)).trim();
  }
  return normalizeLineEndings(artifact.content).trim();
}


async function generatePdfBlob(content: string, title?: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let currentY = margin;
  const blocks = parseDocumentBlocks(content, title);

  const ensureSpace = (heightNeeded: number) => {
    if (currentY + heightNeeded > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
  };

  const writeWrapped = (
    text: string,
    options: {
      size: number;
      style: 'normal' | 'bold';
      font?: 'helvetica' | 'courier';
      indent?: number;
      after?: number;
      lineHeight?: number;
    }
  ) => {
    const size = options.size;
    const lineHeight = options.lineHeight ?? Math.max(14, size + 3);
    const x = margin + (options.indent ?? 0);
    const width = maxWidth - (options.indent ?? 0);

    doc.setFont(options.font ?? 'helvetica', options.style);
    doc.setFontSize(size);

    const lines = doc.splitTextToSize(text || ' ', width) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, currentY);
      currentY += lineHeight;
    }
    currentY += options.after ?? 0;
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      const size = block.level <= 1 ? 20 : block.level === 2 ? 16 : 13;
      if (currentY > margin) currentY += 4;
      writeWrapped(block.text, {
        size,
        style: 'bold',
        font: 'helvetica',
        after: 6,
      });
      continue;
    }

    if (block.type === 'paragraph') {
      writeWrapped(block.text, {
        size: 11,
        style: 'normal',
        font: 'helvetica',
        after: 6,
      });
      continue;
    }

    if (block.type === 'list') {
      block.items.forEach((item, index) => {
        const prefix = block.ordered ? `${index + 1}. ` : '- ';
        writeWrapped(`${prefix}${item}`, {
          size: 11,
          style: 'normal',
          font: 'helvetica',
          indent: 12,
          after: 2,
        });
      });
      currentY += 4;
      continue;
    }

    if (block.type === 'table') {
      const headerRow = block.headers.length > 0 ? block.headers.join(' | ') : '';
      if (headerRow) {
        writeWrapped(headerRow, {
          size: 10,
          style: 'bold',
          font: 'courier',
          after: 2,
        });
      }
      block.rows.forEach((row) => {
        writeWrapped(row.join(' | '), {
          size: 10,
          style: 'normal',
          font: 'courier',
          after: 1,
        });
      });
      currentY += 6;
      continue;
    }

    writeWrapped(block.text, {
      size: 10,
      style: 'normal',
      font: 'courier',
      after: 6,
      lineHeight: 13,
    });
  }

  return doc.output('blob');
}

// ===== DOCX generation helpers (using docx package) =====

interface DocxExportTheme {
  primaryColor: string;
  bodyColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  fontSize: number;
  lineSpacing: number;
}

function resolveDocxTheme(theme?: import('@/types').DocumentTheme): DocxExportTheme {
  const cleanHex = (c: string | undefined, fallback: string) => (c ? c.replace(/^#/, '') || fallback : fallback);
  return {
    primaryColor: cleanHex(theme?.primaryColor, '1A1A2E'),
    bodyColor: cleanHex(theme?.bodyColor, '333333'),
    accentColor: cleanHex(theme?.accentColor, '3B82F6'),
    headingFont: theme?.headingFont ?? 'Arial',
    bodyFont: theme?.bodyFont ?? 'Calibri',
    fontSize: theme?.fontSize ?? 11,
    lineSpacing: theme?.lineSpacing ?? 1.15,
  };
}

async function generateDocxBlob(content: string, title: string): Promise<Blob> {
  const docx = await import('docx');
  const richDoc = parseDocumentContent(content, title);
  const theme = resolveDocxTheme(richDoc.theme);

  type HeadingLevelValue = (typeof docx.HeadingLevel)[keyof typeof docx.HeadingLevel];
  const HEADING_MAP: Record<number, HeadingLevelValue> = {
    1: docx.HeadingLevel.HEADING_1,
    2: docx.HeadingLevel.HEADING_2,
    3: docx.HeadingLevel.HEADING_3,
    4: docx.HeadingLevel.HEADING_4,
    5: docx.HeadingLevel.HEADING_5,
    6: docx.HeadingLevel.HEADING_6,
  };

  type ParagraphChild = InstanceType<typeof docx.TextRun> | InstanceType<typeof docx.ExternalHyperlink>;

  /** Convert DocRichText to docx TextRun/Hyperlink children */
  function buildTextRuns(text: import('@/types').DocRichText): ParagraphChild[] {
    if (typeof text === 'string') {
      return [new docx.TextRun({ text, font: theme.bodyFont, size: theme.fontSize * 2, color: theme.bodyColor })];
    }
    return text.map((run) => {
      const runOpts: ConstructorParameters<typeof docx.TextRun>[0] = {
        text: run.text,
        bold: run.bold,
        italics: run.italic,
        underline: run.underline ? { type: docx.UnderlineType.SINGLE } : undefined,
        strike: run.strikethrough,
        superScript: run.superscript,
        subScript: run.subscript,
        color: run.color?.replace(/^#/, '') || undefined,
        size: (run.fontSize ?? theme.fontSize) * 2,
        font: run.fontFace ?? (run.code ? 'Courier New' : theme.bodyFont),
        shading: run.code ? { type: docx.ShadingType.CLEAR, fill: 'F3F4F6' } : undefined,
      };
      if (run.hyperlink) {
        return new docx.ExternalHyperlink({
          link: run.hyperlink,
          children: [new docx.TextRun({ ...runOpts, style: 'Hyperlink' })],
        });
      }
      return new docx.TextRun(runOpts);
    });
  }

  /** Build list paragraphs (bullet or numbered) */
  function buildListItems(
    items: (string | import('@/types').DocListItem)[],
    ordered: boolean,
    level = 0,
  ): InstanceType<typeof docx.Paragraph>[] {
    const results: InstanceType<typeof docx.Paragraph>[] = [];
    for (const item of items) {
      const text = typeof item === 'string' ? item : item.text;
      results.push(new docx.Paragraph({
        children: buildTextRuns(text),
        numbering: { reference: ordered ? 'ordered-list' : 'bullet-list', level },
        spacing: { after: 40 },
      }));
      if (typeof item !== 'string' && item.children && item.children.length > 0) {
        results.push(...buildListItems(item.children, ordered, level + 1));
      }
    }
    return results;
  }

  /** Build a docx Table from DocTable */
  function buildTable(table: import('@/types').DocTable): InstanceType<typeof docx.Table> {
    const headerFill = table.headerFill?.replace(/^#/, '') || theme.accentColor;
    const headerColor = table.headerColor?.replace(/^#/, '') || 'FFFFFF';
    const borderColor = table.borderColor?.replace(/^#/, '') || 'CCCCCC';
    const borderOpts = { style: docx.BorderStyle.SINGLE, size: 1, color: borderColor };

    const allRows: InstanceType<typeof docx.TableRow>[] = [];

    if (table.headers && table.headers.length > 0) {
      allRows.push(new docx.TableRow({
        tableHeader: true,
        children: table.headers.map((h) => {
          const text = typeof h === 'string' ? h : h.text;
          const cellFill = typeof h !== 'string' && h.fill ? h.fill.replace(/^#/, '') : headerFill;
          const cellColor = typeof h !== 'string' && h.color ? h.color.replace(/^#/, '') : headerColor;
          return new docx.TableCell({
            shading: { type: docx.ShadingType.CLEAR, fill: cellFill },
            children: [new docx.Paragraph({
              children: [new docx.TextRun({ text, bold: true, color: cellColor, font: theme.bodyFont, size: theme.fontSize * 2 })],
              alignment: docx.AlignmentType.CENTER,
            })],
          });
        }),
      }));
    }

    for (const row of table.rows) {
      allRows.push(new docx.TableRow({
        children: row.map((c) => {
          const isObj = typeof c === 'object' && c !== null;
          const text = isObj ? c.text : c;
          return new docx.TableCell({
            shading: isObj && c.fill ? { type: docx.ShadingType.CLEAR, fill: c.fill.replace(/^#/, '') } : undefined,
            children: [new docx.Paragraph({
              children: [new docx.TextRun({
                text,
                bold: isObj ? c.bold : undefined,
                color: (isObj && c.color ? c.color.replace(/^#/, '') : theme.bodyColor),
                font: theme.bodyFont,
                size: theme.fontSize * 2,
              })],
              alignment: isObj && c.align
                ? (c.align === 'center' ? docx.AlignmentType.CENTER : c.align === 'right' ? docx.AlignmentType.END : docx.AlignmentType.START)
                : undefined,
            })],
          });
        }),
      }));
    }

    return new docx.Table({
      rows: allRows,
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top: borderOpts,
        bottom: borderOpts,
        left: borderOpts,
        right: borderOpts,
        insideHorizontal: borderOpts,
        insideVertical: borderOpts,
      },
    });
  }

  /** Convert DocumentBlock[] to docx children (Paragraph | Table) */
  function buildChildren(blocks: import('@/types').DocumentBlock[]): (InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>)[] {
    const children: (InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>)[] = [];

    for (const block of blocks) {
      switch (block.type) {
        case 'heading': {
          children.push(new docx.Paragraph({
            heading: HEADING_MAP[block.level] || docx.HeadingLevel.HEADING_1,
            children: buildTextRuns(block.text),
            spacing: { before: 240, after: 120 },
          }));
          break;
        }
        case 'paragraph': {
          children.push(new docx.Paragraph({
            children: buildTextRuns(block.text),
            spacing: { after: 120, line: Math.round(theme.lineSpacing * 240) },
          }));
          break;
        }
        case 'list': {
          children.push(...buildListItems(block.items, block.ordered));
          break;
        }
        case 'table': {
          if (block.table.caption) {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: block.table.caption, italics: true, font: theme.bodyFont, size: (theme.fontSize - 1) * 2, color: theme.bodyColor })],
              spacing: { after: 60 },
            }));
          }
          children.push(buildTable(block.table));
          children.push(new docx.Paragraph({ spacing: { after: 120 } }));
          break;
        }
        case 'code': {
          const lines = block.code.code.split('\n');
          if (block.code.caption) {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: block.code.caption, bold: true, font: theme.bodyFont, size: (theme.fontSize - 1) * 2 })],
              spacing: { after: 40 },
            }));
          }
          for (const line of lines) {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: line || ' ', font: 'Courier New', size: 20, color: theme.bodyColor })],
              shading: { type: docx.ShadingType.CLEAR, fill: 'F3F4F6' },
              spacing: { before: 0, after: 0, line: 280 },
              indent: { left: 240, right: 240 },
            }));
          }
          children.push(new docx.Paragraph({ spacing: { after: 120 } }));
          break;
        }
        case 'blockquote': {
          children.push(new docx.Paragraph({
            children: buildTextRuns(block.text),
            indent: { left: 720 },
            border: { left: { style: docx.BorderStyle.SINGLE, size: 6, color: theme.accentColor, space: 8 } },
            spacing: { before: 120, after: 120, line: Math.round(theme.lineSpacing * 240) },
          }));
          break;
        }
        case 'callout': {
          const label = (block.callout.type ?? 'note').toUpperCase();
          children.push(new docx.Paragraph({
            children: [
              new docx.TextRun({ text: `${label}: `, bold: true, font: theme.bodyFont, size: theme.fontSize * 2, color: theme.accentColor }),
              ...buildTextRuns(block.callout.text),
            ],
            shading: { type: docx.ShadingType.CLEAR, fill: 'EFF6FF' },
            border: { left: { style: docx.BorderStyle.SINGLE, size: 6, color: theme.accentColor, space: 8 } },
            indent: { left: 240, right: 240 },
            spacing: { before: 120, after: 120 },
          }));
          break;
        }
        case 'image': {
          // Images can't be added without binary data in docx package; add placeholder text
          const caption = block.image.caption || block.image.alt || 'Image';
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: `[${caption}]`, italics: true, color: '999999', font: theme.bodyFont, size: theme.fontSize * 2 })],
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
          }));
          break;
        }
        case 'break': {
          if (block.break.type === 'page-break') {
            children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
          } else {
            children.push(new docx.Paragraph({
              thematicBreak: true,
              spacing: { before: 200, after: 200 },
            }));
          }
          break;
        }
      }
    }

    return children;
  }

  // Gather all blocks from the document
  const allBlocks: import('@/types').DocumentBlock[] = [];
  if (richDoc.title) {
    allBlocks.push({ type: 'heading', text: richDoc.title, level: 1 });
  }
  if (richDoc.subtitle) {
    allBlocks.push({ type: 'paragraph', text: richDoc.subtitle });
  }
  if (richDoc.blocks) {
    allBlocks.push(...richDoc.blocks);
  }
  if (richDoc.sections) {
    for (const section of richDoc.sections) {
      if (section.heading) {
        allBlocks.push({ type: 'heading', text: section.heading, level: 2 });
      }
      allBlocks.push(...section.blocks);
    }
  }

  const sectionChildren = buildChildren(allBlocks);

  // Build header/footer if specified
  const headers = richDoc.header ? {
    default: new docx.Header({
      children: [new docx.Paragraph({
        children: [new docx.TextRun({ text: richDoc.header, font: theme.bodyFont, size: (theme.fontSize - 2) * 2, color: '999999' })],
        alignment: docx.AlignmentType.CENTER,
      })],
    }),
  } : undefined;

  const footerChildren: ParagraphChild[] = [];
  if (richDoc.footer) {
    footerChildren.push(new docx.TextRun({ text: richDoc.footer, font: theme.bodyFont, size: (theme.fontSize - 2) * 2, color: '999999' }));
  }
  if (richDoc.showPageNumbers) {
    if (footerChildren.length > 0) {
      footerChildren.push(new docx.TextRun({ text: '  —  ', font: theme.bodyFont, size: (theme.fontSize - 2) * 2, color: '999999' }));
    }
    footerChildren.push(new docx.TextRun({ children: [docx.PageNumber.CURRENT], font: theme.bodyFont, size: (theme.fontSize - 2) * 2, color: '999999' }));
  }

  const footers = footerChildren.length > 0 ? {
    default: new docx.Footer({
      children: [new docx.Paragraph({
        children: footerChildren,
        alignment: docx.AlignmentType.CENTER,
      })],
    }),
  } : undefined;

  const document = new docx.Document({
    creator: 'Opus Artifacts',
    title: title || 'Document',
    styles: {
      default: {
        document: {
          run: {
            font: theme.bodyFont,
            size: theme.fontSize * 2,
            color: theme.bodyColor,
          },
        },
        heading1: {
          run: { font: theme.headingFont, size: 36, bold: true, color: theme.primaryColor },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        heading2: {
          run: { font: theme.headingFont, size: 28, bold: true, color: theme.primaryColor },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading3: {
          run: { font: theme.headingFont, size: 24, bold: true, color: theme.primaryColor },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading4: {
          run: { font: theme.headingFont, size: 22, bold: true, color: theme.primaryColor },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
        heading5: {
          run: { font: theme.headingFont, size: 20, bold: true, color: theme.primaryColor },
          paragraph: { spacing: { before: 120, after: 80 } },
        },
        heading6: {
          run: { font: theme.headingFont, size: 20, italics: true, color: theme.primaryColor },
          paragraph: { spacing: { before: 120, after: 80 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            { level: 0, format: docx.LevelFormat.BULLET, text: '\u2022', alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: docx.LevelFormat.BULLET, text: '\u25E6', alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: docx.LevelFormat.BULLET, text: '\u25AA', alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
        {
          reference: 'ordered-list',
          levels: [
            { level: 0, format: docx.LevelFormat.DECIMAL, text: '%1.', alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: docx.LevelFormat.LOWER_LETTER, text: '%2)', alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: docx.LevelFormat.LOWER_ROMAN, text: '%3.', alignment: docx.AlignmentType.START, style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
        },
      },
      headers,
      footers,
      children: sectionChildren,
    }],
  });

  return docx.Packer.toBlob(document);
}

// ===== Utility helpers (used by xlsx and slide parsing) =====

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
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

function sanitizeSheetName(name: string, fallback: string): string {
  const sanitized = name
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return fallback;
  return sanitized.slice(0, 31);
}

function splitMarkdownTableLine(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

function parseMarkdownTable(content: string): string[][] | null {
  const lines = normalizeLineEndings(content)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const divider = lines[i + 1];

    if (!header.includes('|')) continue;
    if (!/^[:\-\|\s]+$/.test(divider)) continue;

    const rows: string[][] = [splitMarkdownTableLine(header)];
    for (let j = i + 2; j < lines.length; j++) {
      if (!lines[j].includes('|')) break;
      rows.push(splitMarkdownTableLine(lines[j]));
    }
    return rows;
  }

  return null;
}

function parseDelimited(content: string): string[][] {
  const delimiter = content.includes('\t') && !content.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell.trim());
    currentCell = '';
  };

  const pushRow = () => {
    // Ignore trailing fully-empty rows
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  const text = normalizeLineEndings(content);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && char === '\n') {
      pushCell();
      pushRow();
      continue;
    }

    currentCell += char;
  }

  pushCell();
  pushRow();

  return rows;
}

async function generateXlsxBlob(content: string, title: string): Promise<Blob> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  let sheetCount = 0;

  const addWorksheet = (name: string, sheetData: unknown) => {
    let worksheet;

    if (Array.isArray(sheetData) && sheetData.length > 0 && Array.isArray(sheetData[0])) {
      worksheet = XLSX.utils.aoa_to_sheet(sheetData as unknown[][]);
    } else if (Array.isArray(sheetData) && sheetData.length > 0 && typeof sheetData[0] === 'object') {
      worksheet = XLSX.utils.json_to_sheet(sheetData as Record<string, unknown>[]);
    } else if (Array.isArray(sheetData) && sheetData.length === 0) {
      worksheet = XLSX.utils.aoa_to_sheet([[]]);
    } else if (sheetData && typeof sheetData === 'object') {
      worksheet = XLSX.utils.json_to_sheet([sheetData as Record<string, unknown>]);
    } else if (typeof sheetData === 'string') {
      const rows = parseDelimited(sheetData);
      worksheet = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [[sheetData]]);
    } else {
      worksheet = XLSX.utils.aoa_to_sheet([[String(sheetData ?? '')]]);
    }

    const sheetName = sanitizeSheetName(name, `Sheet${sheetCount + 1}`);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    sheetCount++;
  };

  const parsed = safeJsonParse(content);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const parsedObj = parsed as { sheets?: Record<string, unknown> };
    if (parsedObj.sheets && typeof parsedObj.sheets === 'object') {
      for (const [name, value] of Object.entries(parsedObj.sheets)) {
        addWorksheet(name, value);
      }
    } else {
      addWorksheet('Sheet1', parsed);
    }
  } else if (Array.isArray(parsed)) {
    addWorksheet('Sheet1', parsed);
  } else {
    const markdownTable = parseMarkdownTable(content);
    if (markdownTable) {
      addWorksheet('Sheet1', markdownTable);
    } else {
      const rows = parseDelimited(content);
      if (rows.length > 0) {
        addWorksheet('Sheet1', rows);
      } else {
        addWorksheet('Sheet1', content);
      }
    }
  }

  if (sheetCount === 0) {
    addWorksheet('Sheet1', [['']]);
  }

  const fallbackName = sanitizeSheetName(title, 'Sheet1');
  if (workbook.SheetNames.length === 1 && workbook.SheetNames[0] === 'Sheet1' && fallbackName !== 'Sheet1') {
    workbook.SheetNames[0] = fallbackName;
    workbook.Sheets[fallbackName] = workbook.Sheets.Sheet1;
    delete workbook.Sheets.Sheet1;
  }

  const binary = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([binary], { type: XLSX_MIME });
}

function normalizeBulletText(line: string): string {
  return line
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

function toSlideFromBlocks(blocks: FlatBlock[], fallbackTitle: string): SlideContent | null {
  if (blocks.length === 0) return null;

  let title = fallbackTitle;
  let subtitle: string | undefined;
  const bullets: string[] = [];

  for (const block of blocks) {
    if (block.type === 'heading') {
      if (!title || title === fallbackTitle) {
        title = block.text;
      } else if (!subtitle) {
        subtitle = block.text;
      } else {
        bullets.push(block.text);
      }
      continue;
    }

    if (block.type === 'paragraph') {
      if (!subtitle && block.text.length <= 160) {
        subtitle = block.text;
      } else {
        bullets.push(block.text);
      }
      continue;
    }

    if (block.type === 'list') {
      bullets.push(...block.items.map(item => normalizeBulletText(item)));
      continue;
    }

    if (block.type === 'table') {
      if (block.headers.length > 0) {
        bullets.push(block.headers.join(' | '));
      }
      block.rows.slice(0, 5).forEach((row) => {
        bullets.push(row.join(' | '));
      });
      continue;
    }

    const codeLines = block.text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 5);
    bullets.push(...codeLines.map(line => `Code: ${line}`));
  }

  const normalizedBullets = bullets
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  return {
    title: title || fallbackTitle,
    subtitle,
    bullets: normalizedBullets.length > 0 ? normalizedBullets : [''],
  };
}

function parseSlideValue(value: unknown, fallbackTitle: string): SlideContent | null {
  if (typeof value === 'string') {
    return toSlideFromBlocks(parseDocumentBlocks(value), fallbackTitle);
  }

  if (!isObject(value)) {
    return null;
  }

  const explicitTitle = normalizeTextValue(value.title) || fallbackTitle;
  const subtitle = normalizeTextValue(value.subtitle) || undefined;
  const bullets = toStringArray(value.bullets);
  const paragraphs = toStringArray(value.paragraphs);
  const contentText = typeof value.content === 'string' ? value.content : '';

  const combinedBullets = [...bullets, ...paragraphs];
  if (combinedBullets.length > 0) {
    return {
      title: explicitTitle,
      subtitle,
      bullets: combinedBullets.slice(0, 12),
    };
  }

  if (contentText.trim()) {
    const fromBlocks = toSlideFromBlocks(parseDocumentBlocks(contentText), explicitTitle);
    if (fromBlocks) {
      if (subtitle && !fromBlocks.subtitle) {
        fromBlocks.subtitle = subtitle;
      }
      return fromBlocks;
    }
  }

  return {
    title: explicitTitle,
    subtitle,
    bullets: [''],
  };
}

function splitBlocksIntoSlides(blocks: FlatBlock[], fallbackTitle: string): SlideContent[] {
  if (blocks.length === 0) {
    return [];
  }

  const groups: FlatBlock[][] = [];
  let current: FlatBlock[] = [];

  blocks.forEach((block) => {
    const startsNewSlide = block.type === 'heading' && block.level <= 1 && current.length > 0;
    if (startsNewSlide) {
      groups.push(current);
      current = [block];
      return;
    }
    current.push(block);
  });

  if (current.length > 0) {
    groups.push(current);
  }

  return groups
    .map((group, index) => toSlideFromBlocks(group, `${fallbackTitle} ${index + 1}`))
    .filter((slide): slide is SlideContent => slide !== null);
}

export function parseSlides(content: string, fallbackTitle: string): SlideContent[] {
  const parsed = safeJsonParse(content);

  if (Array.isArray(parsed)) {
    const slides = parsed
      .map((item, index) => parseSlideValue(item, `Slide ${index + 1}`))
      .filter((slide): slide is SlideContent => slide !== null);
    if (slides.length > 0) {
      return slides;
    }
  }

  if (isObject(parsed) && Array.isArray(parsed.slides)) {
    const slides = parsed.slides
      .map((item, index) => parseSlideValue(item, `Slide ${index + 1}`))
      .filter((slide): slide is SlideContent => slide !== null);
    if (slides.length > 0) {
      return slides;
    }
  }

  const normalized = normalizeLineEndings(content);
  if (/\n-{3,}\n/.test(normalized)) {
    const markdownSplit = normalized.split(/\n-{3,}\n/g);
    const slidesFromSplit = markdownSplit
      .map((block, index) => toSlideFromBlocks(parseDocumentBlocks(block), `Slide ${index + 1}`))
      .filter((slide): slide is SlideContent => slide !== null);

    if (slidesFromSplit.length > 0) {
      return slidesFromSplit;
    }
  }

  const slidesFromHeadings = splitBlocksIntoSlides(parseDocumentBlocks(content, fallbackTitle), fallbackTitle || 'Slide');
  if (slidesFromHeadings.length > 0) {
    return slidesFromHeadings;
  }

  return [
    {
      title: fallbackTitle || 'Slide 1',
      subtitle: undefined,
      bullets: [normalizeLineEndings(stripHtmlTags(content)).trim().slice(0, 4000) || ' '],
    },
  ];
}

// --- PptxGenJS-based PPTX generation ---

import type PptxGenJS from 'pptxgenjs';
import { parsePresentationContent } from './presentation-parser';
import type { RichSlide, SlideBullet, SlideTable, SlideChart, SlideImage, SlideShape } from '@/types';

interface ThemeDefaults {
  background: string;
  titleColor: string;
  bodyColor: string;
  accentColor: string;
  titleFont: string;
  bodyFont: string;
}

/** Strip leading # from hex color if present */
function cleanHex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return color.replace(/^#/, '') || fallback;
}

function buildBulletTextRows(
  bullets: SlideBullet[],
  defaults: ThemeDefaults,
): PptxGenJS.TextProps[] {
  const rows: PptxGenJS.TextProps[] = [];
  bullets.forEach((bullet, i) => {
    const isLast = i === bullets.length - 1;
    if (typeof bullet === 'string') {
      rows.push({
        text: bullet,
        options: {
          fontSize: 18,
          fontFace: defaults.bodyFont,
          color: defaults.bodyColor,
          bullet: true,
          paraSpaceAfter: 4,
          breakLine: !isLast,
        },
      });
    } else {
      // Rich text: each run is a separate TextProps entry
      bullet.forEach((run, j) => {
        const isLastRun = j === bullet.length - 1;
        rows.push({
          text: run.text,
          options: {
            bold: run.bold,
            italic: run.italic,
            color: cleanHex(run.color, defaults.bodyColor),
            fontSize: run.fontSize ?? 18,
            fontFace: run.fontFace ?? defaults.bodyFont,
            hyperlink: run.hyperlink ? { url: run.hyperlink } : undefined,
            bullet: j === 0 ? true : undefined,
            paraSpaceAfter: isLastRun ? 4 : undefined,
            breakLine: isLastRun && !isLast,
          },
        });
      });
    }
  });
  return rows;
}

function addTitle(
  slide: PptxGenJS.Slide,
  title: string,
  opts: { x: number; y: number; w: number; h: number; fontSize: number; color: string; font: string; align?: PptxGenJS.HAlign; valign?: PptxGenJS.VAlign; bold?: boolean },
) {
  slide.addText(title, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fontSize: opts.fontSize,
    fontFace: opts.font,
    color: opts.color,
    bold: opts.bold ?? true,
    align: opts.align ?? 'left',
    valign: opts.valign ?? 'top',
    wrap: true,
  });
}

function addBullets(
  slide: PptxGenJS.Slide,
  bullets: SlideBullet[],
  defaults: ThemeDefaults,
  pos: { x: number; y: number; w: number; h: number },
) {
  if (!bullets || bullets.length === 0) return;
  slide.addText(buildBulletTextRows(bullets, defaults), {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    valign: 'top',
    wrap: true,
  });
}

function addBodyText(
  slide: PptxGenJS.Slide,
  body: string,
  defaults: ThemeDefaults,
  pos: { x: number; y: number; w: number; h: number },
) {
  slide.addText(body, {
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    fontSize: 16,
    fontFace: defaults.bodyFont,
    color: defaults.bodyColor,
    valign: 'top',
    wrap: true,
  });
}

function renderTitleSlide(slide: PptxGenJS.Slide, data: RichSlide, defaults: ThemeDefaults) {
  if (data.title) {
    addTitle(slide, data.title, {
      x: 0.5, y: 1.5, w: 9.0, h: 1.5,
      fontSize: 36, color: cleanHex(data.titleColor, defaults.titleColor),
      font: defaults.titleFont, align: 'center', valign: 'bottom',
    });
  }
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.0, y: 3.2, w: 8.0, h: 0.8,
      fontSize: 20, fontFace: defaults.bodyFont,
      color: cleanHex(data.bodyColor, defaults.bodyColor),
      align: 'center', valign: 'top', wrap: true,
    });
  }
  // Accent bar under title
  slide.addShape('rect' as unknown as PptxGenJS.ShapeType, {
    x: 3.5, y: 3.0, w: 3.0, h: 0.05,
    fill: { color: defaults.accentColor },
  });
}

function renderSectionSlide(slide: PptxGenJS.Slide, data: RichSlide, defaults: ThemeDefaults) {
  // Override background with accent color for section slides
  slide.background = { fill: cleanHex(data.background, defaults.accentColor) };
  if (data.title) {
    addTitle(slide, data.title, {
      x: 0.5, y: 1.5, w: 9.0, h: 2.0,
      fontSize: 32, color: 'FFFFFF',
      font: defaults.titleFont, align: 'center', valign: 'middle',
    });
  }
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.0, y: 3.5, w: 8.0, h: 0.8,
      fontSize: 18, fontFace: defaults.bodyFont,
      color: 'FFFFFF', align: 'center', valign: 'top', wrap: true,
    });
  }
}

function renderTitleContentSlide(slide: PptxGenJS.Slide, data: RichSlide, defaults: ThemeDefaults) {
  const titleColor = cleanHex(data.titleColor, defaults.titleColor);
  if (data.title) {
    addTitle(slide, data.title, {
      x: 0.5, y: 0.3, w: 9.0, h: 0.8,
      fontSize: 28, color: titleColor, font: defaults.titleFont,
    });
    // Thin accent line under title
    slide.addShape('rect' as unknown as PptxGenJS.ShapeType, {
      x: 0.5, y: 1.15, w: 2.0, h: 0.04,
      fill: { color: defaults.accentColor },
    });
  }
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.5, y: 1.3, w: 9.0, h: 0.5,
      fontSize: 16, fontFace: defaults.bodyFont,
      color: cleanHex(data.bodyColor, defaults.bodyColor),
      italic: true, valign: 'top', wrap: true,
    });
  }
  const contentY = data.subtitle ? 1.9 : 1.4;
  const contentH = 5.625 - contentY - 0.3;
  if (data.bullets && data.bullets.length > 0) {
    addBullets(slide, data.bullets, defaults, { x: 0.5, y: contentY, w: 9.0, h: contentH });
  } else if (data.body) {
    addBodyText(slide, data.body, defaults, { x: 0.5, y: contentY, w: 9.0, h: contentH });
  }
}

function renderTwoColumnSlide(slide: PptxGenJS.Slide, data: RichSlide, defaults: ThemeDefaults) {
  if (data.title) {
    addTitle(slide, data.title, {
      x: 0.5, y: 0.3, w: 9.0, h: 0.8,
      fontSize: 28, color: cleanHex(data.titleColor, defaults.titleColor), font: defaults.titleFont,
    });
  }
  // Left column: bullets
  if (data.bullets && data.bullets.length > 0) {
    addBullets(slide, data.bullets, defaults, { x: 0.5, y: 1.4, w: 4.3, h: 3.9 });
  }
  // Right column: body text
  if (data.body) {
    addBodyText(slide, data.body, defaults, { x: 5.2, y: 1.4, w: 4.3, h: 3.9 });
  }
}

function renderImageSlide(slide: PptxGenJS.Slide, data: RichSlide, defaults: ThemeDefaults, imageRight: boolean) {
  const imgX = imageRight ? 5.2 : 0.5;
  const contentX = imageRight ? 0.5 : 5.2;

  if (data.title) {
    addTitle(slide, data.title, {
      x: 0.5, y: 0.3, w: 9.0, h: 0.8,
      fontSize: 28, color: cleanHex(data.titleColor, defaults.titleColor), font: defaults.titleFont,
    });
  }
  // Place first image in the image area
  if (data.images && data.images.length > 0) {
    const img = data.images[0];
    const imgProps: Record<string, unknown> = {
      x: imgX, y: 1.4, w: 4.3, h: 3.9,
    };
    if (img.data) imgProps.data = img.data;
    else if (img.path) imgProps.path = img.path;
    if (imgProps.data || imgProps.path) {
      slide.addImage(imgProps as PptxGenJS.ImageProps);
    }
  }
  // Content in the other half
  if (data.bullets && data.bullets.length > 0) {
    addBullets(slide, data.bullets, defaults, { x: contentX, y: 1.4, w: 4.3, h: 3.9 });
  } else if (data.body) {
    addBodyText(slide, data.body, defaults, { x: contentX, y: 1.4, w: 4.3, h: 3.9 });
  }
}

function renderSlideTable(slide: PptxGenJS.Slide, table: SlideTable, defaults: ThemeDefaults) {
  const rows: PptxGenJS.TableRow[] = [];
  const headerFill = cleanHex(table.headerFill, defaults.accentColor);
  const headerColor = cleanHex(table.headerColor, 'FFFFFF');
  const borderColor = cleanHex(table.borderColor, 'CCCCCC');

  if (table.headers && table.headers.length > 0) {
    rows.push(table.headers.map(h => {
      const text = typeof h === 'string' ? h : h.text;
      return {
        text,
        options: {
          bold: true,
          color: headerColor,
          fill: { color: headerFill },
          align: 'center' as PptxGenJS.HAlign,
          fontSize: 14,
          fontFace: defaults.bodyFont,
          border: { type: 'solid' as const, pt: 0.5, color: borderColor },
        },
      };
    }));
  }

  for (const row of table.rows) {
    rows.push(row.map(cell => {
      const isObj = typeof cell === 'object' && cell !== null;
      const text = isObj ? cell.text : cell;
      return {
        text,
        options: {
          bold: isObj ? cell.bold : undefined,
          color: isObj && cell.color ? cleanHex(cell.color, defaults.bodyColor) : defaults.bodyColor,
          fill: isObj && cell.fill ? { color: cleanHex(cell.fill, 'FFFFFF') } : undefined,
          align: (isObj ? cell.align : 'left') as PptxGenJS.HAlign,
          fontSize: 12,
          fontFace: defaults.bodyFont,
          border: { type: 'solid' as const, pt: 0.5, color: borderColor },
          colspan: isObj ? cell.colspan : undefined,
          rowspan: isObj ? cell.rowspan : undefined,
        },
      };
    }));
  }

  if (rows.length > 0) {
    slide.addTable(rows, {
      x: 0.5, y: 1.5, w: 9.0,
      colW: Array(rows[0]?.length || 1).fill(9.0 / (rows[0]?.length || 1)),
      autoPage: false,
    });
  }
}

function renderSlideChart(pres: PptxGenJS, slide: PptxGenJS.Slide, chart: SlideChart, defaults: ThemeDefaults) {
  const chartTypeMap: Record<string, PptxGenJS.CHART_NAME> = {
    bar: pres.ChartType.bar,
    line: pres.ChartType.line,
    pie: pres.ChartType.pie,
    doughnut: pres.ChartType.doughnut,
    area: pres.ChartType.area,
    radar: pres.ChartType.radar,
    scatter: pres.ChartType.scatter,
  };

  const chartType = chartTypeMap[chart.type] ?? pres.ChartType.bar;
  const chartData = chart.data.map(series => ({
    name: series.name,
    labels: series.labels,
    values: series.values,
  }));

  const colors = chart.chartColors?.map(c => cleanHex(c, defaults.accentColor))
    ?? [defaults.accentColor, '10B981', 'F59E0B', 'EF4444', '8B5CF6', '06B6D4'];

  slide.addChart(chartType, chartData, {
    x: 0.5, y: 1.5, w: 9.0, h: 3.8,
    showTitle: !!chart.title,
    title: chart.title,
    showLegend: chart.showLegend ?? true,
    legendPos: 'b',
    showValue: chart.showValue ?? false,
    chartColors: colors,
  });
}

function renderSlideImages(slide: PptxGenJS.Slide, images: SlideImage[]) {
  for (const img of images) {
    const props: Record<string, unknown> = {
      x: img.x ?? 0.5,
      y: img.y ?? 1.5,
      w: img.w ?? 4.0,
      h: img.h ?? 3.0,
    };
    if (img.data) props.data = img.data;
    else if (img.path) props.path = img.path;
    if (props.data || props.path) {
      slide.addImage(props as PptxGenJS.ImageProps);
    }
  }
}

function renderSlideShapes(pres: PptxGenJS, slide: PptxGenJS.Slide, shapes: SlideShape[], defaults: ThemeDefaults) {
  const shapeMap: Record<string, PptxGenJS.ShapeType> = {
    rect: pres.ShapeType.rect,
    ellipse: pres.ShapeType.ellipse,
    roundRect: pres.ShapeType.roundRect,
    line: pres.ShapeType.line,
  };

  for (const shape of shapes) {
    const shapeType = shapeMap[shape.type] ?? pres.ShapeType.rect;
    const opts: Record<string, unknown> = {
      x: shape.x,
      y: shape.y,
      w: shape.w,
      h: shape.h,
    };
    if (shape.fill) opts.fill = { color: cleanHex(shape.fill, defaults.accentColor) };
    if (shape.line) {
      opts.line = {
        color: cleanHex(shape.line.color, '333333'),
        width: shape.line.width ?? 1,
      };
    }
    if (shape.rectRadius !== undefined) opts.rectRadius = shape.rectRadius;
    slide.addShape(shapeType, opts as PptxGenJS.ShapeProps);

    if (shape.text) {
      slide.addText(shape.text, {
        x: shape.x,
        y: shape.y,
        w: shape.w,
        h: shape.h,
        fontSize: shape.fontSize ?? 14,
        fontFace: defaults.bodyFont,
        color: cleanHex(shape.color, defaults.bodyColor),
        align: (shape.align ?? 'center') as PptxGenJS.HAlign,
        valign: 'middle',
      });
    }
  }
}

async function generatePptxBlob(content: string, title: string): Promise<Blob> {
  const PptxGenJSLib = (await import('pptxgenjs')).default;
  const pres = new PptxGenJSLib();

  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Opus Artifacts';
  pres.title = title || 'Presentation';

  const richPres = parsePresentationContent(content, title || 'Presentation');
  const theme = richPres.theme ?? {};

  const defaults: ThemeDefaults = {
    background: cleanHex(theme.background, 'FFFFFF'),
    titleColor: cleanHex(theme.titleColor, '1A1A2E'),
    bodyColor: cleanHex(theme.bodyColor, '333333'),
    accentColor: cleanHex(theme.accentColor, '3B82F6'),
    titleFont: theme.titleFont ?? 'Arial',
    bodyFont: theme.bodyFont ?? 'Calibri',
  };

  for (const slideData of richPres.slides) {
    const slide = pres.addSlide();
    const bg = cleanHex(slideData.background, defaults.background);
    slide.background = { fill: bg };

    const layout = slideData.layout ?? 'title-content';

    switch (layout) {
      case 'title':
        renderTitleSlide(slide, slideData, defaults);
        break;
      case 'section':
        renderSectionSlide(slide, slideData, defaults);
        break;
      case 'two-column':
        renderTwoColumnSlide(slide, slideData, defaults);
        break;
      case 'image-left':
        renderImageSlide(slide, slideData, defaults, false);
        break;
      case 'image-right':
        renderImageSlide(slide, slideData, defaults, true);
        break;
      case 'blank':
        // No layout-specific content
        break;
      case 'title-content':
      default:
        renderTitleContentSlide(slide, slideData, defaults);
        break;
    }

    // Optional elements (added on top of layout)
    if (slideData.table) renderSlideTable(slide, slideData.table, defaults);
    if (slideData.chart) renderSlideChart(pres, slide, slideData.chart, defaults);
    // For non-image layouts, render images if present
    if (layout !== 'image-left' && layout !== 'image-right' && slideData.images) {
      renderSlideImages(slide, slideData.images);
    }
    if (slideData.shapes) renderSlideShapes(pres, slide, slideData.shapes, defaults);
    if (slideData.notes) slide.addNotes(slideData.notes);
  }

  const output = await pres.write({ outputType: 'blob' });
  return output as Blob;
}
