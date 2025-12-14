'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { HierarchyFilterOptions } from '@deproceduralizer/database';
import { X } from 'lucide-react';

interface BrowseFiltersProps {
  currentFilters: HierarchyFilterOptions;
  stats: {
    level: string;
    count: number;
    analyzedCount: number;
    flaggedCount: number;
  }[];
  className?: string;
}

const ANALYZED_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Analyzed' },
  { value: 'false', label: 'Not Analyzed' },
];

const HAS_FLAGS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Flags' },
  { value: 'false', label: 'No Flags' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'high', label: 'High (7-10)' },
  { value: 'medium', label: 'Medium (4-6)' },
  { value: 'low', label: 'Low (1-3)' },
];

const HAS_DEFINITIONS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Definitions' },
  { value: 'false', label: 'No Definitions' },
];

export function BrowseFilters({
  currentFilters,
  stats,
  className = '',
}: BrowseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.push(`/browse?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push('/browse');
  }, [router]);

  // Check if any filters are active
  const hasActiveFilters =
    currentFilters.hasAnalysis !== undefined ||
    currentFilters.hasFlags !== undefined ||
    currentFilters.severity !== undefined ||
    currentFilters.hasDefinitions !== undefined;

  // Calculate totals from stats
  const totalDocs = stats.reduce((sum, s) => sum + s.count, 0);
  const totalAnalyzed = stats.reduce((sum, s) => sum + s.analyzedCount, 0);
  const totalFlagged = stats.reduce((sum, s) => sum + s.flaggedCount, 0);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Analyzed filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Analyzed:
        </label>
        <Select
          value={currentFilters.hasAnalysis === true ? 'true' : currentFilters.hasAnalysis === false ? 'false' : 'all'}
          onValueChange={(value) => updateParams({ analyzed: value })}
          options={ANALYZED_OPTIONS}
          aria-label="Filter by analysis status"
        />
      </div>

      {/* Has Flags filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Flags:
        </label>
        <Select
          value={currentFilters.hasFlags === true ? 'true' : currentFilters.hasFlags === false ? 'false' : 'all'}
          onValueChange={(value) => updateParams({ hasFlags: value })}
          options={HAS_FLAGS_OPTIONS}
          aria-label="Filter by flags"
        />
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Severity:
        </label>
        <Select
          value={currentFilters.severity || 'all'}
          onValueChange={(value) => updateParams({ severity: value })}
          options={SEVERITY_OPTIONS}
          aria-label="Filter by severity"
        />
      </div>

      {/* Has Definitions filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Definitions:
        </label>
        <Select
          value={currentFilters.hasDefinitions === true ? 'true' : currentFilters.hasDefinitions === false ? 'false' : 'all'}
          onValueChange={(value) => updateParams({ hasDefs: value })}
          options={HAS_DEFINITIONS_OPTIONS}
          aria-label="Filter by definitions"
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-[var(--color-text-muted)]"
        >
          <X className="w-4 h-4 mr-1" />
          Clear filters
        </Button>
      )}

      {/* Stats summary */}
      <div className="ml-auto text-xs text-[var(--color-text-muted)]">
        {totalDocs.toLocaleString()} documents
        {totalAnalyzed > 0 && (
          <span className="ml-2">{totalAnalyzed.toLocaleString()} analyzed</span>
        )}
        {totalFlagged > 0 && (
          <span className="ml-2">{totalFlagged.toLocaleString()} flagged</span>
        )}
      </div>
    </div>
  );
}

export default BrowseFilters;
