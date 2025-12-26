'use client';

import { useState, forwardRef, useCallback, useTransition } from 'react';
import { updateComplianceIssueReview, getExpandedContext } from '@/lib/actions/compliance-issues';
import { Button, Textarea, Badge, Select, Tag, CopyLinkButton } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';
import { highlightTerm, highlightContext } from '@/lib/utils/highlight';
import { CardWrapper } from './shared';
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, REVIEW_STATUS_DESCRIPTIONS, type ReviewStatus } from '@deproceduralizer/database/schema';
import type { ComplianceIssueWithContext } from '@deproceduralizer/database';

interface ComplianceIssueCardProps {
  issue: ComplianceIssueWithContext;
  onUpdated: (updatedIssue: ComplianceIssueWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const ComplianceIssueCard = forwardRef<HTMLDivElement, ComplianceIssueCardProps>(
  ({ issue, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    // Simple inline form state for compliance issues
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [reviewStatus, setReviewStatus] = useState(issue.reviewStatus || 'unreviewed');
    const [reviewerNotes, setReviewerNotes] = useState(issue.reviewerNotes || '');

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      startTransition(async () => {
        const result = await updateComplianceIssueReview({
          id: issue.id,
          reviewStatus,
          reviewerNotes: reviewerNotes || undefined,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        onUpdated({
          ...issue,
          reviewStatus: result.data.reviewStatus ?? null,
          reviewerNotes: result.data.reviewerNotes ?? null,
        });
      });
    }, [issue, reviewStatus, reviewerNotes, onUpdated]);

    // Expanded context state
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedText, setExpandedText] = useState<string | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);

    // Format citation based on state
    const citation = issue.state === 'NJ'
      ? formatNjacCitation(
          issue.regulation.njacTitle,
          issue.regulation.njacChapter,
          issue.regulation.njacSubchapter
        )
      : formatNycrrCitation(
          issue.regulation.nycrrTitle,
          issue.regulation.nycrrPart,
          issue.regulation.nycrrSection
        );

    // Handle expanding context
    const handleExpandContext = useCallback(async () => {
      if (isExpanded) {
        setIsExpanded(false);
        return;
      }

      if (expandedText) {
        setIsExpanded(true);
        return;
      }

      setIsLoadingContext(true);
      try {
        const result = await getExpandedContext(issue.documentId, issue.matchedContext, 800);
        if (result.success && result.data.couldExpand) {
          setExpandedText(result.data.expandedText);
          setIsExpanded(true);
        } else if (!result.success) {
          console.error('Failed to expand context:', result.error);
        }
      } catch (err) {
        console.error('Failed to expand context:', err);
      } finally {
        setIsLoadingContext(false);
      }
    }, [isExpanded, expandedText, issue.documentId, issue.matchedContext]);

    // Convert REVIEW_STATUSES to Select format with labels
    const statusOptions = REVIEW_STATUSES.map((status) => ({
      value: status,
      label: REVIEW_STATUS_LABELS[status],
    }));

    const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;

    return (
      <CardWrapper
        ref={ref}
        id={`compliance-${issue.id}`}
        isFocused={isFocused}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <CopyLinkButton anchor={`compliance-${issue.id}`} />
            <Badge variant="warning" className="font-semibold">
              {issueTypeLabel}
            </Badge>
            {issue.requirementFound && (
              <Badge variant="success" className="text-xs">
                LLM Confirmed
              </Badge>
            )}
            {issue.requiredByStatute && (
              <Badge variant="info" className="text-xs">
                From Statute
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                issue.reviewStatus === 'confirmed'
                  ? 'success'
                  : issue.reviewStatus === 'false_positive'
                  ? 'default'
                  : issue.reviewStatus === 'needs_context'
                  ? 'warning'
                  : issue.reviewStatus === 'deferred'
                  ? 'info'
                  : 'default'
              }
            >
              {issue.reviewStatus || 'unreviewed'}
            </Badge>
          </div>
        </div>

        {/* Regulation context */}
        <div className="mb-4 text-sm">
          <span className="text-[var(--color-text-muted)]">
            {citation && <span className="font-mono">{citation}</span>}
            {citation && issue.regulation.title && ' - '}
          </span>
          <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
        </div>

        {/* Pattern matched */}
        {issue.matchedPattern && (
          <div className="mb-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Pattern matched:</span>
            <div className="mt-1">
              <Tag variant="warning" size="sm">
                {issue.matchedPattern}
              </Tag>
            </div>
          </div>
        )}

        {/* Context with highlighted term - with expand option */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Regulation Text
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExpandContext}
              disabled={isLoadingContext}
              className="text-xs py-0.5 px-2 h-auto"
            >
              {isLoadingContext ? 'Loading...' : isExpanded ? 'Show less' : 'Show more context'}
            </Button>
          </div>
          <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 border-[var(--color-warning)]">
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
              {isExpanded && expandedText
                ? highlightContext(expandedText, issue.matchedContext, issue.matchedPattern)
                : highlightTerm(issue.matchedContext, issue.matchedPattern)}
            </p>
          </div>
        </div>

        {/* Requirement text */}
        {issue.requirementText && issue.requirementText !== issue.matchedContext && (
          <div className="mb-4">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Requirement:</span>
            <blockquote className="mt-1 pl-3 border-l-2 border-[var(--color-neutral-300)] text-sm text-[var(--color-text)] italic">
              &ldquo;{issue.requirementText}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Review form */}
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          {error && (
            <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          {/* Status */}
          <div className="mb-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Status *
              </label>
              <Select
                value={reviewStatus}
                onValueChange={(value) => setReviewStatus(value)}
                options={statusOptions}
                disabled={isPending}
              />
            </div>
            {/* Status description helper text */}
            {REVIEW_STATUS_DESCRIPTIONS[reviewStatus as ReviewStatus] && reviewStatus !== 'unreviewed' && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)] italic">
                {REVIEW_STATUS_DESCRIPTIONS[reviewStatus as ReviewStatus]}
              </p>
            )}
          </div>

          {/* Reviewer Notes */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Notes
            </label>
            <Textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={2}
              placeholder="Your notes on this issue..."
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onViewRegulation(issue.regulation.id)}
            >
              View Full Regulation
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
              {isPending ? 'Saving...' : 'Save Review'}
            </Button>
          </div>
        </form>
      </CardWrapper>
    );
  }
);

ComplianceIssueCard.displayName = 'ComplianceIssueCard';

export default ComplianceIssueCard;
