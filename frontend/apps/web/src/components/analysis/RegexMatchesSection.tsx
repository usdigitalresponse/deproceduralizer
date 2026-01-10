'use client';

import type { ComplianceIssue, DismissedMatch } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { highlightRegexPattern } from '@/lib/utils/highlight';

interface RegexMatchesSectionProps {
  matches: ComplianceIssue[];
  relevantMatchIds: number[];
  dismissedReasons: DismissedMatch[];
}

/**
 * RegexMatchesSection - Display original regex matches for print mode
 *
 * Shows all regex matches that triggered analysis, with:
 * - Match number
 * - Status badge (Relevant or Dismissed with reason)
 * - Pattern that triggered the match
 * - ~600 char context with match text
 */
export function RegexMatchesSection({
  matches,
  relevantMatchIds,
  dismissedReasons,
}: RegexMatchesSectionProps) {
  if (!matches || matches.length === 0) {
    return null;
  }

  // Create a map of dismissed reasons by match ID for quick lookup
  const dismissedReasonsMap = new Map<number, DismissedMatch>();
  for (const dismissed of dismissedReasons) {
    dismissedReasonsMap.set(dismissed.matchId, dismissed);
  }

  const relevantSet = new Set(relevantMatchIds);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-[var(--color-neutral-200)] pb-3">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          Original Regex Matches
        </h3>
        <span className="text-sm text-[var(--color-text-muted)]">
          ({matches.length} total)
        </span>
      </div>

      <div className="space-y-4">
        {matches.map((match, index) => {
          const isRelevant = relevantSet.has(match.id);
          const dismissedInfo = dismissedReasonsMap.get(match.id);

          return (
            <MatchCard
              key={match.id}
              match={match}
              index={index}
              isRelevant={isRelevant}
              dismissedReason={dismissedInfo?.reason}
            />
          );
        })}
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: ComplianceIssue;
  index: number;
  isRelevant: boolean;
  dismissedReason?: string;
}

function MatchCard({ match, index, isRelevant, dismissedReason }: MatchCardProps) {
  return (
    <div
      className={`
        border rounded-[var(--radius-md)] overflow-hidden
        ${isRelevant
          ? 'border-[var(--color-success)]/30 bg-[var(--color-success-bg)]/30'
          : 'border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)]'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/50 border-b border-[var(--color-neutral-200)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-text)]">
            Match #{index + 1}
          </span>
          {isRelevant ? (
            <Badge variant="success">
              Relevant
            </Badge>
          ) : (
            <Badge variant="default">
              Dismissed
            </Badge>
          )}
        </div>
        {match.regexMatchPattern && (
          <code className="text-xs bg-[var(--color-neutral-100)] px-2 py-1 rounded font-mono text-[var(--color-text-secondary)]">
            {match.regexMatchPattern}
          </code>
        )}
      </div>

      {/* Dismissed reason */}
      {!isRelevant && dismissedReason && (
        <div className="px-4 py-2 bg-[var(--color-neutral-100)] border-b border-[var(--color-neutral-200)]">
          <span className="text-xs text-[var(--color-text-muted)]">Dismissed: </span>
          <span className="text-xs text-[var(--color-text-secondary)] italic">
            {dismissedReason}
          </span>
        </div>
      )}

      {/* Context text */}
      <div className="px-4 py-3">
        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
          {highlightRegexPattern(
            match.regexMatchContext ?? match.matchedContext ?? '',
            match.regexMatchPattern ?? match.matchedPattern
          )}
        </p>
      </div>
    </div>
  );
}

export default RegexMatchesSection;
