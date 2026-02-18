'use client';

import { useState } from 'react';
import { ContextBreakdown } from '@/types';
import { formatNumber } from '@/lib/utils';
import { formatContextWindow } from '@/lib/model-metadata';

interface ContextInspectorProps {
  breakdown: ContextBreakdown;
  onClose: () => void;
}

export function ContextInspector({ breakdown, onClose }: ContextInspectorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const remainingTokens = breakdown.contextWindowSize - breakdown.totalEstimatedTokens;
  const remainingPercent = Math.max(0, (remainingTokens / breakdown.contextWindowSize) * 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--background)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="font-semibold text-lg">Context Inspector</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {breakdown.model} &middot; {formatContextWindow(breakdown.contextWindowSize)} context window
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Usage summary */}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              ~{formatNumber(breakdown.totalEstimatedTokens)} of {formatContextWindow(breakdown.contextWindowSize)} tokens used
            </span>
            <span className="text-sm font-medium">
              {breakdown.percentUsed.toFixed(1)}%
            </span>
          </div>

          {/* Stacked bar */}
          <div className="h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex">
            {breakdown.sections.map((section) => (
              section.percentage > 0 && (
                <div
                  key={section.label}
                  className="h-full transition-all relative group"
                  style={{
                    width: `${section.percentage}%`,
                    backgroundColor: section.color,
                    minWidth: section.percentage > 0.5 ? '4px' : '0',
                  }}
                  title={`${section.label}: ~${formatNumber(section.estimatedTokens)} tokens (${section.percentage.toFixed(1)}%)`}
                />
              )
            ))}
            {remainingPercent > 0 && (
              <div
                className="h-full"
                style={{
                  width: `${remainingPercent}%`,
                  backgroundColor: 'transparent',
                }}
                title={`Remaining: ~${formatNumber(remainingTokens)} tokens`}
              />
            )}
          </div>

          {/* Legend / Detail list */}
          <div className="space-y-1">
            {breakdown.sections.map((section) => (
              <div key={section.label}>
                <button
                  onClick={() => setExpandedSection(expandedSection === section.label ? null : section.label)}
                  className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm inline-block shrink-0"
                      style={{ backgroundColor: section.color }}
                    />
                    <span>{section.label}</span>
                    {section.details && section.details.length > 0 && (
                      <svg
                        className={`w-3 h-3 text-gray-400 transition-transform ${expandedSection === section.label ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <span>~{formatNumber(section.estimatedTokens)}</span>
                    <span className="w-12 text-right">{section.percentage.toFixed(1)}%</span>
                  </div>
                </button>

                {/* Expanded sub-items */}
                {expandedSection === section.label && section.details && section.details.length > 0 && (
                  <div className="ml-7 pl-2 border-l-2 border-gray-200 dark:border-gray-700 space-y-0.5 mb-1">
                    {section.details.map((detail, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5 px-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="truncate mr-2">{detail.label}</span>
                        <span className="shrink-0">~{formatNumber(detail.estimatedTokens)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Remaining capacity */}
            <div className="flex items-center justify-between py-1.5 px-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm inline-block shrink-0 bg-gray-200 dark:bg-gray-700" />
                <span className="text-gray-400 dark:text-gray-500">Remaining</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
                <span>~{formatNumber(Math.max(0, remainingTokens))}</span>
                <span className="w-12 text-right">{remainingPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)] text-xs text-gray-400 dark:text-gray-500">
          Token counts are estimates (~4 chars/token). Actual usage is reported by the provider.
        </div>
      </div>
    </div>
  );
}
