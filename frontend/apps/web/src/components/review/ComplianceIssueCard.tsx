'use client';

import { useState, useTransition, useEffect, forwardRef, useCallback } from 'react';
import { updateComplianceIssueReview, getExpandedContext } from '@/lib/actions/compliance-issues';
import { useReviewerName } from '@/hooks/useReviewerName';
import { Button, Input, Textarea, Badge, Select, Tag, CopyLinkButton } from '@/components/ui';
import { REVIEW_STATUSES, PRIORITY_OPTIONS, IMPACT_TYPES, ISSUE_TYPE_LABELS } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';
import { CardWrapper } from './shared';
import type { ComplianceIssueWithContext } from '@deproceduralizer/database';

interface ComplianceIssueCardProps {
  issue: ComplianceIssueWithContext;
  onUpdated: (updatedIssue: ComplianceIssueWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const ComplianceIssueCard = forwardRef<HTMLDivElement, ComplianceIssueCardProps>(
  ({ issue, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

    // Expanded context state
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedText, setExpandedText] = useState<string | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);

    const [formData, setFormData] = useState({
      reviewStatus: issue.reviewStatus || 'unreviewed',
      reviewedBy: issue.reviewedBy || '',
      reviewerNotes: issue.reviewerNotes || '',
      priority: issue.priority || undefined,
      impactType: issue.impactType || '',
    });

    // Pre-fill reviewer name from localStorage
    useEffect(() => {
      if (isLoaded && storedName && !formData.reviewedBy) {
        setFormData((prev) => ({ ...prev, reviewedBy: storedName }));
      }
    }, [isLoaded, storedName, formData.reviewedBy]);

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
        const result = await getExpandedContext(issue.documentId, issue.context, 800);
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
    }, [isExpanded, expandedText, issue.documentId, issue.context]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!formData.reviewedBy.trim()) {
        setError('Reviewer name is required');
        return;
      }

      startTransition(async () => {
        try {
          const result = await updateComplianceIssueReview({
            id: issue.id,
            reviewStatus: formData.reviewStatus,
            reviewedBy: formData.reviewedBy,
            reviewerNotes: formData.reviewerNotes || undefined,
            priority: formData.priority,
            impactType: formData.impactType || undefined,
          });

          if (!result.success) {
            setError(result.error);
            return;
          }

          // Save reviewer name for next time
          saveReviewerName(formData.reviewedBy);

          // Update parent with new data
          onUpdated({
            ...issue,
            reviewStatus: result.data.reviewStatus ?? null,
            reviewedBy: result.data.reviewedBy ?? null,
            reviewedAt: result.data.reviewedAt ?? null,
            reviewerNotes: result.data.reviewerNotes ?? null,
            priority: result.data.priority ?? null,
            impactType: result.data.impactType ?? null,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update review');
        }
      });
    };

    // Highlight the matched term in context
    const highlightTerm = (text: string, term: string | null) => {
      if (!term) return text;
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[var(--color-warning-bg)] px-0.5 rounded font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      );
    };

    // Highlight the original context within expanded text
    const highlightContext = (expanded: string, originalContext: string, term: string | null) => {
      const normalizedContext = originalContext.replace(/\s+/g, ' ').trim();
      const normalizedExpanded = expanded.replace(/\s+/g, ' ');
      const contextIndex = normalizedExpanded.indexOf(normalizedContext);

      if (contextIndex === -1) {
        return highlightTerm(expanded, term);
      }

      // Find approximate position in original (non-normalized) text
      const beforeContext = expanded.slice(0, contextIndex);
      const contextPortion = expanded.slice(contextIndex, contextIndex + normalizedContext.length);
      const afterContext = expanded.slice(contextIndex + normalizedContext.length);

      return (
        <>
          <span className="text-[var(--color-text-muted)]">{beforeContext}</span>
          <span className="bg-[var(--color-warning-bg)]/50 px-1 py-0.5 rounded">
            {highlightTerm(contextPortion, term)}
          </span>
          <span className="text-[var(--color-text-muted)]">{afterContext}</span>
        </>
      );
    };

    // Convert options to Select format with explicit "none" sentinel
    const priorityOptions = [{ value: 'none', label: '--' }, ...PRIORITY_OPTIONS];
    const impactOptions = [{ value: 'none', label: '--' }, ...IMPACT_TYPES];

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
            {issue.llmConfirmed && (
              <Badge variant="success" className="text-xs">
                LLM Confirmed
              </Badge>
            )}
            {issue.fromStatute && (
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

        {/* Term matched */}
        {issue.termMatched && (
          <div className="mb-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Term matched:</span>
            <div className="mt-1">
              <Tag variant="warning" size="sm">
                {issue.termMatched}
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
                ? highlightContext(expandedText, issue.context, issue.termMatched)
                : highlightTerm(issue.context, issue.termMatched)}
            </p>
          </div>
        </div>

        {/* Requirement quote */}
        {issue.requirementQuote && issue.requirementQuote !== issue.context && (
          <div className="mb-4">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Requirement:</span>
            <blockquote className="mt-1 pl-3 border-l-2 border-[var(--color-neutral-300)] text-sm text-[var(--color-text)] italic">
              &ldquo;{issue.requirementQuote}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Statute citation */}
        {issue.statuteCitation && (
          <div className="mb-4 text-sm">
            <span className="font-medium text-[var(--color-text-secondary)]">Statute:</span>
            <span className="ml-2 font-mono text-[var(--color-text)]">{issue.statuteCitation}</span>
          </div>
        )}

        {/* Review form */}
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          {error && (
            <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Status *
              </label>
              <Select
                value={formData.reviewStatus}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, reviewStatus: value }))}
                options={[...REVIEW_STATUSES]}
                disabled={isPending}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Priority
              </label>
              <Select
                value={formData.priority?.toString() ?? 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: value === 'none' ? undefined : parseInt(value),
                  }))
                }
                options={priorityOptions}
                disabled={isPending}
              />
            </div>

            {/* Impact Type */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Impact
              </label>
              <Select
                value={formData.impactType || 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    impactType: value === 'none' ? '' : value,
                  }))
                }
                options={impactOptions}
                disabled={isPending}
              />
            </div>

            {/* Reviewer */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Reviewer *
              </label>
              <Input
                value={formData.reviewedBy}
                onChange={(e) => setFormData((prev) => ({ ...prev, reviewedBy: e.target.value }))}
                placeholder="Your name"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Notes
            </label>
            <Textarea
              value={formData.reviewerNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, reviewerNotes: e.target.value }))}
              rows={2}
              placeholder="Add any notes about this issue..."
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
