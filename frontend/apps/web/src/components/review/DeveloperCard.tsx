'use client';

import { useState, useTransition, useEffect, forwardRef } from 'react';
import { updateDeveloperStatus, type DeveloperItem } from '@/lib/actions/developer';
import { useDeveloperName } from '@/hooks/useDeveloperName';
import { Button, Textarea, Badge, SeverityBadge, Select, Tag, CopyLinkButton } from '@/components/ui';
import { DEVELOPER_STATUSES, RESOLUTION_TYPES, DEVELOPERS, DEVELOPER_STATUS_LABELS, ISSUE_TYPE_LABELS, formatLabel } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { ExpandableRegulationQuote } from './ExpandableRegulationQuote';
import { CardWrapper } from './shared';
import { Flag, FileWarning } from 'lucide-react';

interface DeveloperCardProps {
  item: DeveloperItem;
  onUpdated: (updatedItem: DeveloperItem) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const DeveloperCard = forwardRef<HTMLDivElement, DeveloperCardProps>(
  ({ item, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { developerName: storedName, saveDeveloperName, isLoaded } = useDeveloperName();

    const [formData, setFormData] = useState({
      developerStatus: item.developerStatus || 'unresolved',
      developerAssigned: item.developerAssigned || '',
      developerNotes: item.developerNotes || '',
      resolutionType: item.resolutionType || '',
      resolutionComments: item.resolutionComments || '',
      developerQuestion: item.developerQuestion || '',
    });

    // Pre-fill developer name from localStorage
    useEffect(() => {
      if (isLoaded && storedName && !formData.developerAssigned) {
        setFormData((prev) => ({ ...prev, developerAssigned: storedName }));
      }
    }, [isLoaded, storedName, formData.developerAssigned]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!formData.developerAssigned) {
        setError('Developer assignment is required');
        return;
      }

      startTransition(async () => {
        try {
          await updateDeveloperStatus({
            type: item.type,
            id: item.id,
            developerStatus: formData.developerStatus,
            developerAssigned: formData.developerAssigned,
            developerNotes: formData.developerNotes || undefined,
            resolutionType: formData.resolutionType || undefined,
            resolutionComments: formData.resolutionComments || undefined,
            developerQuestion: formData.developerQuestion || undefined,
          });

          // Save developer name for next time
          if (formData.developerAssigned === 'Michael' || formData.developerAssigned === 'Abigail') {
            saveDeveloperName(formData.developerAssigned);
          }

          // Update parent with new data
          onUpdated({
            ...item,
            developerStatus: formData.developerStatus,
            developerAssigned: formData.developerAssigned,
            developerNotes: formData.developerNotes || null,
            resolutionType: formData.resolutionType || null,
            resolutionComments: formData.resolutionComments || null,
            developerQuestion: formData.developerQuestion || null,
            developerCheckedAt: new Date(),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update developer status');
        }
      });
    };

    // Get status color for badge
    const getStatusVariant = (status: string | null) => {
      switch (status) {
        case 'resolved':
          return 'success';
        case 'pending':
          return 'warning';
        case 'backlogged':
          return 'default';
        case 'need_more_info':
          return 'info';
        case 'unresolved':
        default:
          return 'danger';
      }
    };

    // Render type-specific content
    const renderItemContent = () => {
      if (item.type === 'red_flag' && item.redFlagData) {
        const flag = item.redFlagData;
        const nycrrCitation = formatNycrrCitation(
          flag.regulation.nycrrTitle,
          flag.regulation.nycrrPart,
          flag.regulation.nycrrSection
        );

        return (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-[var(--color-text)]">{formatLabel(flag.category)}</span>
              <SeverityBadge severity={flag.severity} />
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mb-2">
              {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
              {nycrrCitation && flag.regulation.title && ' - '}
              <span className="text-[var(--color-text-secondary)]">{flag.regulation.title}</span>
            </div>
            <ExpandableRegulationQuote
              text={flag.explanation}
              label="Why Flagged"
              documentId={flag.regulation.id}
              variant="default"
            />
          </>
        );
      }

      if (item.type === 'compliance_issue' && item.complianceIssueData) {
        const issue = item.complianceIssueData;
        const nycrrCitation = issue.state === 'NY'
          ? formatNycrrCitation(
              issue.regulation.nycrrTitle,
              issue.regulation.nycrrPart,
              issue.regulation.nycrrSection
            )
          : null;

        return (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="warning">{ISSUE_TYPE_LABELS[issue.issueType] || formatLabel(issue.issueType)}</Badge>
              {issue.llmConfirmed && <Badge variant="success">LLM Confirmed</Badge>}
            </div>
            <div className="text-sm text-[var(--color-text-muted)] mb-2">
              {nycrrCitation && <span className="font-mono">{nycrrCitation}</span>}
              {nycrrCitation && issue.regulation.title && ' - '}
              <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
            </div>
            {issue.termMatched && (
              <div className="mb-2">
                <Tag variant="primary" size="sm">{issue.termMatched}</Tag>
              </div>
            )}
            <ExpandableRegulationQuote
              text={issue.requirementQuote}
              label="Regulation Text"
              documentId={issue.regulation.id}
              highlightTerm={issue.termMatched}
              variant="warning"
            />
          </>
        );
      }

      return null;
    };

    const developerOptions = [...DEVELOPERS];
    const statusOptions = [...DEVELOPER_STATUSES];
    const resolutionOptions = [...RESOLUTION_TYPES];

    const anchor = item.type === 'red_flag' ? `flag-${item.id}` : `compliance-${item.id}`;

    return (
      <CardWrapper
        ref={ref}
        id={anchor}
        isFocused={isFocused}
      >
        {/* Header with type badge and developer status */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <CopyLinkButton anchor={anchor} />
            {item.type === 'red_flag' ? (
              <Badge variant="danger" className="flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Red Flag
              </Badge>
            ) : (
              <Badge variant="warning" className="flex items-center gap-1">
                <FileWarning className="w-3 h-3" />
                Compliance Issue
              </Badge>
            )}
            <Badge variant={getStatusVariant(item.developerStatus)}>
              {DEVELOPER_STATUS_LABELS[item.developerStatus || 'unresolved']}
            </Badge>
          </div>
          {item.developerAssigned && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Assigned: {item.developerAssigned}
            </span>
          )}
        </div>

        {/* Item content */}
        <div className="mb-4">
          {renderItemContent()}
        </div>

        {/* Review info (read-only summary) */}
        <div className="mb-4 p-3 bg-[var(--color-primary-weaker)] rounded-[var(--radius-md)]">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Review Summary</div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-[var(--color-text-muted)]">Status: </span>
              <span className="text-[var(--color-text)]">{formatLabel(item.reviewStatus || 'unreviewed')}</span>
            </div>
            {item.reviewedBy && (
              <div>
                <span className="text-[var(--color-text-muted)]">By: </span>
                <span className="text-[var(--color-text)]">{item.reviewedBy}</span>
              </div>
            )}
          </div>
          {item.reviewerNotes && (
            <div className="mt-2 text-sm text-[var(--color-text)]">
              {item.reviewerNotes}
            </div>
          )}
        </div>

        {/* Developer form */}
        <form onSubmit={handleSubmit} className="pt-4 border-t border-[var(--color-neutral-200)]">
          {error && (
            <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {/* Developer */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Developer *
              </label>
              <Select
                value={formData.developerAssigned || undefined}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, developerAssigned: value }))}
                options={developerOptions}
                placeholder="Select developer"
                disabled={isPending}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Status *
              </label>
              <Select
                value={formData.developerStatus}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, developerStatus: value }))}
                options={statusOptions}
                disabled={isPending}
              />
            </div>

            {/* Resolution Type (shown when resolved) */}
            {formData.developerStatus === 'resolved' && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Resolution
                </label>
                <Select
                  value={formData.resolutionType || undefined}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, resolutionType: value }))}
                  options={resolutionOptions}
                  placeholder="--"
                  disabled={isPending}
                />
              </div>
            )}
          </div>

          {/* Resolution Comments (shown when resolved) */}
          {formData.developerStatus === 'resolved' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Resolution Comments
              </label>
              <Textarea
                value={formData.resolutionComments}
                onChange={(e) => setFormData((prev) => ({ ...prev, resolutionComments: e.target.value }))}
                rows={2}
                placeholder="Describe what was done or why not implemented..."
                disabled={isPending}
              />
            </div>
          )}

          {/* Question for Reviewer (shown when need_more_info) */}
          {formData.developerStatus === 'need_more_info' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Question for Reviewer
              </label>
              <Textarea
                value={formData.developerQuestion}
                onChange={(e) => setFormData((prev) => ({ ...prev, developerQuestion: e.target.value }))}
                rows={2}
                placeholder="What information do you need from the reviewer?"
                disabled={isPending}
              />
            </div>
          )}

          {/* Developer Notes */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Developer Notes
            </label>
            <Textarea
              value={formData.developerNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, developerNotes: e.target.value }))}
              rows={2}
              placeholder="Internal notes about this item..."
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onViewRegulation(item.regulation.id)}
            >
              View Regulation
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </CardWrapper>
    );
  }
);

DeveloperCard.displayName = 'DeveloperCard';

export default DeveloperCard;
