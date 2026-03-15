'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, ArrowUpDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReadabilityBadge } from './ReadabilityBadge';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { PolicyCategoryBadge } from './PolicyCategoryBadge';
import { getGuidanceGroupDocuments } from '@/lib/actions/guidance-documents';
import type {
  GuidanceGroupRow,
  GuidanceGroupByDimension,
  GuidanceGroupDocumentsResult,
  GuidanceDocumentListItem,
} from '@/lib/actions/guidance-documents';
import type { GuidanceGroupSortByValue, SortOrderValue } from '@/lib/url/parsers';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { getEntityIcon } from '@/lib/constants/entity-types';

interface GroupedGuidanceTableProps {
  data: GuidanceGroupRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy: GuidanceGroupSortByValue;
  sortOrder: SortOrderValue;
  isLoading: boolean;
  jurisdiction: JurisdictionCode;
  groupBy: GuidanceGroupByDimension;
  onPageChange: (page: number) => void;
  onSort: (column: GuidanceGroupSortByValue) => void;
  activeFilters?: {
    agency?: string;
    docType?: string;
    policyCategory?: string;
    status?: string;
    yearFrom?: number;
    yearTo?: number;
    search?: string;
    audienceDirection?: string;
    sectionType?: string;
    hasForm?: boolean;
    hasIbr?: boolean;
  };
}

function SortableHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onClick,
}: {
  label: string;
  column: GuidanceGroupSortByValue;
  currentSort: GuidanceGroupSortByValue;
  currentOrder: SortOrderValue;
  onClick: (column: GuidanceGroupSortByValue) => void;
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

function YearSection({
  year,
  documents,
  jurisdiction,
  isOpen,
  onToggle,
}: {
  year: number | null;
  documents: GuidanceDocumentListItem[];
  jurisdiction: JurisdictionCode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const state = jurisdiction.toLowerCase();
  const complianceTotal = documents.reduce((sum, d) => sum + d.complianceIssueCount, 0);
  const jenaiTotal = documents.reduce((sum, d) => sum + d.jenaiIssueCount, 0);
  const readabilityScores = documents
    .map(d => d.fleschReadingEase)
    .filter((s): s is number => s !== null);
  const avgReadability = readabilityScores.length > 0
    ? readabilityScores.reduce((a, b) => a + b, 0) / readabilityScores.length
    : null;

  return (
    <div className="border-b border-[var(--color-neutral-100)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-6 py-2 text-left hover:bg-[var(--color-neutral-100)] transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        )}
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {year ?? 'Unknown Year'}
        </span>
        <Badge variant="default">{documents.length} docs</Badge>
        {complianceTotal > 0 && (
          <Badge variant={complianceTotal >= 10 ? 'danger' : 'warning'}>
            {complianceTotal} compliance
          </Badge>
        )}
        {jenaiTotal > 0 && (
          <Badge variant={jenaiTotal >= 10 ? 'danger' : 'warning'}>
            {jenaiTotal} JenAI
          </Badge>
        )}
        {avgReadability !== null && (
          <ReadabilityBadge score={avgReadability} />
        )}
      </button>
      {isOpen && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="px-8 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Ref
              </th>
              <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Title
              </th>
              <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Type
              </th>
              <th className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Status
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Issues
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-t border-[var(--color-neutral-100)]"
              >
                <td className="px-8 py-1.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  <Link
                    href={`/${state}/guidance/${doc.id}`}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    {doc.canonicalRef ?? '—'}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-xs text-[var(--color-text)] max-w-[250px] truncate" title={doc.title}>
                  <Link
                    href={`/${state}/guidance/${doc.id}`}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    {doc.title}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
                  {doc.docType ?? '—'}
                </td>
                <td className="px-3 py-1.5">
                  <GuidanceStatusBadge status={doc.status} />
                </td>
                <td className="px-3 py-1.5 text-right">
                  {doc.complianceIssueCount > 0 ? (
                    <Badge variant="warning">{doc.complianceIssueCount}</Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function GroupedGuidanceTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortOrder,
  isLoading,
  jurisdiction,
  groupBy,
  onPageChange,
  onSort,
  activeFilters,
}: GroupedGuidanceTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupDocs, setGroupDocs] = useState<Record<string, GuidanceGroupDocumentsResult>>({});
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());
  // Track which year sections are open, keyed by groupKey
  const [openYears, setOpenYears] = useState<Record<string, Set<number | null>>>({});

  // Clear cache when filters or groupBy change
  useEffect(() => {
    setGroupDocs({});
    setExpandedGroups(new Set());
    setOpenYears({});
  }, [
    groupBy,
    activeFilters?.agency,
    activeFilters?.docType,
    activeFilters?.policyCategory,
    activeFilters?.status,
    activeFilters?.yearFrom,
    activeFilters?.yearTo,
    activeFilters?.search,
    activeFilters?.audienceDirection,
    activeFilters?.sectionType,
    activeFilters?.hasForm,
    activeFilters?.hasIbr,
  ]);

  const handleToggle = useCallback(async (groupKey: string) => {
    const wasExpanded = expandedGroups.has(groupKey);
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });

    // Reset year states when collapsing a group
    if (wasExpanded) {
      setOpenYears(prev => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
    }

    // Lazy-load if not cached
    if (!groupDocs[groupKey] && !loadingGroups.has(groupKey)) {
      setLoadingGroups(prev => new Set(prev).add(groupKey));
      try {
        const result = await getGuidanceGroupDocuments(
          jurisdiction,
          groupBy,
          groupKey,
          activeFilters
        );
        if (result.success) {
          setGroupDocs(prev => ({ ...prev, [groupKey]: result.data }));
        }
      } finally {
        setLoadingGroups(prev => {
          const next = new Set(prev);
          next.delete(groupKey);
          return next;
        });
      }
    }
  }, [expandedGroups, groupDocs, loadingGroups, jurisdiction, groupBy, activeFilters]);

  const toggleYear = useCallback((groupKey: string, year: number | null) => {
    setOpenYears(prev => {
      const current = prev[groupKey] ?? new Set<number | null>();
      const next = new Set(current);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return { ...prev, [groupKey]: next };
    });
  }, []);

  const expandAllYears = useCallback((groupKey: string, years: (number | null)[]) => {
    setOpenYears(prev => ({ ...prev, [groupKey]: new Set(years) }));
  }, []);

  const collapseAllYears = useCallback((groupKey: string) => {
    setOpenYears(prev => ({ ...prev, [groupKey]: new Set<number | null>() }));
  }, []);

  if (data.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={getEntityIcon('guidance_document')}
        title="No groups found"
        description="Try adjusting your filters"
      />
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)]">
              <th className="w-8 py-3 pr-1" />
              <th className="text-left py-3 pr-3">
                <SortableHeader
                  label="Group"
                  column="groupKey"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="text-right py-3 pr-3">
                <SortableHeader
                  label="Documents"
                  column="documentCount"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="text-right py-3 pr-3">
                <SortableHeader
                  label="Compliance"
                  column="complianceIssueCount"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="text-right py-3 pr-3">
                <SortableHeader
                  label="JenAI"
                  column="jenaiIssueCount"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
              <th className="text-center py-3 pr-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Years
              </th>
              <th className="text-right py-3">
                <SortableHeader
                  label="Avg Readability"
                  column="avgReadingEase"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onClick={onSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((group) => {
              const isExpanded = expandedGroups.has(group.groupKey);
              const isGroupLoading = loadingGroups.has(group.groupKey);
              const cachedDocs = groupDocs[group.groupKey];

              return (
                <Fragment key={group.groupKey}>
                  <tr
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] cursor-pointer transition-colors"
                    onClick={() => handleToggle(group.groupKey)}
                  >
                    <td className="py-3 pl-3 pr-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                      )}
                    </td>
                    <td className="py-3 pr-3 font-medium text-[var(--color-text)]">
                      {group.groupKey}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <Badge variant="default">{group.documentCount}</Badge>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {group.complianceIssueCount > 0 ? (
                        <Badge variant={group.complianceIssueCount >= 10 ? 'danger' : 'warning'}>
                          {group.complianceIssueCount}
                        </Badge>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {group.jenaiIssueCount > 0 ? (
                        <Badge variant={group.jenaiIssueCount >= 10 ? 'danger' : 'warning'}>
                          {group.jenaiIssueCount}
                        </Badge>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-center text-xs text-[var(--color-text-muted)]">
                      {group.yearMin && group.yearMax
                        ? group.yearMin === group.yearMax
                          ? group.yearMin
                          : `${group.yearMin}–${group.yearMax}`
                        : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <ReadabilityBadge score={group.avgFleschReadingEase} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="px-0 py-0">
                        <div className="bg-[var(--color-neutral-50)] border-y border-[var(--color-neutral-200)]">
                          {isGroupLoading && !cachedDocs ? (
                            <div className="flex items-center gap-2 px-6 py-4 text-sm text-[var(--color-text-muted)]">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading documents...
                            </div>
                          ) : cachedDocs ? (
                            <>
                              <div className="flex items-center justify-between px-6 py-2 border-b border-[var(--color-neutral-200)]">
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {cachedDocs.byYear.length} year group{cachedDocs.byYear.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="text-xs text-[var(--color-primary)] hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      expandAllYears(group.groupKey, cachedDocs.byYear.map(y => y.year));
                                    }}
                                  >
                                    Expand All
                                  </button>
                                  <span className="text-[var(--color-neutral-300)]">|</span>
                                  <button
                                    type="button"
                                    className="text-xs text-[var(--color-primary)] hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      collapseAllYears(group.groupKey);
                                    }}
                                  >
                                    Collapse All
                                  </button>
                                </div>
                              </div>
                              {cachedDocs.byYear.map(({ year, documents }) => (
                                <YearSection
                                  key={year ?? 'null'}
                                  year={year}
                                  documents={documents}
                                  jurisdiction={jurisdiction}
                                  isOpen={openYears[group.groupKey]?.has(year) ?? false}
                                  onToggle={() => toggleYear(group.groupKey, year)}
                                />
                              ))}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-[var(--color-neutral-200)]">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            showItemCount
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
