'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Button, Select, SearchInput } from '@/components/ui';
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
  search?: string;
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
  currentFilters,
  stats,
  search = '',
  className = '',
}: BrowseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [router, pathname, searchParams]
  );

  // Handle search - clears expanded state when search changes
  const handleSearch = useCallback(
    (searchValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchValue.trim()) {
        params.set('search', searchValue.trim());
      } else {
        params.delete('search');
      }

      // Clear expanded state when search changes (tree will reset)
      params.delete('expanded');

      const queryString = params.toString();
      startTransition(() => {
        router.push(queryString ? `${pathname}?${queryString}` : pathname);
      });
    },
    [router, pathname, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  // Check if any filters are active (excluding search which has its own clear)
  const hasActiveFilters =
    currentFilters.hasAnalysis !== undefined ||
    currentFilters.hasFlags !== undefined ||
    currentFilters.severity !== undefined ||
    currentFilters.hasDefinitions !== undefined ||
    currentFilters.hasComplianceIssues !== undefined;

  // Check if search or filters are active (for clear all)
  const hasSearchOrFilters = search || hasActiveFilters;

  // Calculate totals from stats
  const totalDocs = stats.reduce((sum, s) => sum + s.count, 0);
  const totalAnalyzed = stats.reduce((sum, s) => sum + s.analyzedCount, 0);
  const totalFlagged = stats.reduce((sum, s) => sum + s.flaggedCount, 0);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Search input */}
      <SearchInput
        value={search}
        onSearch={handleSearch}
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

      {/* Compliance Issues filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Compliance:
        </label>
        <Select
          value={currentFilters.hasComplianceIssues === true ? 'true' : currentFilters.hasComplianceIssues === false ? 'false' : 'all'}
          onValueChange={(value) => updateParams({ hasCompliance: value })}
          options={HAS_COMPLIANCE_ISSUES_OPTIONS}
          aria-label="Filter by compliance issues"
        />
      </div>

      {/* Clear all button */}
      {hasSearchOrFilters && (
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
