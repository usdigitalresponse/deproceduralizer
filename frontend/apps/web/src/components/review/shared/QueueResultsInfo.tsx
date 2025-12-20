'use client';

interface QueueResultsInfoProps {
  startItem: number;
  endItem: number;
  total: number;
  itemLabel?: string;
  showKeyboardHint?: boolean;
  keyboardHintText?: string;
}

/**
 * Displays "Showing X-Y of Z items" with optional keyboard hint.
 *
 * @example
 * <QueueResultsInfo
 *   startItem={flags.length > 0 ? (page - 1) * pageSize + 1 : 0}
 *   endItem={Math.min(page * pageSize, total)}
 *   total={total}
 *   itemLabel="flags"
 *   showKeyboardHint
 * />
 */
export function QueueResultsInfo({
  startItem,
  endItem,
  total,
  itemLabel = 'items',
  showKeyboardHint = true,
  keyboardHintText,
}: QueueResultsInfoProps) {

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
        Showing {startItem}–{endItem} of {total} {itemLabel}
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
