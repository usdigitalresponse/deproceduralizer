'use client';

import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { Badge, SeverityBadge } from '@/components/ui';
import { getComplexityVariant } from '@/types/regulation';

interface RegulationMetadataProps {
  regulation: Pick<
    RegulationWithAnalysis,
    | 'url'
    | 'urlType'
    | 'sourceIndex'
    | 'numFlags'
    | 'maxSeverity'
    | 'overallComplexity'
    | 'hasImplementationIssues'
    | 'requiresTechnicalReview'
    | 'hasReportingRequirement'
  >;
  /** Layout style: 'grid' for full page, 'compact' for modals */
  layout?: 'grid' | 'compact';
  className?: string;
}

/**
 * Displays metadata for a regulation including source, flags, severity, complexity, etc.
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
    numFlags,
    maxSeverity,
    overallComplexity,
    hasImplementationIssues,
    requiresTechnicalReview,
    hasReportingRequirement,
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
        <MetadataItem label="Red Flags">
          <Badge variant={(numFlags ?? 0) > 0 ? 'danger' : 'default'} className="ml-0">
            {numFlags || 0} flags
          </Badge>
        </MetadataItem>
        <MetadataItem label="Severity">
          {maxSeverity ? (
            <SeverityBadge severity={maxSeverity} className="ml-0" />
          ) : (
            <span className="text-[var(--color-text-muted)]">–</span>
          )}
        </MetadataItem>
        <MetadataItem label="Complexity">
          {overallComplexity ? (
            <Badge variant={getComplexityVariant(overallComplexity)} className="ml-0">
              {overallComplexity}
            </Badge>
          ) : (
            <span className="text-[var(--color-text-muted)]">–</span>
          )}
        </MetadataItem>
        <MetadataItem label="Impl Issues">
          <BooleanIndicator value={hasImplementationIssues} color="danger" />
        </MetadataItem>
        <MetadataItem label="Tech Review">
          <BooleanIndicator value={requiresTechnicalReview} color="info" />
        </MetadataItem>
        <MetadataItem label="Reporting Req" className="col-span-2">
          <BooleanIndicator value={hasReportingRequirement} color="warning" />
        </MetadataItem>
      </div>
    );
  }

  // Grid layout for full page
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
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
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Red Flags</span>
        <Badge variant={(numFlags ?? 0) > 0 ? 'danger' : 'default'}>
          {numFlags || 0} flags
        </Badge>
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Severity</span>
        {maxSeverity ? (
          <SeverityBadge severity={maxSeverity} />
        ) : (
          <span className="text-[var(--color-text-muted)]">–</span>
        )}
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Complexity</span>
        {overallComplexity ? (
          <Badge variant={getComplexityVariant(overallComplexity)}>
            {overallComplexity}
          </Badge>
        ) : (
          <span className="text-[var(--color-text-muted)]">–</span>
        )}
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Implementation Issues</span>
        <span className="text-sm">
          {hasImplementationIssues ? (
            <span className="text-[var(--color-danger)]">Yes</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">No</span>
          )}
        </span>
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Tech Review Required</span>
        <span className="text-sm">
          {requiresTechnicalReview ? (
            <span className="text-[var(--color-info)]">Yes</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">No</span>
          )}
        </span>
      </div>
      <div>
        <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Reporting Requirement</span>
        <span className="text-sm">
          {hasReportingRequirement ? (
            <span className="text-[var(--color-warning)]">Yes</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">No</span>
          )}
        </span>
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

function BooleanIndicator({
  value,
  color,
}: {
  value: boolean | null | undefined;
  color: 'danger' | 'info' | 'warning';
}) {
  const colorClass = {
    danger: 'text-[var(--color-danger)]',
    info: 'text-[var(--color-info)]',
    warning: 'text-[var(--color-warning)]',
  }[color];

  return (
    <span className="text-sm">
      {value ? (
        <span className={colorClass}>● Yes</span>
      ) : (
        <span className="text-[var(--color-text-muted)]">– No</span>
      )}
    </span>
  );
}

export default RegulationMetadata;
