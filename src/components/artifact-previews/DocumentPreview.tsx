'use client';

import { useMemo } from 'react';
import { parseDocumentContent } from '@/lib/document-parser';
import type { DocumentBlock, DocumentTheme, DocRichText, DocListItem, DocTableCell } from '@/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from '@/components/ThemeProvider';

interface DocumentPreviewProps {
  content: string;
}

// ===== Theme resolution =====

function cleanHex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return color.replace(/^#/, '') || fallback;
}

function hexToCSS(hex: string): string {
  return `#${hex}`;
}

interface ResolvedTheme {
  primaryColor: string;
  bodyColor: string;
  accentColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  fontSize: number;
  lineSpacing: number;
}

function resolveDocTheme(theme?: DocumentTheme): ResolvedTheme {
  return {
    primaryColor: cleanHex(theme?.primaryColor, '1A1A2E'),
    bodyColor: cleanHex(theme?.bodyColor, '333333'),
    accentColor: cleanHex(theme?.accentColor, '3B82F6'),
    backgroundColor: cleanHex(theme?.backgroundColor, 'FFFFFF'),
    headingFont: theme?.headingFont ?? 'Georgia, serif',
    bodyFont: theme?.bodyFont ?? 'Calibri, sans-serif',
    fontSize: theme?.fontSize ?? 11,
    lineSpacing: theme?.lineSpacing ?? 1.15,
  };
}

function toImageLength(value: number | undefined): string | undefined {
  if (!Number.isFinite(value) || !value || value <= 0) return undefined;

  // Doc schema expects inches, but imported content can sometimes provide px.
  if (value > 40) return `${Math.round(value)}px`;
  return `${value}in`;
}

// ===== Rich text renderer =====

function RichTextRenderer({ text, theme }: { text: DocRichText; theme: ResolvedTheme }) {
  if (typeof text === 'string') {
    return <>{text}</>;
  }

  return (
    <>
      {text.map((run, i) => {
        const style: React.CSSProperties = {
          fontWeight: run.bold ? 700 : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          textDecoration: [
            run.underline ? 'underline' : '',
            run.strikethrough ? 'line-through' : '',
          ].filter(Boolean).join(' ') || undefined,
          color: run.color ? hexToCSS(cleanHex(run.color, theme.bodyColor)) : undefined,
          fontSize: run.fontSize ? `${run.fontSize}pt` : undefined,
          fontFamily: run.fontFace ?? undefined,
          verticalAlign: run.superscript ? 'super' : run.subscript ? 'sub' : undefined,
        };

        if (run.code) {
          return (
            <code
              key={i}
              style={{
                ...style,
                fontFamily: 'Consolas, "Courier New", monospace',
                background: 'rgba(0,0,0,0.06)',
                padding: '0.15em 0.35em',
                borderRadius: '3px',
                fontSize: '0.9em',
              }}
            >
              {run.text}
            </code>
          );
        }

        if (run.hyperlink) {
          return (
            <a
              key={i}
              href={run.hyperlink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...style,
                color: hexToCSS(cleanHex(run.color, theme.accentColor)),
                textDecoration: 'underline',
              }}
            >
              {run.text}
            </a>
          );
        }

        return <span key={i} style={style}>{run.text}</span>;
      })}
    </>
  );
}

// ===== Block renderers =====

function HeadingBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'heading' }>; theme: ResolvedTheme }) {
  const sizes: Record<number, string> = {
    1: '1.8em',
    2: '1.45em',
    3: '1.2em',
    4: '1.05em',
    5: '0.95em',
    6: '0.85em',
  };

  return (
    <div style={{
      fontSize: sizes[block.level] || '1em',
      fontWeight: 700,
      color: hexToCSS(theme.primaryColor),
      fontFamily: theme.headingFont,
      marginTop: block.level <= 2 ? '1.2em' : '0.8em',
      marginBottom: '0.4em',
      lineHeight: 1.3,
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      borderBottom: block.level === 1 ? `2px solid ${hexToCSS(theme.accentColor)}` : undefined,
      paddingBottom: block.level === 1 ? '0.3em' : undefined,
    }}>
      <RichTextRenderer text={block.text} theme={theme} />
    </div>
  );
}

function ParagraphBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'paragraph' }>; theme: ResolvedTheme }) {
  return (
    <p style={{
      margin: '0.6em 0',
      lineHeight: theme.lineSpacing,
      color: hexToCSS(theme.bodyColor),
      fontFamily: theme.bodyFont,
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    }}>
      <RichTextRenderer text={block.text} theme={theme} />
    </p>
  );
}

function ListItemContent({ item, theme }: { item: string | DocListItem; theme: ResolvedTheme }) {
  if (typeof item === 'string') return <>{item}</>;
  return (
    <>
      <RichTextRenderer text={item.text} theme={theme} />
      {item.children && item.children.length > 0 && (
        <ul style={{ paddingLeft: '1.5em', marginTop: '0.2em', listStyleType: 'circle' }}>
          {item.children.map((child, i) => (
            <li key={i} style={{ marginBottom: '0.2em' }}>
              <ListItemContent item={child} theme={theme} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ListBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'list' }>; theme: ResolvedTheme }) {
  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag style={{
      margin: '0.6em 0',
      paddingLeft: '1.8em',
      listStyleType: block.ordered ? 'decimal' : 'disc',
      color: hexToCSS(theme.bodyColor),
      fontFamily: theme.bodyFont,
      lineHeight: theme.lineSpacing,
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    }}>
      {block.items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.3em' }}>
          <ListItemContent item={item} theme={theme} />
        </li>
      ))}
    </Tag>
  );
}

function TableBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'table' }>; theme: ResolvedTheme }) {
  const table = block.table;
  const headerFill = cleanHex(table.headerFill, theme.accentColor);
  const headerColor = cleanHex(table.headerColor, 'FFFFFF');
  const borderColor = cleanHex(table.borderColor, 'D1D5DB');
  const borderStyle = `1px solid ${hexToCSS(borderColor)}`;

  const renderCell = (cell: string | DocTableCell) => {
    const isObj = typeof cell === 'object' && cell !== null;
    return {
      text: isObj ? cell.text : cell,
      bold: isObj ? cell.bold : undefined,
      fill: isObj ? cell.fill : undefined,
      color: isObj ? cell.color : undefined,
      align: isObj ? cell.align : undefined,
    };
  };

  return (
    <div style={{ margin: '0.8em 0', overflowX: 'auto' }}>
      {table.caption && (
        <div style={{ fontSize: '0.85em', color: hexToCSS(theme.bodyColor), marginBottom: '0.3em', fontStyle: 'italic' }}>
          {table.caption}
        </div>
      )}
      <table style={{
        borderCollapse: 'collapse',
        width: '100%',
        tableLayout: 'fixed',
        fontSize: '0.9em',
        fontFamily: theme.bodyFont,
      }}>
        {table.headers && table.headers.length > 0 && (
          <thead>
            <tr>
              {table.headers.map((h, i) => {
                const cell = renderCell(h);
                return (
                  <th key={i} style={{
                    background: hexToCSS(cell.fill ? cleanHex(cell.fill, headerFill) : headerFill),
                    color: hexToCSS(cell.color ? cleanHex(cell.color, headerColor) : headerColor),
                    padding: '6px 10px',
                    border: borderStyle,
                    fontWeight: 600,
                    textAlign: cell.align ?? 'left',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}>
                    {cell.text}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 1 ? 'rgba(0,0,0,0.02)' : undefined }}>
              {row.map((c, ci) => {
                const cell = renderCell(c);
                return (
                  <td key={ci} style={{
                    padding: '5px 10px',
                    border: borderStyle,
                    color: cell.color ? hexToCSS(cleanHex(cell.color, theme.bodyColor)) : hexToCSS(theme.bodyColor),
                    background: cell.fill ? hexToCSS(cleanHex(cell.fill, 'FFFFFF')) : undefined,
                    fontWeight: cell.bold ? 600 : undefined,
                    textAlign: cell.align ?? 'left',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ block, theme, isDark }: { block: Extract<DocumentBlock, { type: 'code' }>; theme: ResolvedTheme; isDark: boolean }) {
  const { code } = block;
  return (
    <div style={{ margin: '0.8em 0' }}>
      {code.caption && (
        <div style={{ fontSize: '0.8em', color: hexToCSS(theme.bodyColor), marginBottom: '0.3em', fontWeight: 600 }}>
          {code.caption}
        </div>
      )}
      <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color, #e5e7eb)' }}>
        <SyntaxHighlighter
          language={code.language || 'text'}
          style={isDark ? oneDark : oneLight}
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: '12px 16px',
            fontSize: '0.85em',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {code.code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function ImageBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'image' }>; theme: ResolvedTheme }) {
  const img = block.image;
  const src = img.data || img.path;
  if (!src) return null;
  const width = toImageLength(img.width);
  const height = toImageLength(img.height);

  return (
    <figure style={{
      margin: '0.8em 0',
      textAlign: img.align ?? 'center',
    }}>
      <img
        src={src}
        alt={img.alt || ''}
        style={{
          width: width ?? 'auto',
          height: height ?? 'auto',
          maxWidth: '100%',
          maxHeight: '70vh',
          objectFit: 'contain',
          borderRadius: '4px',
          border: '1px solid var(--border-color, #e5e7eb)',
        }}
      />
      {img.caption && (
        <figcaption style={{
          fontSize: '0.8em',
          color: hexToCSS(theme.bodyColor),
          marginTop: '0.4em',
          fontStyle: 'italic',
        }}>
          {img.caption}
        </figcaption>
      )}
    </figure>
  );
}

function BlockquoteBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'blockquote' }>; theme: ResolvedTheme }) {
  return (
    <blockquote style={{
      margin: '0.8em 0',
      padding: '0.6em 1em',
      borderLeft: `4px solid ${hexToCSS(theme.accentColor)}`,
      background: 'rgba(0,0,0,0.02)',
      borderRadius: '0 4px 4px 0',
      fontStyle: 'italic',
      color: hexToCSS(theme.bodyColor),
      fontFamily: theme.bodyFont,
      lineHeight: theme.lineSpacing,
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    }}>
      <RichTextRenderer text={block.text} theme={theme} />
    </blockquote>
  );
}

const CALLOUT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  note: { bg: 'rgba(107,114,128,0.08)', border: '#6B7280', icon: '\u{1F4DD}' },
  info: { bg: 'rgba(59,130,246,0.08)', border: '#3B82F6', icon: '\u{2139}\u{FE0F}' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: '#F59E0B', icon: '\u{26A0}\u{FE0F}' },
  tip: { bg: 'rgba(16,185,129,0.08)', border: '#10B981', icon: '\u{1F4A1}' },
};

function CalloutBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'callout' }>; theme: ResolvedTheme }) {
  const calloutType = block.callout.type ?? 'note';
  const style = CALLOUT_STYLES[calloutType] ?? CALLOUT_STYLES.note;

  return (
    <div style={{
      margin: '0.8em 0',
      padding: '0.8em 1em',
      background: style.bg,
      borderLeft: `4px solid ${style.border}`,
      borderRadius: '0 6px 6px 0',
      fontFamily: theme.bodyFont,
      lineHeight: theme.lineSpacing,
      color: hexToCSS(theme.bodyColor),
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3em', textTransform: 'capitalize' }}>
        {style.icon} {calloutType}
      </div>
      <RichTextRenderer text={block.callout.text} theme={theme} />
    </div>
  );
}

function BreakBlock({ block, theme }: { block: Extract<DocumentBlock, { type: 'break' }>; theme: ResolvedTheme }) {
  if (block.break.type === 'page-break') {
    return (
      <div style={{
        margin: '1.5em 0',
        borderTop: `2px dashed ${hexToCSS(theme.accentColor)}`,
        position: 'relative',
        textAlign: 'center',
      }}>
        <span style={{
          position: 'relative',
          top: '-0.7em',
          background: hexToCSS(theme.backgroundColor),
          padding: '0 0.8em',
          fontSize: '0.7em',
          color: hexToCSS(theme.accentColor),
          fontFamily: theme.bodyFont,
        }}>
          Page Break
        </span>
      </div>
    );
  }

  return (
    <hr style={{
      margin: '1.2em 0',
      border: 'none',
      borderTop: '1px solid #D1D5DB',
    }} />
  );
}

// ===== Block dispatcher =====

function DocumentBlockRenderer({ block, theme, isDark }: { block: DocumentBlock; theme: ResolvedTheme; isDark: boolean }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock block={block} theme={theme} />;
    case 'paragraph':
      return <ParagraphBlock block={block} theme={theme} />;
    case 'list':
      return <ListBlock block={block} theme={theme} />;
    case 'table':
      return <TableBlock block={block} theme={theme} />;
    case 'code':
      return <CodeBlock block={block} theme={theme} isDark={isDark} />;
    case 'image':
      return <ImageBlock block={block} theme={theme} />;
    case 'blockquote':
      return <BlockquoteBlock block={block} theme={theme} />;
    case 'callout':
      return <CalloutBlock block={block} theme={theme} />;
    case 'break':
      return <BreakBlock block={block} theme={theme} />;
    default:
      return null;
  }
}

// ===== Main component =====

export function DocumentPreview({ content }: DocumentPreviewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const document = useMemo(
    () => parseDocumentContent(content, 'Document'),
    [content],
  );

  const theme = useMemo(() => resolveDocTheme(document.theme), [document.theme]);

  // Flatten all blocks (title, subtitle, blocks, sections)
  const allBlocks = useMemo(() => {
    const blocks: DocumentBlock[] = [];
    if (document.title) {
      blocks.push({ type: 'heading', text: document.title, level: 1 });
    }
    if (document.subtitle) {
      blocks.push({ type: 'paragraph', text: document.subtitle });
    }
    if (document.blocks) {
      blocks.push(...document.blocks);
    }
    if (document.sections) {
      for (const section of document.sections) {
        if (section.heading) {
          blocks.push({ type: 'heading', text: section.heading, level: 2 });
        }
        blocks.push(...section.blocks);
      }
    }
    return blocks;
  }, [document]);

  const pages = useMemo(() => {
    const grouped: DocumentBlock[][] = [[]];
    for (const block of allBlocks) {
      if (block.type === 'break' && block.break.type === 'page-break') {
        if (grouped[grouped.length - 1].length > 0) {
          grouped.push([]);
        }
        continue;
      }
      grouped[grouped.length - 1].push(block);
    }

    if (grouped[grouped.length - 1].length === 0 && grouped.length > 1) {
      grouped.pop();
    }

    const nonEmptyPages = grouped.filter((page) => page.length > 0);
    return nonEmptyPages.length > 0 ? nonEmptyPages : [[]];
  }, [allBlocks]);

  if (allBlocks.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-400">Empty document</div>;
  }

  // Override some theme colors for dark mode display
  const displayTheme: ResolvedTheme = isDark
    ? {
        ...theme,
        backgroundColor: '1E1E1E',
        bodyColor: 'D4D4D4',
        primaryColor: cleanHex(document.theme?.primaryColor, 'E0E0E0'),
      }
    : theme;

  return (
    <div className="h-full overflow-auto p-4">
      <div style={{ maxWidth: '920px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {pages.map((pageBlocks, pageIndex) => (
            <div
              key={pageIndex}
              style={{
                maxWidth: '816px',
                width: '100%',
                margin: '0 auto',
                background: hexToCSS(displayTheme.backgroundColor),
                padding: 'clamp(20px, 4vw, 60px) clamp(18px, 5vw, 72px)',
                fontFamily: displayTheme.bodyFont,
                fontSize: `${displayTheme.fontSize}pt`,
                lineHeight: displayTheme.lineSpacing,
                color: hexToCSS(displayTheme.bodyColor),
                boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '6px',
                minHeight: 'clamp(400px, 70vh, 1056px)',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {pageBlocks.map((block, blockIndex) => (
                <DocumentBlockRenderer
                  key={`${pageIndex}-${blockIndex}`}
                  block={block}
                  theme={displayTheme}
                  isDark={isDark}
                />
              ))}

              {/* Footer with metadata on the last page */}
              {pageIndex === pages.length - 1 && (document.author || document.date) && (
                <div style={{
                  marginTop: '2em',
                  paddingTop: '0.8em',
                  borderTop: '1px solid #D1D5DB',
                  fontSize: '0.8em',
                  color: hexToCSS(displayTheme.bodyColor),
                  opacity: 0.6,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}>
                  {document.author && <span>{document.author}</span>}
                  {document.author && document.date && <span> • </span>}
                  {document.date && <span>{document.date}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
