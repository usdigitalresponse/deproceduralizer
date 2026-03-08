'use client';

import type { RegulationWithAnalysis } from '@deproceduralizer/database';

interface RegulationMetadataProps {
  regulation: Pick<
    RegulationWithAnalysis,
    | 'url'
    | 'urlType'
    | 'sourceIndex'
  >;
  /** Layout style: 'grid' for full page, 'compact' for modals */
  layout?: 'grid' | 'compact';
  className?: string;
}

/**
 * Displays metadata for a regulation including source info.
 * Used in DetailModal, DetailPanel, and regulation detail page.
 *
 * @example
 * // Full grid layout for regulation page
 * <RegulationMetadata regulation={regulation} layout="grid" />
 *
 * @example
 * // Compact layout for modals
 * <RegulationMetadata regulation={regulation} layout="compact" />
 */
export function RegulationMetadata({
  regulation,
  layout = 'grid',
  className = '',
}: RegulationMetadataProps) {
  const {
    url,
    urlType,
    sourceIndex,
  } = regulation;

  if (layout === 'compact') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
        <MetadataItem label="Source">
          <a
            href={url ?? ''}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline text-sm"
          >
            View Original
          </a>
        </MetadataItem>
        <MetadataItem label="URL Type">
          <span className="text-sm">{urlType || '–'}</span>
        </MetadataItem>
        <MetadataItem label="Source Index">
          <span className="text-sm font-mono">{sourceIndex || '–'}</span>
        </MetadataItem>
      </div>
    );
  }

  // Grid layout for full page
  return (
    <div className={className}>
      {/* Source section - always shown */}
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Source</span>
        <a
          href={url ?? ''}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline text-sm"
        >
          View Original
        </a>
      </div>
    </div>
  );
}

// Helper components for compact layout
function MetadataItem({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-[var(--color-neutral-200)] pb-2 ${className}`}>
      <span className="font-semibold text-[var(--color-text-secondary)] text-sm">{label}:</span>
      <span className="ml-2">{children}</span>
    </div>
  );
}

export default RegulationMetadata;
