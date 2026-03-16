'use client';

interface ReferenceHighlightLegendProps {
  hasReferences: boolean;
  hasReferencedBy: boolean;
}

/**
 * Small legend card explaining cross-reference highlight colors in the tree.
 * Only renders when at least one highlight type is active.
 */
export function ReferenceHighlightLegend({
  hasReferences,
  hasReferencedBy,
}: ReferenceHighlightLegendProps) {
  if (!hasReferences && !hasReferencedBy) return null;

  return (
    <div className="flex items-center gap-4 px-3 py-2 rounded-md bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] text-xs text-[var(--color-text-secondary)]">
      <span className="font-medium text-[var(--color-text)]">Highlights:</span>
      {hasReferences && (
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full bg-[var(--color-info)]"
            aria-hidden="true"
          />
          References
        </span>
      )}
      {hasReferencedBy && (
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)]"
            aria-hidden="true"
          />
          Referenced by
        </span>
      )}
    </div>
  );
}
