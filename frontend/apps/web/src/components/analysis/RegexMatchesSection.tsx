'use client';

import { useState } from 'react';
import type { ComplianceIssue, DismissedMatch } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { highlightRegexPattern } from '@/lib/utils/highlight';
import { usePrintMode } from './PrintModeContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface RegexMatchesSectionProps {
  matches: ComplianceIssue[];
  relevantMatchIds: number[];
  dismissedReasons: DismissedMatch[];
  /** If true, section is collapsible (collapsed by default in standard view, expanded in print mode) */
  collapsible?: boolean;
}

/**
 * RegexMatchesSection - Display original regex matches
 *
 * Shows all regex matches that triggered analysis, with:
 * - Match number
 * - Status badge (Relevant or Dismissed with reason)
 * - Pattern that triggered the match
 * - ~600 char context with match text
 *
 * When collapsible=true, the section is collapsed by default in standard view
 * but always expanded in print mode.
 */
export function RegexMatchesSection({
  matches,
  relevantMatchIds,
  dismissedReasons,
  collapsible = false,
}: RegexMatchesSectionProps) {
  const { isPrintMode } = usePrintMode();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!matches || matches.length === 0) {
    return null;
  }

  // In print mode or when not collapsible, always show expanded
  const showContent = isPrintMode || !collapsible || isExpanded;

  // Create a map of dismissed reasons by match ID for quick lookup
  const dismissedReasonsMap = new Map<number, DismissedMatch>();
  for (const dismissed of dismissedReasons) {
    dismissedReasonsMap.set(dismissed.matchId, dismissed);
  }

  const relevantSet = new Set(relevantMatchIds);

  const relevantCount = matches.filter(m => relevantSet.has(m.id)).length;
  const dismissedCount = matches.length - relevantCount;

  return (
    <div className="space-y-4">
      {/* Header - clickable when collapsible */}
      <div
        className={`flex items-center gap-3 border-b border-[var(--color-neutral-200)] pb-3 ${
          collapsible && !isPrintMode ? 'cursor-pointer hover:bg-[var(--color-neutral-50)] -mx-2 px-2 rounded transition-colors' : ''
        }`}
        onClick={collapsible && !isPrintMode ? () => setIsExpanded(!isExpanded) : undefined}
      >
        {/* Chevron for collapsible mode */}
        {collapsible && !isPrintMode && (
          <span className="text-[var(--color-text-muted)]">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </span>
        )}
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          Original Regex Matches
        </h3>
        <span className="text-sm text-[var(--color-text-muted)]">
          ({matches.length} total: {relevantCount} relevant, {dismissedCount} dismissed)
        </span>
      </div>

      {/* Content - shown based on expand state */}
      {showContent && (
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
      )}
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
            match.regexMatchContext,
            match.regexMatchPattern
          )}
        </p>
      </div>
    </div>
  );
}

export default RegexMatchesSection;
