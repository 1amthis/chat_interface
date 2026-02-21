import { Artifact, ArtifactOutputFormat } from '@/types';

export interface ArtifactExportOption {
  format: ArtifactOutputFormat;
  label: string;
}

type RichBlock =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code'; text: string; language?: string };

interface SlideContent {
  title: string;
  subtitle?: string;
  bullets: string[];
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const SOURCE_EXTENSIONS: Record<Artifact['type'], string> = {
  code: 'txt',
  html: 'html',
  react: 'jsx',
  markdown: 'md',
  svg: 'svg',
  mermaid: 'mmd',
  document: 'md',
  spreadsheet: 'csv',
  presentation: 'md',
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
  presentation: 'text/markdown',
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function renderDocxTextRun(text: string, monospace = false): string {
  const segments = normalizeLineEndings(text).split('\n');
  const runProps = monospace
    ? '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr>'
    : '';

  let xml = `<w:r>${runProps}`;
  segments.forEach((segment, index) => {
    if (index > 0) {
      xml += '<w:br/>';
    }
    xml += `<w:t xml:space="preserve">${escapeXml(segment || ' ')}</w:t>`;
  });
  xml += '</w:r>';
  return xml;
}

function renderDocxParagraph(
  text: string,
  options?: { styleId?: string; indentTwips?: number; monospace?: boolean }
): string {
  const pPrParts: string[] = [];
  if (options?.styleId) {
    pPrParts.push(`<w:pStyle w:val="${options.styleId}"/>`);
  }
  if (options?.indentTwips) {
    pPrParts.push(`<w:ind w:left="${options.indentTwips}"/>`);
  }

  const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';
  return `<w:p>${pPr}${renderDocxTextRun(text, options?.monospace)}</w:p>`;
}

function renderDocxTable(headers: string[], rows: string[][]): string {
  const allRows = headers.length > 0 ? [headers, ...rows] : rows;
  const columnCount = allRows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedRows = allRows.map(row => {
    const padded = [...row];
    while (padded.length < columnCount) padded.push('');
    return padded;
  });

  const columnWidth = columnCount > 0 ? Math.floor(9000 / columnCount) : 3000;
  const grid = Array.from({ length: Math.max(columnCount, 1) })
    .map(() => `<w:gridCol w:w="${columnWidth}"/>`)
    .join('');

  const tableRows = normalizedRows.map((row, rowIndex) => {
    const cells = row.map((cell) => {
      const cellParagraph = renderDocxParagraph(cell, {
        styleId: rowIndex === 0 && headers.length > 0 ? 'TableHeader' : undefined,
      });
      return `<w:tc><w:tcPr><w:tcW w:w="${columnWidth}" w:type="dxa"/></w:tcPr>${cellParagraph}</w:tc>`;
    }).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="8" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="8" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="8" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="8" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="8" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="8" w:space="0" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${grid}</w:tblGrid>
    ${tableRows}
  </w:tbl>`;
}

async function generateDocxBlob(content: string, title: string): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const blocks = parseDocumentBlocks(content, title);

  const bodyParts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'heading') {
      const styleId = block.level <= 1 ? 'Heading1' : block.level === 2 ? 'Heading2' : 'Heading3';
      bodyParts.push(renderDocxParagraph(block.text, { styleId }));
      continue;
    }

    if (block.type === 'paragraph') {
      bodyParts.push(renderDocxParagraph(block.text));
      continue;
    }

    if (block.type === 'list') {
      block.items.forEach((item, index) => {
        const prefix = block.ordered ? `${index + 1}. ` : '- ';
        bodyParts.push(renderDocxParagraph(`${prefix}${item}`, { indentTwips: 360 }));
      });
      continue;
    }

    if (block.type === 'table') {
      bodyParts.push(renderDocxTable(block.headers, block.rows));
      continue;
    }

    const codeText = block.text || '';
    if (!codeText.trim()) {
      bodyParts.push('<w:p/>');
    } else {
      codeText.split('\n').forEach((line) => {
        bodyParts.push(renderDocxParagraph(line, { styleId: 'CodeBlock', monospace: true }));
      });
    }
  }

  const bodyXml = bodyParts.length > 0 ? bodyParts.join('') : '<w:p/>';

  const createdAt = new Date().toISOString();
  const safeTitle = escapeXml(title || 'Artifact');

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${safeTitle}</dc:title>
  <dc:creator>Opus Artifacts</dc:creator>
  <cp:lastModifiedBy>Opus Artifacts</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`);

  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Opus Artifacts</Application>
</Properties>`);

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="80" w:after="80"/>
      <w:shd w:val="clear" w:fill="F3F4F6"/>
      <w:ind w:left="240" w:right="240"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>
      <w:sz w:val="20"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader">
    <w:name w:val="Table Header"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
    </w:rPr>
  </w:style>
</w:styles>`);

  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

  return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME });
}

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

function isMarkdownTableHeaderLine(line: string, nextLine?: string): boolean {
  if (!line.includes('|') || !nextLine) return false;
  return /^[:\-\|\s]+$/.test(nextLine.trim());
}

function splitMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

function looksLikeListItem(line: string): boolean {
  return /^([-*+]|\d+\.)\s+/.test(line.trim());
}

function parseRichBlocksFromText(content: string): RichBlock[] {
  const lines = normalizeLineEndings(content).split('\n');
  const blocks: RichBlock[] = [];

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

function parseRichBlocksFromBlockSpec(block: unknown): RichBlock[] {
  if (typeof block === 'string') {
    return parseRichBlocksFromText(block);
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
    const headers = toStringArray(block.headers);
    const rows = Array.isArray(block.rows)
      ? block.rows.map((row) => Array.isArray(row) ? row.map(cell => String(cell ?? '').trim()) : [])
      : [];
    if (headers.length === 0 && rows.length === 0) return [];
    return [{ type: 'table', headers, rows }];
  }

  if (type === 'code') {
    const text = normalizeTextValue(block.text || block.content);
    if (!text) return [];
    const language = normalizeTextValue(block.language) || undefined;
    return [{ type: 'code', text, language }];
  }

  return [];
}

function parseRichBlocksFromJson(value: unknown): RichBlock[] | null {
  if (Array.isArray(value)) {
    const blocks = value.flatMap(parseRichBlocksFromBlockSpec);
    return blocks.length > 0 ? blocks : null;
  }

  if (!isObject(value)) {
    return null;
  }

  const blocks: RichBlock[] = [];

  if (typeof value.title === 'string' && value.title.trim()) {
    blocks.push({ type: 'heading', text: value.title.trim(), level: 1 });
  }

  if (Array.isArray(value.blocks)) {
    blocks.push(...value.blocks.flatMap(parseRichBlocksFromBlockSpec));
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

      const bullets = toStringArray(section.bullets);
      if (bullets.length > 0) {
        blocks.push({ type: 'list', ordered: false, items: bullets });
      }

      if (section.table && isObject(section.table)) {
        const headers = toStringArray(section.table.headers);
        const rows = Array.isArray(section.table.rows)
          ? section.table.rows.map((row) => Array.isArray(row) ? row.map(cell => String(cell ?? '').trim()) : [])
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
    blocks.push(...parseRichBlocksFromText(value.content));
  }

  return blocks.length > 0 ? blocks : null;
}

function parseDocumentBlocks(content: string, fallbackTitle?: string): RichBlock[] {
  const parsed = safeJsonParse(content);
  let blocks: RichBlock[] | null = parsed ? parseRichBlocksFromJson(parsed) : null;

  if (!blocks || blocks.length === 0) {
    blocks = parseRichBlocksFromText(content);
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

function toSlideFromBlocks(blocks: RichBlock[], fallbackTitle: string): SlideContent | null {
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

function splitBlocksIntoSlides(blocks: RichBlock[], fallbackTitle: string): SlideContent[] {
  if (blocks.length === 0) {
    return [];
  }

  const groups: RichBlock[][] = [];
  let current: RichBlock[] = [];

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

function parseSlides(content: string, fallbackTitle: string): SlideContent[] {
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

function buildSlideXml(slide: SlideContent, slideNumber: number): string {
  const title = escapeXml(slide.title || `Slide ${slideNumber}`);
  const subtitle = slide.subtitle ? escapeXml(slide.subtitle) : '';
  const subtitleParagraph = subtitle
    ? `<a:p><a:r><a:rPr lang="en-US" sz="2000" b="1"/><a:t>${subtitle}</a:t></a:r><a:endParaRPr lang="en-US" sz="2000"/></a:p>`
    : '';

  const bodyParagraphs = slide.bullets
    .filter(line => line !== null && line !== undefined)
    .map((line) => {
      const text = escapeXml(line || ' ');
      if (!text.trim()) {
        return '<a:p><a:endParaRPr lang="en-US" sz="1800"/></a:p>';
      }
      return `<a:p><a:pPr lvl="0"><a:buChar char="-"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800"/><a:t>${text}</a:t></a:r><a:endParaRPr lang="en-US" sz="1800"/></a:p>`;
    })
    .join('');

  const contentXml = `${subtitleParagraph}${bodyParagraphs}` || '<a:p><a:endParaRPr lang="en-US" sz="1800"/></a:p>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Slide ${slideNumber}">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title ${slideNumber}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="457200"/>
            <a:ext cx="7772400" cy="914400"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="3200" b="1"/>
              <a:t>${title}</a:t>
            </a:r>
            <a:endParaRPr lang="en-US" sz="3200"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content ${slideNumber}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="1600200"/>
            <a:ext cx="7772400" cy="4572000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:lstStyle/>
          ${contentXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
}

async function generatePptxBlob(content: string, title: string): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const slides = parseSlides(content, title || 'Presentation');
  const createdAt = new Date().toISOString();

  const slideOverrides = slides
    .map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join('');

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title || 'Presentation')}</dc:title>
  <dc:creator>Opus Artifacts</dc:creator>
  <cp:lastModifiedBy>Opus Artifacts</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`);

  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Opus Artifacts</Application>
  <Slides>${slides.length}</Slides>
</Properties>`);

  const slideIdList = slides
    .map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 4}"/>`)
    .join('');

  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIdList}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle>
    <a:defPPr/>
    <a:lvl1pPr marL="0" indent="0">
      <a:defRPr sz="1800"/>
    </a:lvl1pPr>
  </p:defaultTextStyle>
</p:presentation>`);

  const presentationSlideRels = slides
    .map((_, index) => `<Relationship Id="rId${index + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`)
    .join('');

  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
  ${presentationSlideRels}
</Relationships>`);

  zip.file('ppt/presProps.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);

  zip.file('ppt/viewProps.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);

  zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Simple Slide Master">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle>
      <a:lvl1pPr algn="l"/>
    </p:titleStyle>
    <p:bodyStyle>
      <a:lvl1pPr marL="342900" indent="-285750"/>
    </p:bodyStyle>
    <p:otherStyle>
      <a:defPPr/>
    </p:otherStyle>
  </p:txStyles>
</p:sldMaster>`);

  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

  zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="titleAndContent" preserve="1">
  <p:cSld name="Title and Content">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title Placeholder 1"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content Placeholder 2"/>
          <p:cNvSpPr>
            <a:spLocks noGrp="1"/>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="body" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p/>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sldLayout>`);

  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

  zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Simple Theme">
  <a:themeElements>
    <a:clrScheme name="Simple">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
      <a:accent2><a:srgbClr val="C0504D"/></a:accent2>
      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>
      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
      <a:accent6><a:srgbClr val="F79646"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Simple">
      <a:majorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Simple">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">
          <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
          <a:prstDash val="solid"/>
        </a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`);

  slides.forEach((slide, index) => {
    const slideIndex = index + 1;
    zip.file(`ppt/slides/slide${slideIndex}.xml`, buildSlideXml(slide, slideIndex));
    zip.file(`ppt/slides/_rels/slide${slideIndex}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  });

  return zip.generateAsync({ type: 'blob', mimeType: PPTX_MIME });
}
