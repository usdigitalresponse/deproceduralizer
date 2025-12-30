'use client';

import { forwardRef } from 'react';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import { useReviewForm } from '@/hooks';
import { Button, Input, Textarea, Badge, SeverityBadge, Select, Tag, CopyLinkButton } from '@/components/ui';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { ISSUE_TYPE_LABELS, UPDATED_SEVERITY_OPTIONS, IMPACT_TYPES } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';
import { CardWrapper, HierarchyBreadcrumbsInline, CornellLink, RegulationTextViewer, HierarchyTreeView } from './shared';
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, REVIEW_STATUS_DESCRIPTIONS, type ReviewStatus } from '@deproceduralizer/database/schema';
import type { ComplianceIssueWithContext } from '@deproceduralizer/database';
import { getStateFromPathname } from '@/hooks/useStateFromPath';

interface ComplianceIssueCardProps {
  issue: ComplianceIssueWithContext;
  onUpdated: (updatedIssue: ComplianceIssueWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const ComplianceIssueCard = forwardRef<HTMLDivElement, ComplianceIssueCardProps>(
  ({ issue, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    // Get state from pathname for opening regulation in new tab
    const pathname = usePathname();
    const stateCode = getStateFromPathname(pathname);

    // Use shared review form hook for state management
    const {
      formData,
      updateField,
      isPending,
      error,
      handleSubmit,
    } = useReviewForm({
      initialData: issue,
      onSubmit: async (data) => updateComplianceIssueReview({
        id: data.id,
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        justificationNotes: data.justificationNotes,
        teamNotes: data.teamNotes,
        severity: data.severity,
        impactType: data.impactType,
      }),
      onUpdated: (data) => {
        onUpdated({
          ...issue,
          reviewStatus: data.reviewStatus ?? null,
          reviewedBy: data.reviewedBy ?? null,
          reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
          justificationNotes: data.justificationNotes ?? null,
          teamNotes: data.teamNotes ?? null,
          severity: data.severity ?? issue.severity,
          impactType: data.impactType ?? null,
        });
      },
    });

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

    // Convert options to Select format with explicit "none" sentinel
    const severityOptions = [{ value: 'none', label: '--' }, ...UPDATED_SEVERITY_OPTIONS];
    const impactOptions = [{ value: 'none', label: '--' }, ...IMPACT_TYPES];

    // Convert REVIEW_STATUSES to Select format with labels
    const statusOptions = REVIEW_STATUSES.map((status) => ({
      value: status,
      label: REVIEW_STATUS_LABELS[status],
    }));

    // Get current status description for helper text
    const currentStatusDescription = REVIEW_STATUS_DESCRIPTIONS[formData.reviewStatus as ReviewStatus] || '';

    const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;

    return (
      <CardWrapper
        ref={ref}
        id={`compliance-${issue.id}`}
        isFocused={isFocused}
        data-testid="compliance-issue-card"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <CopyLinkButton anchor={`compliance-${issue.id}`} />
            <a
              href={`/prompts#prompt-${issue.issueType}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 group"
              title="View prompt definition (opens in new tab)"
            >
              <Badge variant="warning" className="font-semibold group-hover:ring-2 group-hover:ring-[var(--color-warning)]/30 transition-shadow">
                {issueTypeLabel}
              </Badge>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-warning)] transition-colors" />
            </a>
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
            state={issue.state || 'nj'}
          />
        </div>

        {/* Regulation context */}
        <div className="mb-4 text-sm">
          <span className="text-[var(--color-text-muted)]">
            {citation && <span className="font-mono">{citation}</span>}
            {citation && issue.regulation.title && ' - '}
          </span>
          <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
        </div>

        {/* LLM Analysis - Primary content, always visible */}
        {(issue.impactAssessment || issue.requirementText) && (
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
                  {issue.requirementText}
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

        {/* View Full Regulation Page + Cornell Link */}
        <div className="mb-4 flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => window.open(`/${stateCode}/regulations/${issue.regulation.id}`, '_blank')}
          >
            View Full Regulation Page
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          <CornellLink url={issue.regulation.url} />
        </div>

        {/* Full Regulation Text Viewer */}
        {issue.regulation.content && (
          <RegulationTextViewer
            content={issue.regulation.content}
            scrollToText={issue.requirementText}
            highlightPattern={issue.matchedPattern}
            isVerbatim={issue.isVerbatim ?? false}
            label="Show Regulation Text"
          />
        )}

        {/* Hierarchy Tree View */}
        <HierarchyTreeView
          documentId={issue.regulation.id}
          state={stateCode}
          defaultExpanded
        />

        {/* Technical Details - collapsible (regex pattern only) */}
        {issue.matchedPattern && (
          <details className="mb-4">
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

        {/* Review form */}
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          {error && (
            <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          {/* Status with description */}
          <div className="mb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Status *
                </label>
                <Select
                  value={formData.reviewStatus}
                  onValueChange={(value) => updateField('reviewStatus', value)}
                  options={statusOptions}
                  disabled={isPending}
                  data-testid="compliance-status-select"
                />
              </div>

              {/* Severity */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Severity
                  {issue.originalSeverity !== null && issue.originalSeverity !== issue.severity && (
                    <span className="ml-1 font-normal text-[var(--color-text-muted)]">
                      (Original: {issue.originalSeverity})
                    </span>
                  )}
                </label>
                <Select
                  value={formData.severity?.toString() ?? 'none'}
                  onValueChange={(value) => updateField('severity', value === 'none' ? undefined : parseInt(value))}
                  options={severityOptions}
                  disabled={isPending}
                  data-testid="compliance-severity-select"
                />
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  Change if severity doesn&apos;t match your assessment
                </p>
              </div>

              {/* Impact Type */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Impact
                </label>
                <Select
                  value={formData.impactType || 'none'}
                  onValueChange={(value) => updateField('impactType', value === 'none' ? undefined : value)}
                  options={impactOptions}
                  disabled={isPending}
                  data-testid="compliance-impact-select"
                />
              </div>

              {/* Reviewer */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Reviewer *
                </label>
                <Input
                  value={formData.reviewedBy}
                  onChange={(e) => updateField('reviewedBy', e.target.value)}
                  placeholder="Your name"
                  disabled={isPending}
                  data-testid="compliance-reviewer-input"
                />
              </div>
            </div>
            {/* Status description helper text */}
            {currentStatusDescription && formData.reviewStatus !== 'unreviewed' && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)] italic">
                {currentStatusDescription}
              </p>
            )}
          </div>

          {/* Justification Notes - for model training */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Justification for the model (will be shown with original text and your verdict)
            </label>
            <Textarea
              value={formData.justificationNotes ?? ''}
              onChange={(e) => updateField('justificationNotes', e.target.value || undefined)}
              rows={3}
              placeholder="e.g., 'This should not be flagged as severe - while it mentions in-person work, cardiovascular surgery must always be performed in person.' or 'Excellent example of outdated technology - requires CD-ROM submission with no alternative for a mandatory process.'"
              disabled={isPending}
              data-testid="compliance-justification-textarea"
            />
          </div>

          {/* Team Notes - for developers */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Notes for Development Team
            </label>
            <Textarea
              value={formData.teamNotes ?? ''}
              onChange={(e) => updateField('teamNotes', e.target.value || undefined)}
              rows={2}
              placeholder="Process notes, research tasks, questions..."
              disabled={isPending}
              data-testid="compliance-team-notes-textarea"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isPending}
              disabled={isPending || !formData.reviewedBy.trim()}
              data-testid="compliance-save-button"
            >
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
