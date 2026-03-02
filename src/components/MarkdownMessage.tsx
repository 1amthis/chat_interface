'use client';

import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from './ThemeProvider';

interface MarkdownMessageProps {
  content: string;
  citationSources?: CitationSourceMap;
}

const CITATION_TOKEN_REGEX = /\[(web|doc)-(\d+)\]/g;
const CITATION_KEY_REGEX = /^(web|doc)-\d+$/;

export interface CitationWebSource {
  type: 'web';
  key: string;
  title: string;
  url: string;
  source?: string;
  snippet?: string;
}

export interface CitationDocSource {
  type: 'doc';
  key: string;
  documentName: string;
  chunk: number;
  excerpt: string;
  score?: number;
}

export type CitationSource = CitationWebSource | CitationDocSource;
export type CitationSourceMap = Record<string, CitationSource>;

function injectCitationLinks(markdown: string): string {
  // Preserve fenced and inline code spans to avoid rewriting citation-like text inside code.
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((segment) => {
      if (!segment) return segment;
      if (segment.startsWith('```') || segment.startsWith('`')) {
        return segment;
      }
      return segment.replace(CITATION_TOKEN_REGEX, (_match, sourceType, index) => {
        const key = `${sourceType}-${index}`;
        // Use a hash URL so markdown keeps the href; then render it as a visual badge (non-clickable).
        return `[${key}](#citation-${key})`;
      });
    })
    .join('');
}

function extractCitationKeyFromHref(href?: string): string | null {
  if (!href) return null;
  if (href.startsWith('#citation-')) {
    const key = href.slice('#citation-'.length);
    return CITATION_KEY_REGEX.test(key) ? key : null;
  }
  // Backward compatibility with already-generated links
  if (href.startsWith('citation:')) {
    const key = href.slice('citation:'.length);
    return CITATION_KEY_REGEX.test(key) ? key : null;
  }
  if (CITATION_KEY_REGEX.test(href)) {
    return href;
  }
  return null;
}

function citationBadgeClassNames(isWebSource: boolean): string {
  return `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.72rem] font-semibold align-middle mx-0.5 border ${
    isWebSource
      ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700'
  }`;
}

const LANGUAGE_DISPLAY: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  cs: 'C#',
  cpp: 'C++',
  c: 'C',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  dockerfile: 'Dockerfile',
  toml: 'TOML',
  ini: 'INI',
  swift: 'Swift',
  php: 'PHP',
  lua: 'Lua',
  r: 'R',
  dart: 'Dart',
  graphql: 'GraphQL',
  proto: 'Protobuf',
  text: 'Text',
  txt: 'Text',
  diff: 'Diff',
};

function getLanguageLabel(lang: string): string {
  return LANGUAGE_DISPLAY[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

const CodeBlock = React.memo(function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const syntaxTheme = resolvedTheme === 'dark' ? oneDark : oneLight;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border-color)] my-3">
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] border-b border-[var(--border-color)]">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {getLanguageLabel(language)}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={syntaxTheme}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.8125rem',
          lineHeight: '1.5',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

function useMarkdownComponents(
  citationSources?: CitationSourceMap,
  onOpenDocumentCitation?: (key: string) => void
): Components {
  return useMemo((): Components => ({
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      if (match) {
        return <CodeBlock language={match[1]} code={codeString} />;
      }

      return (
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[0.85em] font-mono"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children }) {
      return <>{children}</>;
    },
    a({ href, children, ...props }) {
      const citationKey = extractCitationKeyFromHref(href);
      if (citationKey) {
        const source = citationSources?.[citationKey];
        const isWebSource = citationKey.startsWith('web-');

        if (source?.type === 'web') {
          return (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${citationBadgeClassNames(true)} no-underline hover:brightness-95 transition`}
              title={`Open source: ${source.title}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {children}
            </a>
          );
        }

        if (source?.type === 'doc') {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onOpenDocumentCitation?.(citationKey);
              }}
              className={`${citationBadgeClassNames(false)} hover:brightness-95 transition`}
              title={`Open source excerpt: ${source.documentName} (chunk ${source.chunk})`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {children}
            </button>
          );
        }

        return (
          <span
            className={citationBadgeClassNames(isWebSource)}
            title={isWebSource ? 'Web source citation' : 'Document source citation'}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {children}
          </span>
        );
      }

      const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
      return (
        <a
          href={href}
          className="text-blue-600 dark:text-blue-400 hover:underline"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          {...props}
        >
          {children}
        </a>
      );
    },
    table({ children, ...props }) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="min-w-full border-collapse border border-[var(--border-color)]" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }) {
      return (
        <thead className="bg-gray-50 dark:bg-gray-800/50" {...props}>{children}</thead>
      );
    },
    th({ children, ...props }) {
      return (
        <th className="border border-[var(--border-color)] px-3 py-2 text-left text-xs font-semibold" {...props}>
          {children}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td className="border border-[var(--border-color)] px-3 py-2 text-sm" {...props}>
          {children}
        </td>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="border-l-4 border-blue-400 dark:border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 my-3"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    h1({ children, ...props }) {
      return (
        <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-[var(--border-color)]" {...props}>
          {children}
        </h1>
      );
    },
    h2({ children, ...props }) {
      return (
        <h2 className="text-xl font-bold mt-5 mb-2 pb-1.5 border-b border-[var(--border-color)]" {...props}>
          {children}
        </h2>
      );
    },
    h3({ children, ...props }) {
      return (
        <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>{children}</h3>
      );
    },
    h4({ children, ...props }) {
      return (
        <h4 className="text-base font-semibold mt-3 mb-1.5" {...props}>{children}</h4>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul className="list-disc pl-6 my-2 space-y-1" {...props}>{children}</ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal pl-6 my-2 space-y-1" {...props}>{children}</ol>
      );
    },
    li({ children, ...props }) {
      return (
        <li className="leading-relaxed" {...props}>{children}</li>
      );
    },
    p({ children, ...props }) {
      return (
        <p className="my-2 leading-relaxed" {...props}>{children}</p>
      );
    },
    hr({ ...props }) {
      return <hr className="border-[var(--border-color)] my-4" {...props} />;
    },
  }), [citationSources, onOpenDocumentCitation]);
}

export const MarkdownMessage = React.memo(function MarkdownMessage({
  content,
  citationSources,
}: MarkdownMessageProps) {
  const [activeDocCitationKey, setActiveDocCitationKey] = useState<string | null>(null);

  const handleOpenDocumentCitation = useCallback((key: string) => {
    setActiveDocCitationKey((prev) => (prev === key ? null : key));
  }, []);

  const components = useMarkdownComponents(citationSources, handleOpenDocumentCitation);
  const contentWithCitationLinks = useMemo(() => injectCitationLinks(content), [content]);
  const activeDocCitation = useMemo(() => {
    if (!activeDocCitationKey) return null;
    const source = citationSources?.[activeDocCitationKey];
    return source?.type === 'doc' ? source : null;
  }, [activeDocCitationKey, citationSources]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {contentWithCitationLinks}
      </ReactMarkdown>
      {activeDocCitation && (
        <div className="not-prose mt-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">
                Document Source
              </p>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 truncate">
                {activeDocCitation.documentName}
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Chunk {activeDocCitation.chunk}
                {typeof activeDocCitation.score === 'number' ? ` · ${Math.round(activeDocCitation.score * 100)}% relevance` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveDocCitationKey(null)}
              className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-emerald-950 dark:text-emerald-50">
            {activeDocCitation.excerpt}
          </p>
        </div>
      )}
    </div>
  );
});
