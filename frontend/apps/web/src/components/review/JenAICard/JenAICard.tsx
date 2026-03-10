'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge, SeverityBadge, Tag, Button } from '@/components/ui';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { CardWrapper, HierarchyBreadcrumbsInline, CornellLink, RegulationTextViewer, HierarchyTreeView } from '../shared';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { getComplexityVariant, formatLabel } from '@/types/regulation';
import { ReviewForm } from './ReviewForm';
import { DeveloperForm } from './DeveloperForm';
import { JenAIReviewSummary } from './ReviewSummary';
import type { JenAICardProps } from './types';

export const JenAICard = forwardRef<HTMLDivElement, JenAICardProps>(
  function JenAICard({ issue, onUpdated, onCleared, state = 'ny', mode = 'review' }, ref) {
    const categoryLabel = JENAI_CATEGORY_LABELS[issue.category] || formatLabel(issue.category);
    const isGuidance = issue.sourceType === 'guidance';

    return (
      <CardWrapper ref={ref} id={`jenai-${issue.id}`} data-testid="jenai-card">
        {/* Header: category, severity, confidence, review status, source badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="info" className="text-xs font-medium">
            {categoryLabel}
          </Badge>
          <SeverityBadge severity={issue.severity} />
          {issue.complexity && (
            <Badge variant={getComplexityVariant(issue.complexity)} className="text-xs">
              {issue.complexity}
            </Badge>
          )}
          <Badge variant="default" className="text-xs">
            {Math.round(issue.confidence * 100)}% confidence
          </Badge>
          {isGuidance && (
            <Badge variant="warning" className="text-xs">
              Guidance
            </Badge>
          )}
          {issue.reviewStatus && issue.reviewStatus !== 'unreviewed' && (
            <Badge
              variant={issue.reviewStatus === 'confirmed' ? 'success' : 'default'}
              className="text-xs ml-auto"
            >
              {formatLabel(issue.reviewStatus)}
            </Badge>
          )}
        </div>

        {/* Source context: regulation or guidance */}
        {isGuidance ? (
          <GuidanceContext issue={issue} state={state} />
        ) : (
          <RegulationContext issue={issue} state={state} />
        )}

        {/* Explanation */}
        <div className="mb-4">
          <p className="text-sm text-[var(--color-text)] leading-relaxed">
            {issue.explanation}
          </p>
        </div>

        {/* Text examples */}
        {issue.textExamples && issue.textExamples.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              Text Examples
            </h4>
            <div className="space-y-2">
              {issue.textExamples.map((example, i) => (
                <blockquote
                  key={i}
                  className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-neutral-50)] border-l-2 border-[var(--color-primary-weak)] p-2 rounded-r"
                >
                  {example}
                </blockquote>
              ))}
            </div>
          </div>
        )}

        {/* Implementation approach */}
        {issue.implementationApproach && (
          <div className="mb-4 p-3 bg-[var(--color-success-bg)] rounded-[var(--radius-md)]">
            <h4 className="text-xs font-medium text-[var(--color-success)] mb-1">
              Implementation Approach
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {issue.implementationApproach}
            </p>
          </div>
        )}

        {/* Effort estimate */}
        {issue.effortEstimate && (
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Effort: {issue.effortEstimate}
          </p>
        )}

        {/* Technical details: matched phrases */}
        {issue.matchedPhrases && issue.matchedPhrases.length > 0 && (
          <details className="mb-3 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
            <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Matched Phrases
              <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">
                ({issue.matchedPhrases.length})
              </span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {issue.matchedPhrases.map((phrase, i) => (
                <Tag key={i} variant="primary" size="sm">
                  {phrase}
                </Tag>
              ))}
            </div>
          </details>
        )}

        {/* Document actions */}
        {isGuidance && issue.guidance ? (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[var(--color-neutral-200)]">
            <Button variant="secondary" size="sm" onClick={() => window.open(`/${state.toLowerCase()}/guidance/${issue.guidance!.id}`, '_blank')}>
              View Guidance Page <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
            <CornellLink url={issue.guidance.url} />
          </div>
        ) : issue.regulation ? (
          <>
            <div className="mb-4 flex items-center gap-3 pt-2 border-t border-[var(--color-neutral-200)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.open(`/${state.toLowerCase()}/regulations/${issue.regulation!.id}`, '_blank')}
              >
                View Full Regulation Page
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <CornellLink url={issue.regulation.url} />
            </div>

            {issue.regulation.content && (
              <RegulationTextViewer
                content={issue.regulation.content}
                documentId={issue.regulation.id}
                state={state}
                scrollToText={issue.textExamples?.[0]}
                isVerbatim={issue.isVerbatim ?? false}
                label="Show Section Text"
              />
            )}

            <HierarchyTreeView
              documentId={issue.regulation.id}
              state={state}
            />
          </>
        ) : null}

        {/* Review summary (read-only, shown in developer mode) */}
        {mode === 'developer' && <JenAIReviewSummary issue={issue} />}

        {/* Form: review or developer */}
        {mode === 'developer' ? (
          <DeveloperForm issue={issue} onUpdated={onUpdated} onCleared={onCleared} state={state} />
        ) : (
          <ReviewForm issue={issue} onUpdated={onUpdated} />
        )}
      </CardWrapper>
    );
  }
);

function RegulationContext({ issue, state }: { issue: JenAICardProps['issue']; state: string }) {
  if (!issue.regulation) return null;

  const nycrrCitation = formatNycrrCitation(
    issue.regulation.nycrrTitle,
    issue.regulation.nycrrPart,
    issue.regulation.nycrrSection
  );

  return (
    <>
      {/* Summary context */}
      {(issue.regulation.summary || issue.regulation.sectionType || issue.regulation.hasForm || issue.regulation.hasIbr) && (
        <div className="bg-[var(--color-neutral-50)] rounded p-2 mb-3">
          {issue.regulation.summary && (
            <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2">
              {issue.regulation.summary}
            </p>
          )}
          <div className="flex items-center gap-2">
            {issue.regulation.sectionType && (
              <SectionTypeBadge type={issue.regulation.sectionType} compact />
            )}
            <MetadataIndicators hasForm={issue.regulation.hasForm} hasIbr={issue.regulation.hasIbr} />
          </div>
        </div>
      )}

      {/* Hierarchy breadcrumb */}
      <div className="mb-2">
        <HierarchyBreadcrumbsInline
          documentId={issue.regulation.id}
          state={state}
        />
      </div>

      {/* Regulation citation */}
      <div className="mb-4 text-sm">
        <Link
          href={`/${state.toLowerCase()}/regulations/${issue.regulation.id}`}
          className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
        >
          {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
          {nycrrCitation && issue.regulation.title && ' - '}
          <span>{issue.regulation.title}</span>
        </Link>
      </div>
    </>
  );
}

function GuidanceContext({ issue, state }: { issue: JenAICardProps['issue']; state: string }) {
  if (!issue.guidance) return null;

  const { guidance } = issue;
  const isSuperseded = guidance.status && guidance.status !== 'active';

  return (
    <div className="bg-[var(--color-warning-bg)] rounded p-2 mb-3">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {guidance.agency && (
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {guidance.agency}
          </span>
        )}
        {guidance.docType && (
          <Badge variant="default" className="text-xs">
            {guidance.docType}
          </Badge>
        )}
        {guidance.year && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {guidance.datePublished ? `Published ${guidance.datePublished}` : `${guidance.year}`}
          </span>
        )}
        {guidance.policyCategory && (
          <Badge variant="info" className="text-xs">
            {formatLabel(guidance.policyCategory)}
          </Badge>
        )}
        {isSuperseded && (
          <Badge variant="danger" className="text-xs">
            {formatLabel(guidance.status!)}
          </Badge>
        )}
      </div>
      {guidance.title && (
        <p className="text-sm text-[var(--color-text)] mb-1">
          <Link
            href={`/${state.toLowerCase()}/guidance/${guidance.id}`}
            className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
          >
            {guidance.title}
          </Link>
        </p>
      )}
      {/* Superseding info */}
      {guidance.supersededBy && (
        <p className="text-xs text-[var(--color-danger)]">
          Superseded by: {guidance.supersededBy}
        </p>
      )}
      {guidance.supersedes && guidance.supersedes.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Supersedes: {guidance.supersedes.length} document{guidance.supersedes.length > 1 ? 's' : ''}
        </p>
      )}
      {guidance.revisionOf && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Revision of: {guidance.revisionOf}
        </p>
      )}
    </div>
  );
}
