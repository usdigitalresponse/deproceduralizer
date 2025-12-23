'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useReviewerName } from './useReviewerName';

export interface ReviewFormData {
  reviewStatus: string;
  reviewedBy: string;
  justificationNotes: string | undefined;
  teamNotes: string | undefined;
  priority: number | undefined;
  impactType: string | undefined;
}

export interface ReviewFormCallbackData {
  id: number;
  reviewStatus?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  justificationNotes?: string;
  teamNotes?: string;
  priority?: number;
  impactType?: string;
}

interface UseReviewFormOptions {
  initialData: {
    id: number;
    reviewStatus?: string | null;
    reviewedBy?: string | null;
    justificationNotes?: string | null;
    teamNotes?: string | null;
    priority?: number | null;
    impactType?: string | null;
  };
  onSubmit: (data: ReviewFormData & { id: number }) => Promise<{
    success: true;
    data: {
      reviewStatus?: string | null;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
      justificationNotes?: string | null;
      teamNotes?: string | null;
      priority?: number | null;
      impactType?: string | null;
    };
  } | { success: false; error: string }>;
  onUpdated: (data: ReviewFormCallbackData) => void;
}

/**
 * Shared hook for review form state and submission logic.
 * Used by RedFlagReviewForm and ComplianceIssueReviewForm.
 *
 * @example
 * const {
 *   formData, setFormData, isEditing, setIsEditing,
 *   isPending, error, handleSubmit
 * } = useReviewForm({
 *   initialData: flag,
 *   onSubmit: (data) => updateRedFlagReview(data),
 *   onUpdated,
 * });
 */
export function useReviewForm({ initialData, onSubmit, onUpdated }: UseReviewFormOptions) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

  const [formData, setFormData] = useState<ReviewFormData>({
    reviewStatus: initialData.reviewStatus || 'unreviewed',
    reviewedBy: initialData.reviewedBy || '',
    justificationNotes: initialData.justificationNotes || undefined,
    teamNotes: initialData.teamNotes || undefined,
    priority: initialData.priority || undefined,
    impactType: initialData.impactType || undefined,
  });

  // Pre-fill reviewer name from localStorage (runs once when storage loads)
  useEffect(() => {
    if (isLoaded && storedName && !formData.reviewedBy) {
      setFormData(prev => ({ ...prev, reviewedBy: storedName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, storedName]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!initialData.id) {
      setError('Item ID is missing');
      return;
    }

    if (!formData.reviewedBy.trim()) {
      setError('Reviewer name is required');
      return;
    }

    startTransition(async () => {
      try {
        const result = await onSubmit({
          id: initialData.id,
          reviewStatus: formData.reviewStatus,
          reviewedBy: formData.reviewedBy,
          justificationNotes: formData.justificationNotes || undefined,
          teamNotes: formData.teamNotes || undefined,
          priority: formData.priority,
          impactType: formData.impactType || undefined,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        // Save reviewer name for next time
        saveReviewerName(formData.reviewedBy);

        onUpdated({
          id: initialData.id,
          reviewStatus: result.data.reviewStatus ?? undefined,
          reviewedBy: result.data.reviewedBy ?? undefined,
          reviewedAt: result.data.reviewedAt?.toISOString(),
          justificationNotes: result.data.justificationNotes ?? undefined,
          teamNotes: result.data.teamNotes ?? undefined,
          priority: result.data.priority ?? undefined,
          impactType: result.data.impactType ?? undefined,
        });

        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update review');
      }
    });
  }, [formData, initialData.id, onSubmit, onUpdated, saveReviewerName]);

  const updateField = useCallback(<K extends keyof ReviewFormData>(
    field: K,
    value: ReviewFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    formData,
    setFormData,
    updateField,
    isEditing,
    setIsEditing,
    isPending,
    error,
    handleSubmit,
    storedName,
  };
}

export default useReviewForm;
