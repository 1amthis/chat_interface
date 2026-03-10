'use client';

import { useMemo, useState } from 'react';

interface PromptSection {
  label: string;
  content?: string;
}

interface SystemPromptInspectorProps {
  prompt?: string;
  sections: PromptSection[];
  onClose: () => void;
}

export function SystemPromptInspector({ prompt, sections, onClose }: SystemPromptInspectorProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const visibleSections = useMemo(
    () => sections.filter((section) => !!section.content?.trim()),
    [sections]
  );

  const handleCopy = async () => {
    try {
      if (!prompt) return;
      await navigator.clipboard.writeText(prompt);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1200);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--background)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="font-semibold text-lg">System Prompt Inspector</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review the exact prompt assembled before each request
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close system prompt inspector"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {visibleSections.length > 0 && (
            <div className="space-y-3">
              {visibleSections.map((section) => (
                <div
                  key={section.label}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]/30"
                >
                  <div className="px-3 py-2 border-b border-[var(--border-color)] text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {section.label}
                  </div>
                  <pre className="px-3 py-2 text-xs whitespace-pre-wrap break-words font-mono">
                    {section.content}
                  </pre>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Effective Prompt</h3>
              <button
                onClick={handleCopy}
                disabled={!prompt}
                className="px-2.5 py-1.5 text-xs rounded border border-[var(--border-color)] hover:bg-[var(--border-color)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
              </button>
            </div>
            <textarea
              value={prompt || ''}
              readOnly
              rows={14}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--background)] font-mono resize-none"
              placeholder="No system prompt is currently active for this context."
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-color)] text-xs text-gray-500 dark:text-gray-400">
          Includes global settings, project instructions, project skills, conversation overrides, and automatic tool guidance.
        </div>
      </div>
    </div>
  );
}
