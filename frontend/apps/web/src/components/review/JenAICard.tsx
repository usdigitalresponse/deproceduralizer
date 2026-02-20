'use client';

import { Badge, SeverityBadge, Tag } from '@/components/ui';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { CardWrapper, HierarchyBreadcrumbsInline } from './shared';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { getComplexityVariant, formatLabel } from '@/types/regulation';

interface JenAIIssueData {
  id: number;
  category: string;
  explanation: string;
  severity: number;
  complexity: string;
  confidence: number;
  matchedPhrases: string[] | null;
  implementationApproach: string | null;
  effortEstimate: string | null;
  textExamples: string[] | null;
  reviewStatus: string | null;
  regulation: {
    id: number;
    title: string | null;
    content: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    url: string | null;
    summary: string | null;
    sectionType: string | null;
    hasForm: boolean | null;
    hasIbr: boolean | null;
  };
}

interface JenAICardProps {
  issue: JenAIIssueData;
  state?: string;
}

export function JenAICard({ issue, state = 'ny' }: JenAICardProps) {
  const nycrrCitation = formatNycrrCitation(
    issue.regulation.nycrrTitle,
    issue.regulation.nycrrPart,
    issue.regulation.nycrrSection
  );

  const categoryLabel = JENAI_CATEGORY_LABELS[issue.category] || formatLabel(issue.category);

  return (
    <CardWrapper id={`jenai-${issue.id}`} data-testid="jenai-card">
      {/* Header: category, severity, confidence, review status */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
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
        {/* Review status */}
        {issue.reviewStatus && issue.reviewStatus !== 'unreviewed' && (
          <Badge
            variant={issue.reviewStatus === 'confirmed' ? 'success' : 'default'}
            className="text-xs ml-auto"
          >
            {formatLabel(issue.reviewStatus)}
          </Badge>
        )}
      </div>

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

      {/* Regulation context */}
      <div className="mb-4 text-sm">
        <span className="text-[var(--color-text-muted)]">
          {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
          {nycrrCitation && issue.regulation.title && ' - '}
        </span>
        <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
      </div>

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

      {/* Document link */}
      {issue.regulation.url && (
        <div className="pt-2 border-t border-[var(--color-neutral-200)]">
          <a
            href={issue.regulation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline"
          >
            View regulation source
          </a>
        </div>
      )}
    </CardWrapper>
  );
}

export default JenAICard;
