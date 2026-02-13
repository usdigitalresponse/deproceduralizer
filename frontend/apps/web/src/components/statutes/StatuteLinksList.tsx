'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Scale, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LINK_TYPE_LABELS, MATCH_STATUS_LABELS } from '@/lib/constants/values';
import type { RegulationStatuteLinkWithStatute } from '@deproceduralizer/database';

interface StatuteLinksListProps {
  /** Non-enabling-authority statute links */
  links: RegulationStatuteLinkWithStatute[];
  /** State code for constructing links */
  state: string;
  /** Whether the list starts collapsed */
  initialCollapsed?: boolean;
}

/** Map match status to badge variant */
function getMatchStatusVariant(status: string): 'success' | 'info' | 'warning' | 'default' {
  switch (status) {
    case 'matched':
      return 'success';
    case 'corrected':
      return 'info';
    case 'unmatched':
      return 'warning';
    case 'obsolete':
      return 'default';
    default:
      return 'default';
  }
}

/** Group links by link type */
function groupByLinkType(
  links: RegulationStatuteLinkWithStatute[]
): Record<string, RegulationStatuteLinkWithStatute[]> {
  const groups: Record<string, RegulationStatuteLinkWithStatute[]> = {};
  for (const link of links) {
    const type = link.linkType;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(link);
  }
  return groups;
}

/**
 * Collapsible card showing non-enabling-authority statute links,
 * grouped by link type (requirement, definition, reference).
 */
export function StatuteLinksList({
  links,
  state,
  initialCollapsed = false,
}: StatuteLinksListProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  if (links.length === 0) return null;

  const grouped = groupByLinkType(links);
  const groupOrder = ['requirement', 'definition', 'reference'];
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const aIdx = groupOrder.indexOf(a);
    const bIdx = groupOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return (
    <div>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
        <Scale className="w-4 h-4 text-[var(--color-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Statute Links ({links.length})
        </h3>
      </button>

      {!isCollapsed && (
        <div className="space-y-4">
          {sortedTypes.map((type) => (
            <div key={type}>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                {LINK_TYPE_LABELS[type] || type} ({grouped[type].length})
              </h4>
              <div className="space-y-2">
                {grouped[type].map((link) => (
                  <div
                    key={link.linkId}
                    className="text-sm pl-2 border-l-2 border-[var(--color-neutral-200)]"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {link.statute?.id ? (
                        <Link
                          href={`/${state}/statutes/${link.statute.id}`}
                          className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] font-medium"
                        >
                          {link.citation}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text)] font-medium">
                          {link.citation}
                        </span>
                      )}
                      <Badge variant={getMatchStatusVariant(link.matchStatus)}>
                        {MATCH_STATUS_LABELS[link.matchStatus] || link.matchStatus}
                      </Badge>
                    </div>
                    {link.statute?.title && (
                      <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                        {link.statute.title}
                      </p>
                    )}
                    {link.context && (
                      <p className="text-[var(--color-text-secondary)] text-xs mt-1 italic">
                        {link.context}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StatuteLinksList;
