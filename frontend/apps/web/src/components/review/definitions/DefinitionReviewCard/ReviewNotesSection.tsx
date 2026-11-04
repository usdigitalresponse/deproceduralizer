import { Input, Textarea } from '@/components/ui';
import type { ReviewNotesSectionProps } from './types';

export function ReviewNotesSection({ formData, setFormData, hasChanges }: ReviewNotesSectionProps) {
  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="text-sm font-medium text-[var(--color-text)]">
          Justification and analysis <strong>for the model</strong> (compliance issues and Barrier) {hasChanges && <span className="text-[var(--color-danger)]">*</span>}
        </label>
        <Textarea
          value={formData.justificationNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, justificationNotes: e.target.value }))}
          rows={2}
          placeholder="Required if correcting or marking as false positive"
          data-testid="definition-justification-textarea"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[var(--color-text)]">
          Notes for Development Team
        </label>
        <Textarea
          value={formData.teamNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, teamNotes: e.target.value }))}
          rows={2}
          placeholder="Process notes, research tasks, questions..."
          data-testid="definition-team-notes-textarea"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[var(--color-text)]">
          Reviewer <span className="text-[var(--color-danger)]">*</span>
        </label>
        <Input
          value={formData.reviewerName}
          onChange={(e) => setFormData(prev => ({ ...prev, reviewerName: e.target.value }))}
          placeholder="Your name"
          data-testid="definition-reviewer-input"
        />
      </div>
    </div>
  );
}
