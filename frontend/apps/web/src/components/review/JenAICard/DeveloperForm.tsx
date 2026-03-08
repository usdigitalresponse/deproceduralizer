'use client';

import { useState, useTransition } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { Button, Textarea, Select } from '@/components/ui';
import { CornellLink, ConfirmDialog } from '../shared';
import { DEVELOPER_STATUSES, RESOLUTION_TYPES, DEVELOPERS } from '@/types/regulation';
import { updateJenAIDeveloper, resetJenAIIssue } from '@/lib/actions/jenai';
import type { DeveloperFormProps } from './types';

export function DeveloperForm({ issue, onUpdated, onCleared, state = 'ny' }: DeveloperFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [formData, setFormData] = useState({
    developerStatus: issue.developerStatus ?? 'unresolved',
    developerAssigned: issue.developerAssigned ?? '',
    developerNotes: issue.developerNotes ?? '',
    resolutionType: issue.resolutionType ?? '',
    resolutionComments: issue.resolutionComments ?? '',
    developerQuestion: issue.developerQuestion ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.developerAssigned) {
      setError('Developer is required');
      return;
    }

    startTransition(async () => {
      const result = await updateJenAIDeveloper({
        id: issue.id,
        developerStatus: formData.developerStatus,
        developerAssigned: formData.developerAssigned,
        developerNotes: formData.developerNotes || undefined,
        resolutionType: formData.resolutionType || undefined,
        resolutionComments: formData.resolutionComments || undefined,
        developerQuestion: formData.developerQuestion || undefined,
      });

      if (result.success) {
        onUpdated({
          ...issue,
          developerStatus: formData.developerStatus,
          developerAssigned: formData.developerAssigned,
          developerNotes: formData.developerNotes || null,
          resolutionType: formData.resolutionType || null,
          resolutionComments: formData.resolutionComments || null,
          developerQuestion: formData.developerQuestion || null,
          developerCheckedAt: new Date(),
        });
      } else {
        setError(result.error);
      }
    });
  };

  const handleClearEntry = () => {
    setError(null);
    startTransition(async () => {
      const result = await resetJenAIIssue(issue.id);
      if (result.success) {
        setShowClearConfirm(false);
        if (onCleared) {
          onCleared(issue.id);
        } else {
          onUpdated({
            ...issue,
            reviewStatus: 'unreviewed',
            reviewedBy: null,
            reviewedAt: null,
            justificationNotes: null,
            teamNotes: null,
            impactType: null,
            developerStatus: 'unresolved',
            developerAssigned: null,
            developerNotes: null,
            resolutionType: null,
            resolutionComments: null,
            developerQuestion: null,
            developerCheckedAt: null,
          });
        }
      } else {
        setError(result.error);
        setShowClearConfirm(false);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="pt-4 border-t border-[var(--color-neutral-200)]">
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear Entry and Return to Review?"
          description="This will clear all review data and developer notes. The item will return to the unreviewed queue."
          confirmLabel="Clear Entry"
          confirmingLabel="Clearing..."
          isPending={isPending}
          onConfirm={handleClearEntry}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

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
            options={DEVELOPERS}
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
            options={DEVELOPER_STATUSES}
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
              options={RESOLUTION_TYPES}
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
          placeholder="Internal notes about this issue..."
          disabled={isPending}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {issue.sourceType === 'guidance' && issue.guidance ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/${state.toLowerCase()}/guidance/${issue.guidance!.id}`, '_blank')}
              >
                View Guidance Page
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <CornellLink url={issue.guidance.url} />
            </>
          ) : issue.regulation ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/${state.toLowerCase()}/regulations/${issue.regulation!.id}`, '_blank')}
              >
                View Regulation Page
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <CornellLink url={issue.regulation.url} />
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            disabled={isPending}
            className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear & Return
          </Button>
        </div>
        <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
