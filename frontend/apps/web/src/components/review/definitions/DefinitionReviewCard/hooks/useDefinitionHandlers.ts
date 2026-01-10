import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateDefinitionReview } from '@/lib/actions/definitions';
import type { DefinitionWithContext } from '@deproceduralizer/database';
import type { DefinitionFormData } from '../types';

interface UseDefinitionHandlersProps {
  definition: DefinitionWithContext;
  formData: DefinitionFormData;
  onUpdated: (updatedDefinition: DefinitionWithContext) => void;
  onReviewComplete?: (definitionId: number, status: 'confirmed' | 'corrected' | 'false_positive') => void;
  saveReviewerName: (name: string) => void;
}

export function useDefinitionHandlers({
  definition,
  formData,
  onUpdated,
  onReviewComplete,
  saveReviewerName,
}: UseDefinitionHandlersProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);

    if (!formData.reviewerName.trim()) {
      setError('Reviewer name is required');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateDefinitionReview(definition.id, {
          reviewStatus: 'confirmed',
          reviewerName: formData.reviewerName,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        saveReviewerName(formData.reviewerName);
        onUpdated({ ...definition, ...result.data });

        toast.success(`Definition confirmed`, {
          description: `"${definition.term}" reviewed`,
        });

        onReviewComplete?.(definition.id, 'confirmed');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to confirm');
      }
    });
  };

  const handleSaveCorrections = async () => {
    setError(null);

    if (!formData.reviewerName.trim()) {
      setError('Reviewer name is required');
      return;
    }

    if (!formData.justificationNotes.trim()) {
      setError('Please explain why you made this correction');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateDefinitionReview(definition.id, {
          reviewStatus: 'corrected',
          reviewerName: formData.reviewerName,
          justificationNotes: formData.justificationNotes,
          teamNotes: formData.teamNotes || undefined,
          term: formData.term,
          isVerbatimTextComplete: formData.isVerbatimTextComplete,
          verbatimText: formData.verbatimText,
          rephrasedDefinition: formData.rephrasedDefinition || null,
          scope: formData.scope || null,
          scopeLevel: formData.scopeLevel === 'none' ? null : formData.scopeLevel || null,
          scopeDocumentId: formData.scopeDocumentId ?? null,
          definitionType: formData.definitionType,
          isCrossReference: formData.isCrossReference,
          referenceCompleteness: formData.referenceCompleteness === 'none' ? null : formData.referenceCompleteness,
          referenceTarget: formData.referenceTarget === 'none' ? null : formData.referenceTarget,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        saveReviewerName(formData.reviewerName);
        onUpdated({ ...definition, ...result.data });

        toast.success(`Definition corrected`, {
          description: `"${definition.term}" updated and reviewed`,
        });

        onReviewComplete?.(definition.id, 'corrected');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save corrections');
      }
    });
  };

  const handleMarkFalsePositive = async () => {
    setError(null);

    if (!formData.reviewerName.trim()) {
      setError('Reviewer name is required');
      return;
    }

    if (!formData.justificationNotes.trim()) {
      setError('Please explain why this is not a definition');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateDefinitionReview(definition.id, {
          reviewStatus: 'false_positive',
          reviewerName: formData.reviewerName,
          justificationNotes: formData.justificationNotes,
          teamNotes: formData.teamNotes || undefined,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        saveReviewerName(formData.reviewerName);
        onUpdated({ ...definition, ...result.data });

        toast.success(`Marked as not a definition`, {
          description: `"${definition.term}" removed`,
        });

        onReviewComplete?.(definition.id, 'false_positive');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to mark as false positive');
      }
    });
  };

  return {
    isPending,
    error,
    handleConfirm,
    handleSaveCorrections,
    handleMarkFalsePositive,
  };
}
