'use client';

import { useState } from 'react';
import { TokenUsage, ContextBreakdown } from '@/types';
import { calculateCost } from '@/lib/model-metadata';
import { formatNumber } from '@/lib/utils';

interface MessageUsageDisplayProps {
  usage: TokenUsage;
  model?: string;
  contextBreakdown?: ContextBreakdown;
  onOpenContextInspector?: (breakdown: ContextBreakdown) => void;
}

export function MessageUsageDisplay({ usage, model, contextBreakdown, onOpenContextInspector }: MessageUsageDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cost = model ? calculateCost(model, usage.inputTokens, usage.outputTokens, usage.cachedTokens) : null;
  const totalTokens = usage.inputTokens + usage.outputTokens;

  return (
    <div className="mt-2 text-xs">
      {/* Collapsed row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span>{formatNumber(totalTokens)} tokens</span>
        {cost !== null && (
          <span className="text-amber-500 dark:text-amber-400">
            ${cost < 0.01 ? '<0.01' : cost.toFixed(3)}
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-1.5 ml-4 pl-2 border-l-2 border-gray-200 dark:border-gray-700 space-y-0.5 text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            <span>Input: <span className="text-blue-600 dark:text-blue-400 font-medium">{formatNumber(usage.inputTokens)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span>Output: <span className="text-green-600 dark:text-green-400 font-medium">{formatNumber(usage.outputTokens)}</span></span>
          </div>
          {usage.cachedTokens !== undefined && usage.cachedTokens > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              <span>Cached: <span className="text-purple-600 dark:text-purple-400 font-medium">{formatNumber(usage.cachedTokens)}</span></span>
            </div>
          )}
          {usage.reasoningTokens !== undefined && usage.reasoningTokens > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              <span>Reasoning: <span className="text-orange-600 dark:text-orange-400 font-medium">{formatNumber(usage.reasoningTokens)}</span></span>
            </div>
          )}
          {cost !== null && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span>Cost: <span className="text-amber-600 dark:text-amber-400 font-medium">${cost < 0.001 ? '<0.001' : cost.toFixed(4)}</span></span>
            </div>
          )}
          {contextBreakdown && onOpenContextInspector && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenContextInspector(contextBreakdown);
              }}
              className="flex items-center gap-1.5 mt-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View context breakdown
            </button>
          )}
        </div>
      )}
    </div>
  );
}
