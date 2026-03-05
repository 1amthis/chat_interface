'use client';

import { useMemo } from 'react';
import { computeDiff, DiffLine } from '@/lib/diff';

interface PromptDiffViewProps {
  leftContent: string;
  rightContent: string;
  leftLabel: string;
  rightLabel: string;
}

export function PromptDiffView({ leftContent, rightContent, leftLabel, rightLabel }: PromptDiffViewProps) {
  const diffLines = useMemo(() => computeDiff(leftContent, rightContent), [leftContent, rightContent]);

  // Build paired rows for side-by-side display
  const rows = useMemo(() => {
    const result: { left: DiffLine | null; right: DiffLine | null }[] = [];
    const pending: { removed: DiffLine[]; added: DiffLine[] } = { removed: [], added: [] };

    const flushPending = () => {
      const max = Math.max(pending.removed.length, pending.added.length);
      for (let i = 0; i < max; i++) {
        result.push({
          left: pending.removed[i] ?? null,
          right: pending.added[i] ?? null,
        });
      }
      pending.removed = [];
      pending.added = [];
    };

    for (const line of diffLines) {
      if (line.type === 'unchanged') {
        flushPending();
        result.push({ left: line, right: line });
      } else if (line.type === 'removed') {
        pending.removed.push(line);
      } else {
        pending.added.push(line);
      }
    }
    flushPending();
    return result;
  }, [diffLines]);

  const hasChanges = diffLines.some((l) => l.type !== 'unchanged');

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-2 gap-0 border-b border-[var(--border-color)]">
        <div className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-r border-[var(--border-color)]">
          {leftLabel}
        </div>
        <div className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)]">
          {rightLabel}
        </div>
      </div>

      {!hasChanges ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-sm">
          No differences between these versions
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {/* Left side */}
                  <td className="w-8 text-right pr-2 select-none text-[var(--text-tertiary)] border-r border-[var(--border-color)]" style={{ minWidth: '2rem' }}>
                    {row.left?.leftLineNo ?? ''}
                  </td>
                  <td
                    className={`px-2 py-0.5 whitespace-pre-wrap break-all border-r border-[var(--border-color)] ${
                      row.left?.type === 'removed'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                        : row.left === null
                        ? 'bg-[var(--bg-secondary)]'
                        : ''
                    }`}
                    style={{ width: '50%' }}
                  >
                    {row.left?.type === 'removed' && <span className="select-none text-red-400 mr-1">-</span>}
                    {row.left?.content ?? ''}
                  </td>
                  {/* Right side */}
                  <td className="w-8 text-right pr-2 select-none text-[var(--text-tertiary)] border-r border-[var(--border-color)]" style={{ minWidth: '2rem' }}>
                    {row.right?.rightLineNo ?? ''}
                  </td>
                  <td
                    className={`px-2 py-0.5 whitespace-pre-wrap break-all ${
                      row.right?.type === 'added'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : row.right === null
                        ? 'bg-[var(--bg-secondary)]'
                        : ''
                    }`}
                    style={{ width: '50%' }}
                  >
                    {row.right?.type === 'added' && <span className="select-none text-green-400 mr-1">+</span>}
                    {row.right?.content ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
