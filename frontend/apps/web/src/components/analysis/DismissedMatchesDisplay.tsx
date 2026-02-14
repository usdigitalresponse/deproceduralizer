'use client';

import type { DismissedMatch } from '@deproceduralizer/database';

interface DismissedMatchesDisplayProps {
  dismissedMatches: DismissedMatch[] | null;
}

export function DismissedMatchesDisplay({
  dismissedMatches,
}: DismissedMatchesDisplayProps) {
  if (!dismissedMatches || dismissedMatches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-[var(--color-text-muted)]">
        Dismissed Matches ({dismissedMatches.length})
      </h5>
      <div className="space-y-2">
        {dismissedMatches.map((match, index) => (
          <div
            key={index}
            className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-2"
          >
            <div className="text-xs text-[var(--color-text-muted)] mb-1">
              Match #{match.matchId}
            </div>
            {match.text && (
              <p className="text-sm text-[var(--color-text-secondary)] mb-1 line-clamp-2">
                &quot;{match.text}&quot;
              </p>
            )}
            <p className="text-xs text-[var(--color-danger)]">
              Reason: {match.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DismissedMatchesDisplay;
