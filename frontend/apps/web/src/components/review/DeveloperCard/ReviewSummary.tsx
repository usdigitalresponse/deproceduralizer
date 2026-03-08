'use client';

import { memo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatLabel } from '@/types/regulation';
import { getImpactLabel } from './helpers';
import type { ReviewSummaryProps } from './types';

export const ReviewSummary = memo(function ReviewSummary({ item }: ReviewSummaryProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Get type-specific fields
  const compliance = item.complianceIssueData;

  // Determine missing critical fields
  const missingCritical: string[] = [];
  if (!item.reviewedBy) missingCritical.push('Reviewer');
  if (!item.justificationNotes) missingCritical.push('Justification');

  // Check for severity changes (compliance only)
  const severityChanged = compliance && compliance.originalSeverity !== null &&
    compliance.originalSeverity !== compliance.severity;

  return (
    <div className="mb-4 p-3 bg-[var(--color-primary-weaker)] rounded-[var(--radius-md)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-[var(--color-text-secondary)]">Review Summary</div>
        {missingCritical.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
            <AlertCircle className="w-3 h-3" />
            Missing: {missingCritical.join(', ')}
          </div>
        )}
      </div>

      {/* Primary review info */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div>
          <span className="text-[var(--color-text-muted)]">Status: </span>
          <span className="text-[var(--color-text)]">{formatLabel(item.reviewStatus || 'unreviewed')}</span>
        </div>
        {item.reviewedBy ? (
          <div>
            <span className="text-[var(--color-text-muted)]">By: </span>
            <span className="text-[var(--color-text)]">{item.reviewedBy}</span>
          </div>
        ) : (
          <div className="text-[var(--color-text-muted)] italic">No reviewer</div>
        )}
        {item.reviewedAt && (
          <div>
            <span className="text-[var(--color-text-muted)]">Reviewed: </span>
            <span className="text-[var(--color-text)]">
              {new Date(item.reviewedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Compliance-specific fields */}
      {compliance && (
        <div className="flex items-center gap-4 text-sm flex-wrap mt-2">
          <div>
            <span className="text-[var(--color-text-muted)]">Severity: </span>
            <span className="text-[var(--color-text)]">{compliance.severity ?? 'Not set'}</span>
            {severityChanged && (
              <span className="ml-1 text-[var(--color-warning)] text-xs">
                (was {compliance.originalSeverity})
              </span>
            )}
          </div>
          {compliance.impactType && (
            <div>
              <span className="text-[var(--color-text-muted)]">Impact: </span>
              <span className="text-[var(--color-text)]">{getImpactLabel(compliance.impactType)}</span>
            </div>
          )}
        </div>
      )}

      {/* Justification - always show (critical) */}
      <div className="mt-2 text-sm">
        <span className="text-[var(--color-text-muted)]">Justification: </span>
        {item.justificationNotes ? (
          <span className="text-[var(--color-text)]">{item.justificationNotes}</span>
        ) : (
          <span className="text-[var(--color-text-muted)] italic">Not provided</span>
        )}
      </div>

      {/* Team notes - always show if present or if nothing else to show */}
      {(item.teamNotes || !item.justificationNotes) && (
        <div className="mt-1 text-sm">
          <span className="text-[var(--color-text-muted)]">Team Notes: </span>
          {item.teamNotes ? (
            <span className="text-[var(--color-text)]">{item.teamNotes}</span>
          ) : (
            <span className="text-[var(--color-text-muted)] italic">None</span>
          )}
        </div>
      )}

      {/* Collapsible additional details */}
      {(item.developerNotes || item.resolutionComments || item.developerQuestion) && (
        <div className="mt-2 border-t border-[var(--color-neutral-200)] pt-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDetails ? 'Hide' : 'Show'} developer details
          </button>
          {showDetails && (
            <div className="mt-2 space-y-1 text-sm">
              {item.developerNotes && (
                <p><span className="text-[var(--color-text-muted)]">Dev Notes:</span> {item.developerNotes}</p>
              )}
              {item.resolutionComments && (
                <p><span className="text-[var(--color-text-muted)]">Resolution:</span> {item.resolutionComments}</p>
              )}
              {item.developerQuestion && (
                <p><span className="text-[var(--color-text-muted)]">Question:</span> {item.developerQuestion}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
