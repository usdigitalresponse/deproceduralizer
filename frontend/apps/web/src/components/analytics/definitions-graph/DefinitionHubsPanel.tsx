'use client';

import Link from 'next/link';
import { ExternalLink, TrendingUp, Filter } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import type { DefinitionHub } from './types';

// Scope level colors
const SCOPE_COLORS: Record<string, string> = {
  section: 'var(--color-info)',
  part: 'var(--color-success)',
  chapter: 'var(--color-warning)',
  title: 'var(--color-danger)',
};

// Limit options for the dropdown
const LIMIT_OPTIONS = [
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

interface DefinitionHubsPanelProps {
  hubs: DefinitionHub[];
  state: string;
  isLoading?: boolean;
  /** Current limit value */
  limit?: number;
  /** Callback when limit changes */
  onLimitChange?: (limit: number) => void;
  /** Current title filter value */
  titleFilter?: string;
  /** Callback when title filter changes */
  onTitleFilterChange?: (title: string | undefined) => void;
  /** Available titles for filter dropdown */
  availableTitles?: string[];
}

// Use 'all' as placeholder value since Radix Select doesn't allow empty strings
const ALL_TITLES_VALUE = 'all';

export function DefinitionHubsPanel({
  hubs,
  state,
  isLoading = false,
  limit = 20,
  onLimitChange,
  titleFilter,
  onTitleFilterChange,
  availableTitles = [],
}: DefinitionHubsPanelProps) {
  // Build title options for dropdown
  const titleOptions = [
    { value: ALL_TITLES_VALUE, label: 'All Titles' },
    ...availableTitles.map(t => ({ value: t, label: `Title ${t}` })),
  ];

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h3 className="text-base font-semibold">Top Definitions</h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 w-32 bg-[var(--color-neutral-100)] rounded mb-1" />
              <div className="h-3 w-20 bg-[var(--color-neutral-100)] rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Find max occurrence for bar scaling
  const maxOccurrence = hubs.length > 0 ? Math.max(...hubs.map(h => h.occurrenceCount)) : 1;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h3 className="text-base font-semibold">Top Definitions</h3>
        </div>
      </div>

      {/* Filter Controls */}
      {(onLimitChange || onTitleFilterChange) && (
        <div className="flex flex-col sm:flex-row gap-2 mb-3 pb-3 border-b border-[var(--color-neutral-100)]">
          {onLimitChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Show:</label>
              <Select
                value={limit.toString()}
                onValueChange={(val) => onLimitChange(parseInt(val, 10))}
                options={LIMIT_OPTIONS}
                className="w-20"
              />
            </div>
          )}
          {onTitleFilterChange && availableTitles.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <Select
                value={titleFilter ?? ALL_TITLES_VALUE}
                onValueChange={(val) => onTitleFilterChange(val === ALL_TITLES_VALUE ? undefined : val)}
                options={titleOptions}
                className="flex-1 min-w-0"
              />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Most frequently used terms by document occurrence
      </p>

      {hubs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
          No definitions found{titleFilter ? ` in Title ${titleFilter}` : ''}.
        </p>
      ) : (
        <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {hubs.map((hub, index) => {
            const barWidth = (hub.occurrenceCount / maxOccurrence) * 100;
            const scopeColor = SCOPE_COLORS[hub.scopeLevel ?? ''] ?? 'var(--color-neutral-400)';

            return (
              <li key={hub.definitionId} className="group">
                <div className="flex items-start gap-2">
                  {/* Rank number */}
                  <span className="text-xs font-medium text-[var(--color-text-muted)] w-4 flex-shrink-0 mt-0.5">
                    {index + 1}.
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Term with link */}
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/${state.toLowerCase()}/regulations/${hub.documentId}`}
                        target="_blank"
                        className="text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-link)] truncate"
                      >
                        {hub.term}
                      </Link>
                      <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>

                    {/* Definition snippet */}
                    {hub.definitionSnippet && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                        {hub.definitionSnippet}
                      </p>
                    )}

                    {/* Metadata row */}
                    <div className="flex items-center flex-wrap gap-2 mt-1.5">
                      {hub.titleNumber && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]">
                          Title {hub.titleNumber}
                        </span>
                      )}
                      {hub.scopeLevel && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                          style={{
                            backgroundColor: `${scopeColor}15`,
                            color: scopeColor,
                          }}
                        >
                          {hub.scopeLevel}
                        </span>
                      )}
                      {hub.definitionType && (
                        <span className="text-[10px] text-[var(--color-text-muted)] capitalize">
                          {hub.definitionType}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {hub.occurrenceCount} doc{hub.occurrenceCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Occurrence bar */}
                    <div className="mt-1.5 h-1 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Citation */}
                    {hub.citation && (
                      <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1 truncate">
                        {hub.citation}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
