'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Badge, Pagination } from '@/components/ui';
import type { CrossRefDocumentGroup, CrossRefTableRow, CrossRefActiveFilters } from '@/lib/actions/cross-references';
import { getCrossRefsBySource } from '@/lib/actions/cross-references';
import type { JurisdictionCode } from '@/types/state';
import type { CrossRefGroupSortByValue, SortOrderValue } from '@/lib/url/parsers';
import { CROSSREF_REF_TYPE_LABELS } from '@/lib/constants/values';

interface GroupedCrossRefsTableProps {
  data: CrossRefDocumentGroup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy: CrossRefGroupSortByValue;
  sortOrder: SortOrderValue;
  isPending: boolean;
  jurisdiction: JurisdictionCode;
  onPageChange: (page: number) => void;
  onSort: (column: CrossRefGroupSortByValue) => void;
  activeFilters?: CrossRefActiveFilters;
}

function SortableHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onClick,
}: {
  label: string;
  column: CrossRefGroupSortByValue;
  currentSort: CrossRefGroupSortByValue;
  currentOrder: SortOrderValue;
  onClick: (column: CrossRefGroupSortByValue) => void;
}) {
  const isActive = currentSort === column;
  return (
    <button
      type="button"
      onClick={() => onClick(column)}
      className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] uppercase tracking-wide"
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${isActive ? 'text-[var(--color-primary)]' : 'opacity-40'}`}
      />
      {isActive && (
        <span className="text-[var(--color-primary)] text-[10px]">
          {currentOrder === 'asc' ? '\u2191' : '\u2193'}
        </span>
      )}
    </button>
  );
}

function ExpandedRows({
  refs,
  jurisdiction,
}: {
  refs: CrossRefTableRow[];
  jurisdiction: JurisdictionCode;
}) {
  const state = jurisdiction.toLowerCase();

  return (
    <tr>
      <td colSpan={5} className="px-0 py-0">
        <div className="bg-[var(--color-neutral-50)] border-y border-[var(--color-neutral-200)]">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-6 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Type
                </th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Raw Text
                </th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Citation
                </th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Target
                </th>
              </tr>
            </thead>
            <tbody>
              {refs.map((ref) => (
                <tr
                  key={ref.id}
                  className="border-t border-[var(--color-neutral-100)]"
                >
                  <td className="px-6 py-1.5">
                    <Badge variant="default" className="text-[10px]">
                      {CROSSREF_REF_TYPE_LABELS[ref.refType] ?? ref.refType}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 max-w-[180px]">
                    <span
                      className="text-xs text-[var(--color-text-secondary)] truncate block"
                      title={ref.rawText}
                    >
                      {ref.rawText.length > 50
                        ? ref.rawText.slice(0, 50) + '\u2026'
                        : ref.rawText}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs font-mono text-[var(--color-text)]">
                      {ref.normalizedCitation}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant={ref.isResolved ? 'success' : 'warning'} className="text-[10px]">
                      {ref.isResolved ? 'Resolved' : 'Unresolved'}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">
                    {ref.targetDocumentId ? (
                      <Link
                        href={`/${state}/browse/${ref.targetDocumentId}`}
                        className="text-[var(--color-primary)] hover:underline text-xs"
                      >
                        {ref.targetDocumentCitation ?? ref.targetDocumentTitle ?? `Doc #${ref.targetDocumentId}`}
                      </Link>
                    ) : ref.targetGuidanceId ? (
                      <Link
                        href={`/${state}/guidance/${ref.targetGuidanceId}`}
                        className="text-[var(--color-primary)] hover:underline text-xs"
                      >
                        {ref.targetGuidanceRef ?? `Guidance #${ref.targetGuidanceId}`}
                      </Link>
                    ) : (
                      <span className="text-[var(--color-text-muted)] text-xs">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export function GroupedCrossRefsTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortOrder,
  isPending,
  jurisdiction,
  onPageChange,
  onSort,
  activeFilters,
}: GroupedCrossRefsTableProps) {
  const state = jurisdiction.toLowerCase();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupRefs, setGroupRefs] = useState<Record<string, CrossRefTableRow[]>>({});
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());

  // Clear cached expansions when filters change so re-expansion fetches with new filters
  useEffect(() => {
    setGroupRefs({});
    setExpandedGroups(new Set());
  }, [activeFilters?.isResolved, activeFilters?.refType, activeFilters?.agency, activeFilters?.docType, activeFilters?.nycrrTitle]);

  const getGroupKey = useCallback(
    (group: CrossRefDocumentGroup) =>
      group.sourceGuidanceId
        ? `g-${group.sourceGuidanceId}`
        : `d-${group.sourceDocumentId}`,
    []
  );

  const handleToggle = useCallback(
    async (group: CrossRefDocumentGroup) => {
      const key = getGroupKey(group);
      if (expandedGroups.has(key)) {
        setExpandedGroups((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      setExpandedGroups((prev) => new Set(prev).add(key));

      // Fetch refs if not cached
      if (!groupRefs[key]) {
        setLoadingGroups((prev) => new Set(prev).add(key));
        const result = await getCrossRefsBySource(
          group.sourceDocumentId,
          group.sourceGuidanceId,
          jurisdiction,
          activeFilters
        );
        if (result.success) {
          setGroupRefs((prev) => ({ ...prev, [key]: result.data }));
        }
        setLoadingGroups((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [expandedGroups, groupRefs, jurisdiction, getGroupKey, activeFilters]
  );

  if (data.length === 0 && !isPending) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p className="text-lg font-medium">No document groups found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className={`relative ${isPending ? 'opacity-60' : ''}`}>
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--color-surface)]/50">
          <div className="animate-pulse text-[var(--color-text-muted)]">Loading...</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)]">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2">
                <SortableHeader
                  label="Document"
                  column="documentName"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="px-3 py-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                  Source
                </span>
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Total Refs"
                  column="totalRefs"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="px-3 py-2">
                <SortableHeader
                  label="Unresolved"
                  column="unresolvedCount"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((group) => {
              const key = getGroupKey(group);
              const isExpanded = expandedGroups.has(key);
              const isLoading = loadingGroups.has(key);
              const refs = groupRefs[key];

              const docLink = group.sourceGuidanceId
                ? `/${state}/guidance/${group.sourceGuidanceId}`
                : group.sourceDocumentId
                  ? `/${state}/browse/${group.sourceDocumentId}`
                  : null;

              return (
                <Fragment key={key}>
                  <tr
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] cursor-pointer transition-colors"
                    onClick={() => handleToggle(group)}
                  >
                    <td className="px-3 py-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {docLink ? (
                        <Link
                          href={docLink}
                          className="text-[var(--color-primary)] hover:underline text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {group.documentTitle ?? group.citation ?? 'Unknown'}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {group.documentTitle ?? group.citation ?? 'Unknown'}
                        </span>
                      )}
                      {group.citation && group.documentTitle && (
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">
                          {group.citation}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={group.sourceType === 'guidance' ? 'info' : 'default'}>
                        {group.sourceType === 'guidance' ? 'Guidance' : 'Regulation'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {group.totalRefs.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-sm font-medium ${
                          group.unresolvedCount > 0
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-success)]'
                        }`}
                      >
                        {group.unresolvedCount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-3">
                          <div className="animate-pulse text-sm text-[var(--color-text-muted)]">
                            Loading references...
                          </div>
                        </td>
                      </tr>
                    ) : refs ? (
                      <ExpandedRows
                        refs={refs}
                        jurisdiction={jurisdiction}
                      />
                    ) : null
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          showItemCount
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
