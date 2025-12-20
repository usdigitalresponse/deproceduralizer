'use client';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

interface QueueResultsInfoProps {
  pagination: PaginationInfo;
  currentCount: number;
  itemLabel?: string;
  showKeyboardHint?: boolean;
  keyboardHintText?: string;
}

/**
 * Displays "Showing X-Y of Z items" with optional keyboard hint.
 *
 * @example
 * <QueueResultsInfo
 *   pagination={pagination}
 *   currentCount={flags.length}
 *   itemLabel="flags"
 *   showKeyboardHint
 * />
 */
export function QueueResultsInfo({
  pagination,
  currentCount,
  itemLabel = 'items',
  showKeyboardHint = true,
  keyboardHintText,
}: QueueResultsInfoProps) {
  const startItem = currentCount > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.total);

  const defaultHint = (
    <>
      Press <kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">?</kbd> for keyboard shortcuts
    </>
  );

  const jkHint = (
    <>
      Use <kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">j</kbd>/<kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">k</kbd> to navigate
    </>
  );

  return (
    <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
      <span>
        Showing {startItem}–{endItem} of {pagination.total} {itemLabel}
      </span>
      {showKeyboardHint && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {keyboardHintText === 'jk' ? jkHint : defaultHint}
        </span>
      )}
    </div>
  );
}

export default QueueResultsInfo;
