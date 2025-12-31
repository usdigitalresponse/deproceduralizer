'use client';

import { forwardRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { useReviewForm } from '@/hooks';
import { Button, Input, Textarea, Badge, SeverityBadge, Select, Tag, CopyLinkButton } from '@/components/ui';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { PRIORITY_OPTIONS, IMPACT_TYPES, getComplexityVariant, formatLabel } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { CardWrapper, HierarchyBreadcrumbsInline, CornellLink, RegulationTextViewer, HierarchyTreeView } from './shared';
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, REVIEW_STATUS_DESCRIPTIONS, type ReviewStatus } from '@deproceduralizer/database/schema';
import type { RedFlagWithContext } from '@deproceduralizer/database';

interface ReviewCardProps {
  flag: RedFlagWithContext;
  onUpdated: (updatedFlag: RedFlagWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
  /** State code for hierarchy links */
  state?: string;
}

export const ReviewCard = forwardRef<HTMLDivElement, ReviewCardProps>(
  ({ flag, onUpdated, onViewRegulation, isFocused = false, state = 'ny' }, ref) => {
    // Use shared review form hook for state management
    const {
      formData,
      updateField,
      isPending,
      error,
      handleSubmit,
    } = useReviewForm({
      initialData: flag,
      onSubmit: async (data) => updateRedFlagReview({
        id: data.id,
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        justificationNotes: data.justificationNotes,
        teamNotes: data.teamNotes,
        priority: data.priority,
        impactType: data.impactType,
      }),
      onUpdated: (data) => {
        onUpdated({
          ...flag,
          reviewStatus: data.reviewStatus ?? null,
          reviewedBy: data.reviewedBy ?? null,
          reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
          justificationNotes: data.justificationNotes ?? null,
          teamNotes: data.teamNotes ?? null,
          priority: data.priority ?? null,
          impactType: data.impactType ?? null,
        });
      },
    });

    const nycrrCitation = formatNycrrCitation(
      flag.regulation.nycrrTitle,
      flag.regulation.nycrrPart,
      flag.regulation.nycrrSection
    );

    // Convert options to Select format with explicit "none" sentinel
    const priorityOptions = [{ value: 'none', label: '--' }, ...PRIORITY_OPTIONS];
    const impactOptions = [{ value: 'none', label: '--' }, ...IMPACT_TYPES];

    // Convert REVIEW_STATUSES to Select format with labels
    const statusOptions = REVIEW_STATUSES.map((status) => ({
      value: status,
      label: REVIEW_STATUS_LABELS[status],
    }));

    // Get current status description for helper text
    const currentStatusDescription = REVIEW_STATUS_DESCRIPTIONS[formData.reviewStatus as ReviewStatus] || '';

    return (
      <CardWrapper
        ref={ref}
        id={`flag-${flag.id}`}
        isFocused={isFocused}
        data-testid="red-flag-card"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <CopyLinkButton anchor={`flag-${flag.id}`} />
            <span className="font-semibold text-[var(--color-text)]">{formatLabel(flag.category)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Severity:</span>
              <SeverityBadge severity={flag.severity} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">Complexity:</span>
              <Badge variant={getComplexityVariant(flag.complexity)}>
                {flag.complexity}
              </Badge>
            </div>
          </div>
        </div>

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
            {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
            {nycrrCitation && flag.regulation.title && ' - '}
          </span>
          <span className="text-[var(--color-text-secondary)]">{flag.regulation.title}</span>
        </div>

        {/* Explanation */}
        <div className="mb-4">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Why Flagged:</span>
          <p className="mt-1 text-sm text-[var(--color-text)]">{flag.explanation}</p>
        </div>

        {/* Matched phrases */}
        {flag.matchedPhrases && flag.matchedPhrases.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Matched phrases:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {flag.matchedPhrases.map((phrase, i) => (
                <Tag key={i} variant="primary" size="sm">
                  {phrase}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* Implementation approach */}
        {flag.implementationApproach && (
          <div className="mb-4 text-sm">
            <span className="font-medium text-[var(--color-text-secondary)]">Implementation:</span>
            <span className="ml-2 text-[var(--color-text)]">{flag.implementationApproach}</span>
          </div>
        )}

        {/* Full Regulation Text Viewer */}
        {(flag.regulation as unknown as { content?: string }).content && (
          <RegulationTextViewer
            content={(flag.regulation as unknown as { content: string }).content}
            documentId={flag.regulation.id}
            state={state}
            scrollToText={flag.explanation}
            highlightPattern={flag.matchedPhrases?.length ? flag.matchedPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : undefined}
            label="Show Regulation Text"
          />
        )}

        {/* Hierarchy Tree View */}
        <HierarchyTreeView
          documentId={flag.regulation.id}
          state={state}
        />

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
                  data-testid="red-flag-status-select"
                />
              </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Priority
              </label>
              <Select
                value={formData.priority?.toString() ?? 'none'}
                onValueChange={(value) => updateField('priority', value === 'none' ? undefined : parseInt(value))}
                options={priorityOptions}
                disabled={isPending}
                data-testid="red-flag-priority-select"
              />
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
                data-testid="red-flag-impact-select"
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
                data-testid="red-flag-reviewer-input"
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
              Justification and analysis for the model
            </label>
            <Textarea
              value={formData.justificationNotes ?? ''}
              onChange={(e) => updateField('justificationNotes', e.target.value || undefined)}
              rows={2}
              placeholder="Explain your reasoning for this classification..."
              disabled={isPending}
              data-testid="red-flag-justification-textarea"
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
              data-testid="red-flag-team-notes-textarea"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/${state.toLowerCase()}/regulations/${flag.regulation.id}`, '_blank')}
              >
                View Full Regulation Page
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <CornellLink url={flag.regulation.url} />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isPending}
              disabled={isPending || !formData.reviewedBy.trim()}
              data-testid="red-flag-save-button"
            >
              {isPending ? 'Saving...' : 'Save Review'}
            </Button>
          </div>
        </form>
      </CardWrapper>
    );
  }
);

ReviewCard.displayName = 'ReviewCard';

export default ReviewCard;
