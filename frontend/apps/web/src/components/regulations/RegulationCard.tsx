'use client';

import { ExternalLink } from 'lucide-react';
import { Card, Badge, SectionTypeBadge } from '@/components/ui';
import { KeywordTags } from '@/components/ui/KeywordTags';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { useJurisdictionFromPath } from '@/hooks';

interface RegulationCardProps {
  regulation: RegulationWithAnalysis;
  onClick: () => void;
}

/**
 * Card component for displaying a regulation in grid view.
 * Shows key metrics prominently with secondary details below.
 */
export function RegulationCard({ regulation, onClick }: RegulationCardProps) {
  const jurisdiction = useJurisdictionFromPath();

  const {
    id,
    title,
    hierarchyLevel,
    excludeFromAnalysis,
    sectionType,
    keywords,
    hasForm,
    hasIbr,
    summary,
  } = regulation;

  return (
    <Card
      padding="none"
      className={`
        flex flex-col
        cursor-pointer
        transition-all duration-[var(--duration-fast)]
        hover:shadow-[var(--shadow-md)]
        hover:border-[var(--color-primary-mid)]
        ${excludeFromAnalysis ? 'opacity-60' : ''}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${title}`}
    >
      {/* Header Section */}
      <div className="p-4 pb-3 border-b border-[var(--color-neutral-100)]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {excludeFromAnalysis && (
              <Badge variant="default" className="text-xs">
                Excluded
              </Badge>
            )}
            {hierarchyLevel && (
              <span className="text-xs text-[var(--color-text-muted)] font-medium uppercase">
                {hierarchyLevel}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-[var(--color-text)] line-clamp-2 mb-2">
          {title}
        </h3>

        {/* Badge Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {sectionType && <SectionTypeBadge type={sectionType} />}
          <MetadataIndicators hasForm={hasForm} hasIbr={hasIbr} />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 pt-3 flex-1 flex flex-col gap-3">
        {/* Summary */}
        {summary && (
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{summary}</p>
        )}

        {/* Keywords */}
        {keywords && keywords.length > 0 && (
          <KeywordTags keywords={keywords} maxDisplay={3} />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]">
        <a
          href={`/${jurisdiction}/regulations/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          View Regulation
        </a>
      </div>
    </Card>
  );
}
