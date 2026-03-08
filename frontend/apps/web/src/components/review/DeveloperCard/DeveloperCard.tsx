'use client';

import { useState, useTransition, forwardRef } from 'react';
import { FileWarning } from 'lucide-react';
import { updateDeveloperStatus, clearEntryForReview } from '@/lib/actions/developer';
import { Badge, CopyLinkButton } from '@/components/ui';
import { DEVELOPER_STATUS_LABELS } from '@/types/regulation';
import { CardWrapper, HierarchyTreeView } from '../shared';
import { useDeveloperCardForm } from './hooks/useDeveloperCardForm';
import { getStatusVariant } from './helpers';
import { ReviewSummary } from './ReviewSummary';
import { ComplianceIssueContent } from './ItemContent';
import { DeveloperForm } from './DeveloperForm';
import { ClearConfirmDialog } from './ClearConfirmDialog';
import type { DeveloperCardProps } from './types';

export const DeveloperCard = forwardRef<HTMLDivElement, DeveloperCardProps>(
  ({ item, onUpdated, onCleared, onViewRegulation, isFocused = false, state = 'ny' }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [isClearPending, startClearTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const { formData, setFormData, saveDeveloperName } = useDeveloperCardForm(item);

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

    const handleClearEntry = () => {
      setError(null);
      startClearTransition(async () => {
        try {
          const result = await clearEntryForReview({
            type: item.type,
            id: item.id,
          });

          if (!result.success) {
            setError(result.error || 'Failed to clear entry');
            return;
          }

          if (onCleared) {
            onCleared(item.id, item.type);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to clear entry');
        } finally {
          setShowClearConfirm(false);
        }
      });
    };

    const anchor = `compliance-${item.id}`;

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
            <Badge variant="warning" className="flex items-center gap-1">
              <FileWarning className="w-3 h-3" />
              Compliance Issue
            </Badge>
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
          <ComplianceIssueContent item={item} state={state} />
        </div>

        {/* Review info (read-only summary) */}
        <ReviewSummary item={item} />

        {/* Hierarchy Tree View (only for regulation-sourced items) */}
        {item.regulation.id !== 0 && (
          <HierarchyTreeView
            documentId={item.regulation.id}
            state={state}
          />
        )}

        {/* Developer form */}
        <DeveloperForm
          item={item}
          formData={formData}
          setFormData={setFormData}
          isPending={isPending}
          error={error}
          onSubmit={handleSubmit}
          state={state}
          onShowClearConfirm={() => setShowClearConfirm(true)}
        />

        {/* Clear Confirmation Dialog */}
        {showClearConfirm && (
          <ClearConfirmDialog
            item={item}
            isPending={isClearPending}
            onConfirm={handleClearEntry}
            onCancel={() => setShowClearConfirm(false)}
          />
        )}
      </CardWrapper>
    );
  }
);

DeveloperCard.displayName = 'DeveloperCard';
