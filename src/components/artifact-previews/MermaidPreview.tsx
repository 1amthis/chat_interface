'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidPreviewProps {
  content: string;
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  const lines = trimmed.split('\n');
  if (lines.length < 2) return trimmed;

  // Remove leading ```lang and trailing ``` (common when users paste fenced code blocks)
  for (let i = lines.length - 1; i >= 1; i--) {
    if (lines[i].trim().startsWith('```')) {
      return lines.slice(1, i).join('\n').trim();
    }
  }

  return trimmed;
}

function normalizeMermaidSource(content: string): string {
  const normalizedNewlines = content.replace(/\r\n?/g, '\n').trim();
  return stripMarkdownCodeFence(normalizedNewlines);
}

function formatMermaidError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as unknown as { hash?: { loc?: { first_line?: number; first_column?: number } } };
    const loc = anyErr.hash?.loc;
    if (loc && typeof loc.first_line === 'number' && typeof loc.first_column === 'number') {
      return `${err.message}\n\nLocation: line ${loc.first_line}, column ${loc.first_column + 1}`;
    }
    return err.message;
  }

  if (typeof err === 'string') return err;
  return 'Failed to render diagram';
}

// Initialize mermaid with a unique ID to avoid conflicts
let mermaidInitialized = false;

export function MermaidPreview({ content }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        suppressErrorRendering: true,
        fontFamily: 'inherit',
      });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      const source = normalizeMermaidSource(content);
      if (!source) {
        setError(null);
        setSvg('');
        return;
      }

      try {
        setError(null);
        await mermaid.parse(source);
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg: renderedSvg } = await mermaid.render(id, source);
        if (!cancelled) setSvg(renderedSvg);
      } catch (err) {
        if (!cancelled) {
          setError(formatMermaidError(err));
          setSvg('');
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">Failed to render diagram</p>
          <pre className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded max-w-md overflow-auto">
            {error}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto flex items-center justify-center p-4 bg-white"
    >
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="text-gray-400">Loading diagram...</div>
      )}
    </div>
  );
}
