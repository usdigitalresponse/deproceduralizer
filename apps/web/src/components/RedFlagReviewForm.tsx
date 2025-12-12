'use client';

import { useState, useTransition, useEffect } from 'react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { RedFlag, REVIEW_STATUSES, IMPACT_TYPES, PRIORITY_OPTIONS } from '@/types/regulation';
import { useReviewerName } from '@/hooks/useReviewerName';

interface RedFlagReviewFormProps {
  flag: RedFlag;
  onUpdated: (updatedFlag: {
    id: number;
    review_status?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    reviewer_notes?: string;
    priority?: number;
    impact_type?: string;
  }) => void;
}

export default function RedFlagReviewForm({ flag, onUpdated }: RedFlagReviewFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reviewerName: storedName, saveReviewerName, isLoaded } = useReviewerName();

  const [formData, setFormData] = useState({
    reviewStatus: flag.review_status || 'unreviewed',
    reviewedBy: flag.reviewed_by || '',
    reviewerNotes: flag.reviewer_notes || '',
    priority: flag.priority || undefined,
    impactType: flag.impact_type || '',
  });

  // Pre-fill reviewer name from localStorage
  useEffect(() => {
    if (isLoaded && storedName && !formData.reviewedBy) {
      setFormData(prev => ({ ...prev, reviewedBy: storedName }));
    }
  }, [isLoaded, storedName, formData.reviewedBy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!flag.id) {
      setError('Flag ID is missing');
      return;
    }

    if (!formData.reviewedBy.trim()) {
      setError('Reviewer name is required');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateRedFlagReview({
          id: flag.id!,
          reviewStatus: formData.reviewStatus,
          reviewedBy: formData.reviewedBy,
          reviewerNotes: formData.reviewerNotes || undefined,
          priority: formData.priority,
          impactType: formData.impactType || undefined,
        });

        // Save reviewer name for next time
        saveReviewerName(formData.reviewedBy);

        onUpdated({
          id: flag.id!,
          review_status: result.reviewStatus ?? undefined,
          reviewed_by: result.reviewedBy ?? undefined,
          reviewed_at: result.reviewedAt?.toISOString(),
          reviewer_notes: result.reviewerNotes ?? undefined,
          priority: result.priority ?? undefined,
          impact_type: result.impactType ?? undefined,
        });

        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update review');
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="mt-3 pt-3 border-t border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              flag.review_status === 'confirmed' ? 'bg-green-100 text-green-800' :
              flag.review_status === 'false_positive' ? 'bg-gray-100 text-gray-800' :
              flag.review_status === 'needs_context' ? 'bg-yellow-100 text-yellow-800' :
              flag.review_status === 'deferred' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-600'
            }`}>
              {REVIEW_STATUSES.find(s => s.value === flag.review_status)?.label || 'Unreviewed'}
            </span>
            {flag.priority && (
              <span className="text-gray-600">
                Priority: {PRIORITY_OPTIONS.find(p => p.value === flag.priority)?.label}
              </span>
            )}
            {flag.reviewed_by && (
              <span className="text-gray-500">
                Reviewed by {flag.reviewed_by}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {flag.review_status === 'unreviewed' ? 'Review' : 'Edit Review'}
          </button>
        </div>
        {flag.reviewer_notes && (
          <p className="mt-2 text-sm text-gray-600 italic">
            Notes: {flag.reviewer_notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-red-200 space-y-3">
      {error && (
        <div className="p-2 bg-red-100 border border-red-300 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Review Status *
          </label>
          <select
            value={formData.reviewStatus}
            onChange={(e) => setFormData(prev => ({ ...prev, reviewStatus: e.target.value }))}
            className="w-full px-2 py-1 border rounded text-sm"
            disabled={isPending}
          >
            {REVIEW_STATUSES.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Reviewer Name *
          </label>
          <input
            type="text"
            value={formData.reviewedBy}
            onChange={(e) => setFormData(prev => ({ ...prev, reviewedBy: e.target.value }))}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder="Your name"
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={formData.priority || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              priority: e.target.value ? parseInt(e.target.value) : undefined
            }))}
            className="w-full px-2 py-1 border rounded text-sm"
            disabled={isPending}
          >
            <option value="">Select priority...</option>
            {PRIORITY_OPTIONS.map(priority => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Impact Type
          </label>
          <select
            value={formData.impactType}
            onChange={(e) => setFormData(prev => ({ ...prev, impactType: e.target.value }))}
            className="w-full px-2 py-1 border rounded text-sm"
            disabled={isPending}
          >
            <option value="">Select impact type...</option>
            {IMPACT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Reviewer Notes
        </label>
        <textarea
          value={formData.reviewerNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, reviewerNotes: e.target.value }))}
          className="w-full px-2 py-1 border rounded text-sm"
          rows={2}
          placeholder="Add any notes about this flag..."
          disabled={isPending}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save Review'}
        </button>
      </div>
    </form>
  );
}
