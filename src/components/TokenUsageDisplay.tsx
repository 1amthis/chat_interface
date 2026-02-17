'use client';

import { TokenUsage } from '@/types';
import { calculateCost } from '@/lib/model-metadata';

interface TokenUsageDisplayProps {
  usage: TokenUsage | null;
  sessionUsage: TokenUsage;
  model?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function TokenUsageDisplay({ usage, sessionUsage, model }: TokenUsageDisplayProps) {
  // Calculate session cost if model is provided
  const sessionCost = model
    ? calculateCost(model, sessionUsage.inputTokens, sessionUsage.outputTokens, sessionUsage.cachedTokens)
    : null;

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      {/* Last message usage */}
      {usage && (
        <div className="flex items-center gap-2" title="Last message token usage">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span>
            <span className="text-blue-600 dark:text-blue-400">{formatNumber(usage.inputTokens)}</span>
            {' / '}
            <span className="text-green-600 dark:text-green-400">{formatNumber(usage.outputTokens)}</span>
            {usage.reasoningTokens !== undefined && usage.reasoningTokens > 0 && (
              <span className="text-orange-600 dark:text-orange-400" title="Reasoning/thinking tokens">
                {' + '}{formatNumber(usage.reasoningTokens)} reasoning
              </span>
            )}
            {usage.cachedTokens !== undefined && usage.cachedTokens > 0 && (
              <span className="text-purple-600 dark:text-purple-400" title="Cached tokens">
                {' '}({formatNumber(usage.cachedTokens)} cached)
              </span>
            )}
          </span>
        </div>
      )}

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
    </div>
  );
}
