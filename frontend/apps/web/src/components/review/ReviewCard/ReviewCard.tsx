'use client';

import { forwardRef } from 'react';
import { Tag } from '@/components/ui';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { formatStateCitation } from '@/lib/formatters/citations';
import { CardWrapper, HierarchyBreadcrumbsInline, SiblingSectionsView } from '../shared';
import { Header } from './Header';
import { LLMAnalysisSection } from './LLMAnalysisSection';
import { RegulationActions } from './RegulationActions';
import { ReviewForm } from './ReviewForm';
import type { ReviewCardProps } from './types';

export const ReviewCard = forwardRef<HTMLDivElement, ReviewCardProps>(
  ({ flag, onUpdated, onViewRegulation, isFocused = false, state = 'ny' }, ref) => {
    const citation = formatStateCitation(state, flag.regulation);

    return (
      <CardWrapper
        ref={ref}
        id={`flag-${flag.id}`}
        isFocused={isFocused}
        data-testid="red-flag-card"
      >
        {/* Header: category, severity, complexity, effort, review status */}
        <Header flag={flag} />

        {/* Summary context */}
        {(flag.regulation.summary || flag.regulation.sectionType || flag.regulation.hasForm || flag.regulation.hasIbr) && (
          <div className="bg-[var(--color-neutral-50)] rounded p-2 mb-3">
            {flag.regulation.summary && (
              <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2">
                {flag.regulation.summary}
              </p>
            )}
            <div className="flex items-center gap-2">
              {flag.regulation.sectionType && (
                <SectionTypeBadge type={flag.regulation.sectionType} compact />
              )}
              <MetadataIndicators hasForm={flag.regulation.hasForm} hasIbr={flag.regulation.hasIbr} />
            </div>
          </div>
        )}

        {/* Hierarchy breadcrumb */}
        <div className="mb-2">
          <HierarchyBreadcrumbsInline
            documentId={flag.regulation.id}
            state={state}
          />
        </div>

        {/* Regulation context */}
        <div className="mb-4 text-sm">
          <span className="text-[var(--color-text-muted)]">
            {citation && <span className="font-mono">{citation}</span>}
            {citation && flag.regulation.title && ' - '}
          </span>
          <span className="text-[var(--color-text-secondary)]">{flag.regulation.title}</span>
        </div>

        {/* LLM Analysis: explanation, text examples, implementation, effort */}
        <LLMAnalysisSection
          explanation={flag.explanation}
          textExamples={flag.textExamples}
          implementationApproach={flag.implementationApproach}
          effortEstimate={flag.effortEstimate}
        />

        {/* Technical Details: matched phrases (collapsible) */}
        {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
          <details className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
            <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Technical Details
              <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">
                ({flag.matchedPhrases.length} matched phrase{flag.matchedPhrases.length !== 1 ? 's' : ''})
              </span>
            </summary>
            <div className="mt-3 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {flag.matchedPhrases.map((phrase, i) => (
                  <Tag key={i} variant="primary" size="sm">
                    {phrase}
                  </Tag>
                ))}
              </div>
            </div>
          </details>
        )}

        {/* Regulation actions: view page, Cornell link, text viewer, tree */}
        <RegulationActions
          regulation={flag.regulation}
          stateCode={state.toLowerCase()}
          explanation={flag.explanation}
          matchedPhrases={flag.matchedPhrases}
        />

        {/* Sibling sections: neighboring sections under same parent */}
        <SiblingSectionsView
          documentId={flag.regulation.id}
          state={state}
        />

        {/* Review form */}
        <ReviewForm flag={flag} onUpdated={onUpdated} />
      </CardWrapper>
    );
  }
);

ReviewCard.displayName = 'ReviewCard';

export default ReviewCard;
