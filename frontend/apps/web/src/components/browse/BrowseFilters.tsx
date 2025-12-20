'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { useQueryStates } from 'nuqs';
import { Button, Select, SearchInput } from '@/components/ui';
import { browseFiltersParsers } from '@/lib/url/parsers';
import { X } from 'lucide-react';

interface BrowseFiltersProps {
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

const HAS_COMPLIANCE_ISSUES_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Compliance Issues' },
  { value: 'false', label: 'No Compliance Issues' },
];

export function BrowseFilters({
  stats,
  className = '',
}: BrowseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(browseFiltersParsers, {
    shallow: false,
    startTransition,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      analyzed: null,
      hasFlags: null,
      severity: 'all',
      hasDefs: null,
      hasCompliance: null,
      search: null,
    });
  }, [setFilters]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.analyzed !== null ||
    filters.hasFlags !== null ||
    (filters.severity && filters.severity !== 'all') ||
    filters.hasDefs !== null ||
    filters.hasCompliance !== null ||
    filters.search !== null;

  // Calculate totals from stats
  const totalDocs = stats.reduce((sum, s) => sum + s.count, 0);
  const totalAnalyzed = stats.reduce((sum, s) => sum + s.analyzedCount, 0);
  const totalFlagged = stats.reduce((sum, s) => sum + s.flaggedCount, 0);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Search input */}
      <SearchInput
        value={filters.search || ''}
        onSearch={(val) => setFilters({ search: val || null })}
        placeholder="Search by title..."
        size="sm"
        className="w-48"
        isLoading={isPending}
      />

      {/* Analyzed filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Analyzed:
        </label>
        <Select
          value={filters.analyzed === true ? 'true' : filters.analyzed === false ? 'false' : 'all'}
          onValueChange={(value) => setFilters({ analyzed: value === 'all' ? null : value === 'true' })}
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
          value={filters.hasFlags === true ? 'true' : filters.hasFlags === false ? 'false' : 'all'}
          onValueChange={(value) => setFilters({ hasFlags: value === 'all' ? null : value === 'true' })}
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
          value={filters.severity || 'all'}
          onValueChange={(value) => setFilters({ severity: value as any })}
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
          value={filters.hasDefs === true ? 'true' : filters.hasDefs === false ? 'false' : 'all'}
          onValueChange={(value) => setFilters({ hasDefs: value === 'all' ? null : value === 'true' })}
          options={HAS_DEFINITIONS_OPTIONS}
          aria-label="Filter by definitions"
        />
      </div>

      {/* Compliance Issues filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Compliance:
        </label>
        <Select
          value={filters.hasCompliance === true ? 'true' : filters.hasCompliance === false ? 'false' : 'all'}
          onValueChange={(value) => setFilters({ hasCompliance: value === 'all' ? null : value === 'true' })}
          options={HAS_COMPLIANCE_ISSUES_OPTIONS}
          aria-label="Filter by compliance issues"
        />
      </div>

      {/* Clear all button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-[var(--color-text-muted)]"
        >
          <X className="w-4 h-4 mr-1" />
          Clear all
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
