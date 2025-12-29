'use client';

import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { KeywordTags } from '@/components/ui/KeywordTags';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { Tag } from '@/components/ui/Tag';

interface EnhancedRegulationSummaryProps {
  summary: string | null | undefined;
  sectionType: string | null | undefined;
  keywords: string[] | null | undefined;
  appliesTo: string[] | null | undefined;
  hasForm: boolean | null | undefined;
  hasIbr: boolean | null | undefined;
  /** Whether to show the heading (default: true) */
  showHeading?: boolean;
  className?: string;
}

/**
 * Enhanced summary component displaying AI-generated summary with rich metadata.
 * Shows section type, keywords, applies_to entities, and form/IBR indicators.
 *
 * @example
 * <EnhancedRegulationSummary
 *   summary={regulation.summary}
 *   sectionType={regulation.sectionType}
 *   keywords={regulation.keywords}
 *   appliesTo={regulation.appliesTo}
 *   hasForm={regulation.hasForm}
 *   hasIbr={regulation.hasIbr}
 * />
 */
export function EnhancedRegulationSummary({
  summary,
  sectionType,
  keywords,
  appliesTo,
  hasForm,
  hasIbr,
  showHeading = true,
  className = '',
}: EnhancedRegulationSummaryProps) {
  const hasAnyMetadata = summary || sectionType || keywords?.length || appliesTo?.length || hasForm || hasIbr;

  return (
    <div className={className}>
      {showHeading && (
        <h3 className="font-semibold text-[var(--color-text)] mb-3">Summary</h3>
      )}
      <div className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)] text-sm space-y-3">
        {/* Header row: Section type + metadata indicators */}
        {(sectionType || hasForm || hasIbr) && (
          <div className="flex items-center gap-2 flex-wrap">
            <SectionTypeBadge type={sectionType} />
            <MetadataIndicators hasForm={hasForm} hasIbr={hasIbr} />
          </div>
        )}

        {/* Summary text */}
        <p className="text-[var(--color-text)]">
          {summary || (
            <span className="text-[var(--color-text-muted)] italic">
              Summary not yet generated
            </span>
          )}
        </p>

        {/* Keywords */}
        {keywords && keywords.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[var(--color-text-muted)] text-xs shrink-0 pt-0.5">
              Keywords:
            </span>
            <KeywordTags keywords={keywords} maxDisplay={5} />
          </div>
        )}

        {/* Applies to */}
        {appliesTo && appliesTo.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-[var(--color-text-muted)] text-xs shrink-0 pt-0.5">
              Applies to:
            </span>
            <div className="flex flex-wrap gap-1">
              {appliesTo.slice(0, 5).map((entity) => (
                <Tag key={entity} variant="primary" size="sm">
                  {entity}
                </Tag>
              ))}
              {appliesTo.length > 5 && (
                <span
                  className="text-xs text-[var(--color-text-muted)] pt-0.5"
                  title={appliesTo.slice(5).join(', ')}
                >
                  +{appliesTo.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fallback when no metadata at all */}
        {!hasAnyMetadata && (
          <span className="text-[var(--color-text-muted)] italic">
            No summary available
          </span>
        )}
      </div>
    </div>
  );
}

export default EnhancedRegulationSummary;
