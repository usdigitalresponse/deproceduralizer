'use client';

import { ReactNode } from 'react';
import { Badge, ReviewStatusBadge, SeverityBadge, Tag, Button } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { highlightTerm, highlightContext } from '@/lib/utils/highlight';

interface ComplianceIssueDisplayCardProps {
  /** The compliance issue data to display */
  issue: {
    issueType: string;
    requirementFound: boolean | null;
    requiredByStatute: boolean | null;
    reviewStatus: string | null;
    matchedPattern: string | null;
    matchedContext: string;
    requirementText: string | null;
    isVerbatim: boolean | null;
    severity: number | null;
    impactAssessment: string | null;
    statuteCitation: string | null;
  };
  /** Whether to show the review status badge in the header */
  showReviewStatus?: boolean;
  /** Expanded context configuration */
  expandedContext?: {
    isExpanded: boolean;
    expandedText: string | null;
    canExpand: boolean;
    onToggle: () => void;
  };
  /** Optional content to render at the bottom (e.g., review form) */
  children?: ReactNode;
}

/**
 * Display component for a single compliance issue.
 * Uses consistent styling with the review queue - blue LLM Analysis section.
 * Used by ComplianceIssuesList for consistent issue rendering.
 */
export function ComplianceIssueDisplayCard({
  issue,
  showReviewStatus = true,
  expandedContext,
  children,
}: ComplianceIssueDisplayCardProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
  const isExpanded = expandedContext?.isExpanded ?? false;
  const canExpand = expandedContext?.canExpand ?? false;
  const expandedText = expandedContext?.expandedText;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-neutral-200)] p-4 rounded-[var(--radius-md)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="warning" className="font-semibold">
            {issueTypeLabel}
          </Badge>
          {issue.requirementFound === true && (
            <Badge variant="success" className="text-xs">
              LLM Confirmed
            </Badge>
          )}
          {issue.requirementFound === false && (
            <Badge variant="danger" className="text-xs">
              LLM Rejected
            </Badge>
          )}
          {issue.requiredByStatute && (
            <Badge variant="info" className="text-xs">
              From Statute
            </Badge>
          )}
          {issue.severity !== null && (
            <SeverityBadge severity={issue.severity} />
          )}
        </div>
        {showReviewStatus && issue.reviewStatus && (
          <ReviewStatusBadge status={issue.reviewStatus} />
        )}
      </div>

      {/* LLM Analysis - Primary content, always visible (matching review queue style) */}
      {(issue.requirementText || issue.impactAssessment) && (
        <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border border-[var(--color-primary)]/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-[var(--color-primary)]">LLM Analysis</span>
            {issue.isVerbatim !== null && (
              <Badge
                variant={issue.isVerbatim ? 'info' : 'default'}
                className="text-[10px] py-0 px-1.5"
              >
                {issue.isVerbatim ? 'Verbatim Quote' : 'Paraphrased'}
              </Badge>
            )}
          </div>

          {/* Requirement Text - the key finding */}
          {issue.requirementText && (
            <div className="mb-3">
              <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">"</span>}
                {highlightTerm(issue.requirementText, issue.matchedPattern)}
                {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">"</span>}
              </p>
            </div>
          )}

          {/* Impact Assessment */}
          {issue.impactAssessment && (
            <div className="pt-3 border-t border-[var(--color-primary)]/10">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Impact Assessment:</span>
              <p className="mt-1 text-sm text-[var(--color-text)]">{issue.impactAssessment}</p>
            </div>
          )}

          {/* Statute Citation */}
          {issue.statuteCitation && (
            <div className="pt-3 border-t border-[var(--color-primary)]/10">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Statute Citation:</span>
              <p className="mt-1 text-sm font-mono text-[var(--color-text)]">{issue.statuteCitation}</p>
            </div>
          )}
        </div>
      )}

      {/* Context expansion (if available) */}
      {(canExpand || isExpanded) && expandedContext?.onToggle && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandedContext.onToggle}
            className="text-xs"
          >
            {isExpanded ? 'Hide Full Section' : 'View Full Section'}
          </Button>
        </div>
      )}

      {/* Expanded Section Text */}
      {isExpanded && expandedText && (
        <div className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
            {highlightContext(expandedText, issue.requirementText || issue.matchedContext, issue.matchedPattern)}
          </p>
        </div>
      )}

      {/* Technical Details - collapsible (regex pattern only) */}
      {issue.matchedPattern && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1">
            Technical Details
          </summary>
          <div className="mt-2 pl-2 border-l-2 border-[var(--color-neutral-200)]">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Pattern matched:</span>
            <div className="mt-1">
              <Tag variant="warning" size="sm">
                {issue.matchedPattern}
              </Tag>
            </div>
          </div>
        </details>
      )}

      {/* Original Match Context (collapsible, only if different from requirementText) */}
      {issue.requirementText && issue.matchedContext && issue.requirementText !== issue.matchedContext && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1">
            Original Match Context
          </summary>
          <div className="mt-2 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-2 border-[var(--color-neutral-300)]">
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
              {highlightTerm(issue.matchedContext, issue.matchedPattern)}
            </p>
          </div>
        </details>
      )}

      {/* Children slot (typically review form) */}
      {children}
    </div>
  );
}

export default ComplianceIssueDisplayCard;
