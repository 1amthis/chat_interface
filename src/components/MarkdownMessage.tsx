'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from './ThemeProvider';

interface MarkdownMessageProps {
  content: string;
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

function useMarkdownComponents(): Components {
  const { resolvedTheme } = useTheme();

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
  }), [resolvedTheme]);
}

export const MarkdownMessage = React.memo(function MarkdownMessage({
  content,
}: MarkdownMessageProps) {
  const components = useMarkdownComponents();

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
