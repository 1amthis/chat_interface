'use client';

interface ThinkingIndicatorProps {
  status?: string;
}

export function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
  return (
    <div className="py-6 bg-[var(--assistant-bubble)]">
      <div className="max-w-3xl mx-auto px-4 flex gap-4">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 bg-green-600">
          A
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-1">Assistant</div>
          <div className="flex items-center gap-2 text-[var(--foreground)]">
            <div className="thinking-dots">
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
            </div>
            {status && (
              <span className="text-sm text-gray-500">{status}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
