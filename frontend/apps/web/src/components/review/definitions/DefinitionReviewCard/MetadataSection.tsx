import type { MetadataSectionProps } from './types';

export function MetadataSection({ definition, isExpanded, onToggle }: MetadataSectionProps) {
  return (
    <div className="border-t border-[var(--color-neutral-200)] pt-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        Additional Metadata (read-only)
      </button>

      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--color-text-secondary)]">
          <div>Source Location: {definition.sourceLocation || 'N/A'}</div>
          <div>Definition Overlap: {definition.definitionOverlap?.toFixed(2) || 'N/A'}</div>
          <div>Model Version: {definition.modelVersion || 'N/A'}</div>
          <div>Extracted At: {definition.extractedAt ? new Date(definition.extractedAt).toLocaleString() : 'N/A'}</div>
          <div>URL: <a href={definition.url || '#'} className="text-[var(--color-link)] hover:underline" target="_blank" rel="noreferrer">{definition.url ? 'View' : 'N/A'}</a></div>
        </div>
      )}
    </div>
  );
}
