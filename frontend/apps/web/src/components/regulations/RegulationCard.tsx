'use client';

import { Flag, FileText, ExternalLink } from 'lucide-react';
import { Card, Badge, SeverityBadge, SectionTypeBadge } from '@/components/ui';
import { KeywordTags } from '@/components/ui/KeywordTags';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { getComplexityVariant } from '@/types/regulation';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { useStateFromPath } from '@/hooks';

interface RegulationCardProps {
  regulation: RegulationWithAnalysis;
  onClick: () => void;
}

/**
 * Card component for displaying a regulation in grid view.
 * Shows key metrics prominently with secondary details below.
 */
export function RegulationCard({ regulation, onClick }: RegulationCardProps) {
  const state = useStateFromPath();

  const {
    id,
    title,
    hierarchyLevel,
    excludeFromAnalysis,
    redFlags,
    maxSeverity,
    overallComplexity,
    sectionType,
    keywords,
    hasForm,
    hasIbr,
    summary,
  } = regulation;

  const numFlags = redFlags?.length ?? 0;
  const complexity = overallComplexity ?? null;
  const categories = redFlags?.map((f) => f.category) ?? [];
  const uniqueCategories = [...new Set(categories)];

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
      aria-label={`${title}, ${numFlags} flags, severity ${maxSeverity ?? 'no red flag rating'}`}
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
          {maxSeverity !== null && <SeverityBadge severity={maxSeverity} />}
        </div>

        <h3 className="text-sm font-semibold text-[var(--color-text)] line-clamp-2 mb-2">
          {title}
        </h3>

        {/* Badge Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {sectionType && <SectionTypeBadge type={sectionType} />}
          {complexity && (
            <Badge variant={getComplexityVariant(complexity)} className="text-xs">
              {complexity}
            </Badge>
          )}
          <MetadataIndicators hasForm={hasForm} hasIbr={hasIbr} />
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 pt-3 flex-1 flex flex-col gap-3">
        {/* Flags Summary */}
        <div className="flex items-center gap-2">
          <div
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-md)]
              ${numFlags > 0 ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]' : 'bg-[var(--color-neutral-50)] text-[var(--color-text-muted)]'}
            `}
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{numFlags}</span>
          </div>
          {uniqueCategories.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)] line-clamp-1">
              {uniqueCategories.slice(0, 2).join(', ')}
              {uniqueCategories.length > 2 && ` +${uniqueCategories.length - 2}`}
            </span>
          )}
        </div>

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
          href={`/${state}/regulations/${id}`}
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
