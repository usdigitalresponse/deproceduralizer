'use client';

import { useState, useTransition, useEffect, forwardRef } from 'react';
import { updateDefinitionDeveloperStatus } from '@/lib/actions/definitions';
import { useDeveloperName } from '@/hooks/useDeveloperName';
import { Button, Textarea, Badge, Select, CopyLinkButton } from '@/components/ui';
import { DEVELOPER_STATUSES, RESOLUTION_TYPES, DEVELOPERS, DEVELOPER_STATUS_LABELS } from '@/types/regulation';
import { formatNycrrCitation, formatNjacCitation } from '@/lib/formatters';
import { ExpandableRegulationQuote } from '../ExpandableRegulationQuote';
import { CardWrapper } from '../shared';
import { BookOpen } from 'lucide-react';
import type { DefinitionWithContext, StateCode } from '@deproceduralizer/database';

interface DefinitionDeveloperCardProps {
  definition: DefinitionWithContext;
  state: StateCode;
  onUpdated: (updated: DefinitionWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const DefinitionDeveloperCard = forwardRef<HTMLDivElement, DefinitionDeveloperCardProps>(
  ({ definition, state, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { developerName: storedName, saveDeveloperName, isLoaded } = useDeveloperName();

    const [formData, setFormData] = useState({
      developerStatus: definition.developerStatus || 'unresolved',
      developerAssigned: definition.developerAssigned || '',
      developerNotes: definition.developerNotes || '',
      resolutionType: definition.resolutionType || '',
      resolutionComments: definition.resolutionComments || '',
      developerQuestion: definition.developerQuestion || '',
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
          const result = await updateDefinitionDeveloperStatus({
            id: definition.id,
            developerStatus: formData.developerStatus,
            developerAssigned: formData.developerAssigned,
            developerNotes: formData.developerNotes || undefined,
            resolutionType: formData.resolutionType || undefined,
            resolutionComments: formData.resolutionComments || undefined,
            developerQuestion: formData.developerQuestion || undefined,
          });

          if (!result.success) {
            setError(result.error);
            return;
          }

          // Save developer name for next time
          if (formData.developerAssigned === 'Michael' || formData.developerAssigned === 'Abigail') {
            saveDeveloperName(formData.developerAssigned);
          }

          // Update parent with new data
          onUpdated({
            ...definition,
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

    // Get review status color
    const getReviewStatusVariant = (status: string | null) => {
      switch (status) {
        case 'confirmed':
          return 'success';
        case 'corrected':
          return 'warning';
        case 'false_positive':
          return 'danger';
        default:
          return 'default';
      }
    };

    // Format citation based on state
    const getCitation = () => {
      if (!definition.regulation) return null;
      if (state === 'ny') {
        return formatNycrrCitation(
          definition.regulation.nycrrTitle,
          definition.regulation.nycrrPart,
          definition.regulation.nycrrSection
        );
      }
      return formatNjacCitation(
        definition.regulation.njacTitle,
        definition.regulation.njacChapter,
        definition.regulation.njacSubchapter
      );
    };

    const citation = getCitation();
    const developerOptions = [...DEVELOPERS];
    const statusOptions = [...DEVELOPER_STATUSES];
    const resolutionOptions = [...RESOLUTION_TYPES];
    const anchor = `definition-${definition.id}`;

    // Get the display definition text
    const displayDefinition = definition.isVerbatim
      ? definition.verbatimText
      : definition.rephrasedDefinition || definition.verbatimText;

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
            <Badge variant="info" className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Definition
            </Badge>
            <Badge variant={getStatusVariant(definition.developerStatus)}>
              {DEVELOPER_STATUS_LABELS[definition.developerStatus || 'unresolved']}
            </Badge>
          </div>
          {definition.developerAssigned && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Assigned: {definition.developerAssigned}
            </span>
          )}
        </div>

        {/* Definition content */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-[var(--color-text)] text-lg">
              {definition.term}
            </span>
            {definition.definitionType === 'abbreviation' && (
              <Badge variant="default">Abbreviation</Badge>
            )}
            {definition.isCrossReference && (
              <Badge variant="warning">Cross-ref</Badge>
            )}
          </div>
          <div className="text-sm text-[var(--color-text-muted)] mb-2">
            {citation && <span className="font-mono">{citation}</span>}
            {citation && definition.regulation?.title && ' - '}
            <span className="text-[var(--color-text-secondary)]">{definition.regulation?.title}</span>
          </div>
          {definition.scope && (
            <div className="text-xs text-[var(--color-text-muted)] mb-2">
              Scope: {definition.scope}
              {definition.scopeLevel && ` (${definition.scopeLevel})`}
            </div>
          )}
          <ExpandableRegulationQuote
            text={displayDefinition}
            label="Definition"
            documentId={definition.regulation?.id || 0}
            variant="default"
          />
        </div>

        {/* Review info (read-only summary) */}
        <div className="mb-4 p-3 bg-[var(--color-primary-weaker)] rounded-[var(--radius-md)]">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Review Summary</div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-[var(--color-text-muted)]">Status: </span>
              <Badge variant={getReviewStatusVariant(definition.reviewStatus)}>
                {definition.reviewStatus || 'unreviewed'}
              </Badge>
            </div>
            {definition.reviewerName && (
              <div>
                <span className="text-[var(--color-text-muted)]">By: </span>
                <span className="text-[var(--color-text)]">{definition.reviewerName}</span>
              </div>
            )}
          </div>
          {(definition.justificationNotes || definition.teamNotes) && (
            <div className="mt-2 text-sm text-[var(--color-text)] space-y-1">
              {definition.justificationNotes && (
                <p><span className="text-[var(--color-text-muted)]">Justification:</span> {definition.justificationNotes}</p>
              )}
              {definition.teamNotes && (
                <p><span className="text-[var(--color-text-muted)]">Team notes:</span> {definition.teamNotes}</p>
              )}
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
              placeholder="Internal notes about this definition..."
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => definition.regulation && onViewRegulation(definition.regulation.id)}
              disabled={!definition.regulation}
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

DefinitionDeveloperCard.displayName = 'DefinitionDeveloperCard';

export default DefinitionDeveloperCard;
