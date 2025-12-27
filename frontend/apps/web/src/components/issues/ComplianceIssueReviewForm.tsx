'use client';

import type { ComplianceIssue } from '@deproceduralizer/database';
import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import { ReviewForm } from '@/components/review';
import type { ReviewFormCallbackData } from '@/hooks';

interface ComplianceIssueReviewFormProps {
  issue: ComplianceIssue;
  onUpdated: (updatedIssue: ReviewFormCallbackData) => void;
}

/**
 * Review form for compliance issues.
 * Uses the shared ReviewForm component with compliance issue-specific styling and API.
 */
export default function ComplianceIssueReviewForm({ issue, onUpdated }: ComplianceIssueReviewFormProps) {
  return (
    <ReviewForm
      itemType="compliance_issue"
      item={issue}
      onUpdated={onUpdated}
      onSubmit={async (data) => {
        return updateComplianceIssueReview({
          id: data.id,
          reviewStatus: data.reviewStatus,
          reviewedBy: data.reviewedBy,
          justificationNotes: data.justificationNotes,
          teamNotes: data.teamNotes,
          severity: data.severity,
          impactType: data.impactType,
        });
      }}
    />
  );
}
