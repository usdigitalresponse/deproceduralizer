import { ConfirmDialog } from '../shared';
import type { ClearConfirmDialogProps } from './types';

export function ClearConfirmDialog({ item, isPending, onConfirm, onCancel }: ClearConfirmDialogProps) {
  const severityRestore = item.type === 'compliance_issue'
    && item.complianceIssueData?.originalSeverity
    && item.complianceIssueData.severity !== item.complianceIssueData.originalSeverity;

  return (
    <ConfirmDialog
      title="Clear Entry and Return to Review?"
      description="This will clear all review data and developer notes. The item will return to the unreviewed queue."
      confirmLabel="Clear Entry"
      confirmingLabel="Clearing..."
      isPending={isPending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {severityRestore && (
        <p className="text-sm text-[var(--color-warning)] mb-4">
          Severity will be restored from {item.complianceIssueData!.severity} to {item.complianceIssueData!.originalSeverity}.
        </p>
      )}
    </ConfirmDialog>
  );
}
