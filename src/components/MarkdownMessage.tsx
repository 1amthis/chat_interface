'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from './ThemeProvider';

interface MarkdownMessageProps {
  content: string;
  citationSources?: CitationSourceMap;
}

const CITATION_TOKEN_REGEX = /\[((?:web|doc)-\d+(?:-\d+)*)\]/g;
const CITATION_KEY_REGEX = /^(web|doc)-\d+(?:-\d+)*$/;

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
      return segment.replace(CITATION_TOKEN_REGEX, (_match, key) => {
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

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const DOC_EXCERPT_PREVIEW_CHARS = 420;

function getTruncatedText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  const sliced = text.slice(0, maxChars);
  const lastSpaceIndex = sliced.lastIndexOf(' ');
  const safeSlice = lastSpaceIndex > maxChars * 0.6 ? sliced.slice(0, lastSpaceIndex) : sliced;
  return { text: `${safeSlice}...`, truncated: true };
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
  onOpenCitation?: (key: string) => void
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

        if (source) {
          const tooltip = source.type === 'web'
            ? `${source.title} — ${getDomainFromUrl(source.url)}`
            : `${source.documentName} (chunk ${source.chunk})`;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onOpenCitation?.(citationKey);
              }}
              className={`${citationBadgeClassNames(isWebSource)} hover:brightness-95 transition`}
              title={tooltip}
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
  }), [citationSources, onOpenCitation]);
}

export const MarkdownMessage = React.memo(function MarkdownMessage({
  content,
  citationSources,
}: MarkdownMessageProps) {
  const [activeCitationKey, setActiveCitationKey] = useState<string | null>(null);
  const [showFullDocExcerpt, setShowFullDocExcerpt] = useState(false);

  const handleOpenCitation = useCallback((key: string) => {
    setShowFullDocExcerpt(false);
    setActiveCitationKey((prev) => (prev === key ? null : key));
  }, []);

  const components = useMarkdownComponents(citationSources, handleOpenCitation);
  const contentWithCitationLinks = useMemo(() => injectCitationLinks(content), [content]);
  const activeCitation = useMemo(() => {
    if (!activeCitationKey) return null;
    return citationSources?.[activeCitationKey] || null;
  }, [activeCitationKey, citationSources]);

  useEffect(() => {
    if (!activeCitation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveCitationKey(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCitation]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {contentWithCitationLinks}
      </ReactMarkdown>
      {activeCitation && (
        <div className="not-prose fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close source dialog"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setActiveCitationKey(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className={`relative w-full max-w-2xl max-h-[85vh] rounded-xl border shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden ${
              activeCitation.type === 'web'
                ? 'border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-900'
                : 'border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-[11px] uppercase tracking-wide font-semibold ${
                    activeCitation.type === 'web'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {activeCitation.type === 'web' ? 'Web Source' : 'Document Source'}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">
                  {activeCitation.type === 'web' ? activeCitation.title : activeCitation.documentName}
                </p>
                {activeCitation.type === 'web' ? (
                  <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                    {getDomainFromUrl(activeCitation.url)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Chunk {activeCitation.chunk}
                    {typeof activeCitation.score === 'number' ? ` · ${Math.round(activeCitation.score * 100)}% relevance` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeCitation.type === 'web' && (
                  <a
                    href={activeCitation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2.5 py-1.5 rounded border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  >
                    Open
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveCitationKey(null)}
                  className="text-xs px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3 min-h-0 overflow-y-auto pr-1">
              {activeCitation.type === 'web' ? (
                activeCitation.snippet && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                    {activeCitation.snippet}
                  </p>
                )
              ) : (
                <>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                    {showFullDocExcerpt
                      ? activeCitation.excerpt
                      : getTruncatedText(activeCitation.excerpt, DOC_EXCERPT_PREVIEW_CHARS).text}
                  </p>
                  {getTruncatedText(activeCitation.excerpt, DOC_EXCERPT_PREVIEW_CHARS).truncated && (
                    <button
                      type="button"
                      onClick={() => setShowFullDocExcerpt((prev) => !prev)}
                      className="mt-2 text-xs px-2.5 py-1.5 rounded border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                    >
                      {showFullDocExcerpt ? 'Voir moins' : 'Voir plus'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
