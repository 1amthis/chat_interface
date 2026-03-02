'use client';

import { TokenUsage } from '@/types';
import { calculateCost } from '@/lib/model-metadata';
import { formatNumber } from '@/lib/utils';

interface TokenUsageDisplayProps {
  sessionUsage: TokenUsage;
  model?: string;
  hasContextBreakdown?: boolean;
  onOpenContextInspector?: () => void;
}

export function TokenUsageDisplay({ sessionUsage, model, hasContextBreakdown, onOpenContextInspector }: TokenUsageDisplayProps) {
  // Calculate session cost if model is provided
  const sessionCost = model
    ? calculateCost(model, sessionUsage.inputTokens, sessionUsage.outputTokens, sessionUsage.cachedTokens)
    : null;
  const sessionReasoningTokens = sessionUsage.reasoningTokens;

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      {/* Session total */}
      {sessionUsage.totalTokens > 0 && (
        <div className="flex items-center gap-2" title="Session total token usage">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span title={`Input: ${sessionUsage.inputTokens.toLocaleString()} | Output: ${sessionUsage.outputTokens.toLocaleString()}`}>
            Total: <span className="font-medium">{formatNumber(sessionUsage.totalTokens)}</span>
            {sessionCost !== null && (
              <span className="ml-1 text-amber-600 dark:text-amber-400" title="Estimated session cost">
                Est: ${sessionCost < 0.01 ? '<0.01' : sessionCost.toFixed(2)}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Session reasoning tokens */}
      {sessionReasoningTokens !== undefined && (
        <div
          className="flex items-center gap-2 text-orange-600 dark:text-orange-400"
          title="Reasoning tokens used in this session"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.373 3.373 0 0014 18.469V19a2 2 0 11-4 0v-.531a3.373 3.373 0 00-.988-2.386l-.548-.547z" />
          </svg>
          <span>
            Reasoning: <span className="font-medium">{formatNumber(sessionReasoningTokens)}</span>
          </span>
        </div>
      )}

      {/* Context Inspector button */}
      {hasContextBreakdown && onOpenContextInspector && (
        <button
          onClick={onOpenContextInspector}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Open Context Inspector"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
