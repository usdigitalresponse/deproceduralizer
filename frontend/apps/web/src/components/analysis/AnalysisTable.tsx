'use client';

import { useEffect, useState, useTransition, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { JurisdictionCode, AnalysisListItem, GuidanceAnalysisListItem } from '@deproceduralizer/database';
import type { PipelineSourceValue } from '@/lib/constants/values';
import { analysisTableParsers } from '@/lib/url/parsers';
import { parseCommaSeparated } from '@/lib/url/filter-helpers';
import {
  getAnalysisListPaginated,
  getGuidanceAnalysisListPaginated,
  type PaginatedAnalysisResult,
  type PaginatedGuidanceAnalysisResult,
} from '@/lib/actions/analysis';
import type { MarkerGroup } from '@deproceduralizer/database';
import {
  getBookmarkedDocIssuePairs,
  getBookmarkedGuidanceDocIssuePairs,
  toggleAnalysisBookmarkByDocIssue,
  toggleGuidanceAnalysisBookmarkByDocIssue,
  getAnalysisBookmarkMarkersMap,
  assignMarkerToBookmark,
  removeMarkerFromBookmark,
  updateBookmarkNotes,
  type BookmarkMarkerEntry,
  type BookmarkMarkersMap,
} from '@/lib/actions/bookmarks';
import { getMarkerGroups, getOrCreateCustomMarkerGroup } from '@/lib/actions/marker-groups';
import { ClassificationBadge } from '@/components/issues/TierClassificationFlow';
import { MarkerDots, MarkerPicker, MarkerBadge } from '@/components/markers';
import { BookmarkNotesEditor } from '@/components/bookmarks/BookmarkNotesEditor';
import { Badge, BookmarkButton } from '@/components/ui';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { AnalysisDetailDrawer } from './AnalysisDetailDrawer';

/** Unified row type used by the table for both regulation and guidance items */
export type UnifiedAnalysisRow = {
  issueType: string;
  documentTitle: string | null;
  highestTierCompleted: number;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  finalSeverity: number | null;
  federalMandateFound: boolean;
  isJustified: boolean;
  rerunCount: number;
  createdAt: Date | null;
  easyCleanupCandidate: boolean;
  cleanupType: string | null;
  cleanupEffort: string | null;
  tier3TriggerReason: string | null;
} & (
  | { kind: 'regulation'; documentId: number; citation: string | null }
  | { kind: 'guidance'; guidanceDocumentId: number; agency: string | null; docType: string | null; canonicalRef: string | null }
);

function toUnifiedRows(source: PipelineSourceValue | undefined, data: PaginatedAnalysisResult | PaginatedGuidanceAnalysisResult): UnifiedAnalysisRow[] {
  if (source === 'guidance') {
    return (data as PaginatedGuidanceAnalysisResult).data.map((item) => ({
      ...item,
      kind: 'guidance' as const,
    }));
  }
  return (data as PaginatedAnalysisResult).data.map((item) => ({
    ...item,
    kind: 'regulation' as const,
  }));
}

/** Derive the marker key for a unified row (prefixed to avoid collisions between regulation/guidance) */
function rowMarkerKey(item: UnifiedAnalysisRow): string {
  return item.kind === 'guidance'
    ? `g-${item.guidanceDocumentId}-${item.issueType}`
    : `r-${item.documentId}-${item.issueType}`;
}

/** Number of columns in the table header (used for expanded row colSpan) */
const COLUMN_COUNT = 12;

interface AnalysisTableProps {
  jurisdiction: JurisdictionCode;
  source?: PipelineSourceValue;
}

export function AnalysisTable({ jurisdiction, source }: AnalysisTableProps) {
  const isGuidance = source === 'guidance';
  const [filters] = useQueryStates(analysisTableParsers);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<UnifiedAnalysisRow[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pageSize: number; totalPages: number } | null>(null);
  const [, setFilters] = useQueryStates(analysisTableParsers);
  const [bookmarkedPairs, setBookmarkedPairs] = useState<Set<string>>(new Set());
  const [bookmarkMarkersMap, setBookmarkMarkersMap] = useState<BookmarkMarkersMap>(new Map());
  const [markerGroupsList, setMarkerGroupsList] = useState<MarkerGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<UnifiedAnalysisRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerItemFromUrl = filters.drawerItem;
  const [isProcessing, setIsProcessing] = useState(false);
  const { bookmarkName } = useBookmarkName();

  // Derive visible keys for bulk selection (marker keys: "docId-issueType")
  const visibleKeys = useMemo(() => rows.map(rowMarkerKey), [rows]);
  const {
    selectedKeys,
    toggle: toggleSelection,
    toggleAll,
    clear: clearSelection,
    isAllSelected,
    isSomeSelected,
    count: selectedCount,
  } = useBulkSelection(visibleKeys);

  // Fetch bookmarked items and marker data for the active source
  useEffect(() => {
    let cancelled = false;
    async function fetchBookmarks() {
      const [bookmarkResult, markersResult, groupsResult] = await Promise.all([
        isGuidance
          ? getBookmarkedGuidanceDocIssuePairs(jurisdiction)
          : getBookmarkedDocIssuePairs(jurisdiction),
        getAnalysisBookmarkMarkersMap(jurisdiction),
        getMarkerGroups(jurisdiction),
      ]);
      if (cancelled) return;
      if (bookmarkResult.success) setBookmarkedPairs(bookmarkResult.data);
      if (markersResult.success) setBookmarkMarkersMap(markersResult.data);
      if (groupsResult.success) setMarkerGroupsList(groupsResult.data);
    }
    fetchBookmarks();
    return () => { cancelled = true; };
  }, [jurisdiction, isGuidance]);

  // Handle bookmark toggle with optimistic update
  const handleBookmarkToggle = useCallback(async (docId: number, issueType: string) => {
    const key = isGuidance ? `g-${docId}-${issueType}` : `r-${docId}-${issueType}`;
    const wasBookmarked = bookmarkedPairs.has(key);

    // Optimistic update
    setBookmarkedPairs(prev => {
      const next = new Set(prev);
      if (wasBookmarked) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // Server update — use the right action based on source
    const result = isGuidance
      ? await toggleGuidanceAnalysisBookmarkByDocIssue(docId, issueType, jurisdiction)
      : await toggleAnalysisBookmarkByDocIssue(docId, issueType, jurisdiction);

    // Revert if failed
    if (!result.success) {
      setBookmarkedPairs(prev => {
        const next = new Set(prev);
        if (wasBookmarked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      console.error('Failed to toggle bookmark:', result.error);
    } else {
      // Refresh markers map to pick up new bookmark entries (including notes)
      const refreshed = await getAnalysisBookmarkMarkersMap(jurisdiction);
      if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
    }
  }, [jurisdiction, bookmarkedPairs, isGuidance]);

  // Handle marker toggle with optimistic update
  const handleMarkerToggle = useCallback(async (bookmarkId: number, markerGroupId: number, assign: boolean) => {
    // Find the key for this bookmark
    const key = Array.from(bookmarkMarkersMap.entries()).find(([, v]) => v.bookmarkId === bookmarkId)?.[0];
    if (!key) return;

    // Optimistic update
    setBookmarkMarkersMap(prev => {
      const next = new Map(prev);
      const entry = next.get(key);
      if (!entry) return prev;
      const group = markerGroupsList.find(g => g.id === markerGroupId);
      if (assign && group) {
        next.set(key, { ...entry, markers: [...entry.markers, { id: group.id, name: group.name, color: group.color }] });
      } else {
        next.set(key, { ...entry, markers: entry.markers.filter(m => m.id !== markerGroupId) });
      }
      return next;
    });

    const result = assign
      ? await assignMarkerToBookmark(bookmarkId, markerGroupId)
      : await removeMarkerFromBookmark(bookmarkId, markerGroupId);

    if (!result.success) {
      // Refresh on failure
      const refreshed = await getAnalysisBookmarkMarkersMap(jurisdiction);
      if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
    }
  }, [bookmarkMarkersMap, markerGroupsList, jurisdiction]);

  // Handle creating a custom marker group and auto-assigning to a bookmark
  const handleCreateCustomMarker = useCallback(async (bookmarkId: number, markerKey: string, name: string) => {
    const result = await getOrCreateCustomMarkerGroup(name, jurisdiction);
    if (result.success) {
      setMarkerGroupsList(prev => prev.some(g => g.id === result.data.id) ? prev : [...prev, result.data]);
      const assignResult = await assignMarkerToBookmark(bookmarkId, result.data.id);
      if (assignResult.success) {
        setBookmarkMarkersMap(prev => {
          const next = new Map(prev);
          const entry = next.get(markerKey);
          if (entry) {
            const already = entry.markers.some(m => m.id === result.data.id);
            if (!already) {
              next.set(markerKey, { ...entry, markers: [...entry.markers, { id: result.data.id, name: result.data.name, color: result.data.color }] });
            }
          }
          return next;
        });
      } else {
        console.warn('[CreateCustomMarker] assign failed, refreshing markers map');
        const refreshed = await getAnalysisBookmarkMarkersMap(jurisdiction);
        if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
      }
    }
  }, [jurisdiction]);

  // Handle saving bookmark notes with optimistic update
  const handleSaveNotes = useCallback(async (bookmarkId: number, markerKey: string, notes: string, createdBy?: string) => {
    // Optimistic update
    setBookmarkMarkersMap(prev => {
      const next = new Map(prev);
      const entry = next.get(markerKey);
      if (entry) {
        next.set(markerKey, { ...entry, notes, createdBy: createdBy ?? entry.createdBy });
      }
      return next;
    });

    const result = await updateBookmarkNotes(bookmarkId, notes, createdBy);
    if (!result.success) {
      // Refresh on failure
      const refreshed = await getAnalysisBookmarkMarkersMap(jurisdiction);
      if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
    }
  }, [jurisdiction]);

  // Bulk mark all: bookmark any unbookmarked selected items
  const handleBulkMarkAll = useCallback(async () => {
    setIsProcessing(true);
    try {
      const unbookmarked: Array<{ docId: number; issueType: string }> = [];
      for (const key of selectedKeys) {
        if (!bookmarkedPairs.has(key)) {
          const row = rows.find(r => rowMarkerKey(r) === key);
          if (row) {
            const docId = row.kind === 'guidance' ? row.guidanceDocumentId : row.documentId;
            unbookmarked.push({ docId, issueType: row.issueType });
          }
        }
      }
      await Promise.allSettled(
        unbookmarked.map(({ docId, issueType }) => handleBookmarkToggle(docId, issueType))
      );
    } finally {
      setIsProcessing(false);
    }
  }, [selectedKeys, bookmarkedPairs, rows, handleBookmarkToggle]);

  // Bulk assign marker: assign to all bookmarked selected items
  const handleBulkAssignMarker = useCallback(async (markerGroupId: number) => {
    setIsProcessing(true);
    try {
      const assignments: Promise<void>[] = [];
      for (const key of selectedKeys) {
        const entry = bookmarkMarkersMap.get(key);
        if (entry) {
          const alreadyAssigned = entry.markers.some(m => m.id === markerGroupId);
          if (!alreadyAssigned) {
            assignments.push(
              (async () => { await handleMarkerToggle(entry.bookmarkId, markerGroupId, true); })()
            );
          }
        }
      }
      await Promise.allSettled(assignments);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedKeys, bookmarkMarkersMap, handleMarkerToggle]);

  // Bulk unmark all: remove bookmarks from all selected items that are bookmarked
  const handleBulkUnmarkAll = useCallback(async () => {
    setIsProcessing(true);
    try {
      const bookmarked: Array<{ docId: number; issueType: string }> = [];
      for (const key of selectedKeys) {
        if (bookmarkedPairs.has(key)) {
          const row = rows.find(r => rowMarkerKey(r) === key);
          if (row) {
            const docId = row.kind === 'guidance' ? row.guidanceDocumentId : row.documentId;
            bookmarked.push({ docId, issueType: row.issueType });
          }
        }
      }
      await Promise.allSettled(
        bookmarked.map(({ docId, issueType }) => handleBookmarkToggle(docId, issueType))
      );
    } finally {
      setIsProcessing(false);
    }
  }, [selectedKeys, bookmarkedPairs, rows, handleBookmarkToggle]);

  // Bulk create new category and assign to all selected bookmarked items
  const handleBulkCreateAndAssign = useCallback(async (name: string) => {
    setIsProcessing(true);
    try {
      const result = await getOrCreateCustomMarkerGroup(name, jurisdiction);
      if (!result.success) return;

      // Add to available groups list
      setMarkerGroupsList(prev => prev.some(g => g.id === result.data.id) ? prev : [...prev, result.data]);

      // Assign to all selected bookmarked items
      const assignments: Promise<{ success: boolean }>[] = [];
      for (const key of selectedKeys) {
        const entry = bookmarkMarkersMap.get(key);
        if (entry) {
          const alreadyAssigned = entry.markers.some(m => m.id === result.data.id);
          if (!alreadyAssigned) {
            assignments.push(
              (async () => {
                const assignResult = await assignMarkerToBookmark(entry.bookmarkId, result.data.id);
                if (assignResult.success) {
                  setBookmarkMarkersMap(prev => {
                    const next = new Map(prev);
                    const e = next.get(key);
                    if (e) {
                      const already = e.markers.some(m => m.id === result.data.id);
                      if (!already) {
                        next.set(key, { ...e, markers: [...e.markers, { id: result.data.id, name: result.data.name, color: result.data.color }] });
                      }
                    }
                    return next;
                  });
                }
                return assignResult;
              })()
            );
          }
        }
      }
      const results = await Promise.allSettled(assignments);
      const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
      if (failures.length > 0) {
        console.warn(`[BulkAssign] ${failures.length}/${results.length} assignments failed, refreshing...`);
        // Refresh markers map to re-sync
        const refreshed = await getAnalysisBookmarkMarkersMap(jurisdiction);
        if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [jurisdiction, selectedKeys, bookmarkMarkersMap]);

  // Build shared filter object from URL state
  // Filter out 'all' for backward compatibility with legacy URLs (e.g., ?issueType=all)
  const buildFilters = useCallback(() => {
    const parse = (v: string | null) => parseCommaSeparated(v).filter(x => x !== 'all');
    const tiers = parse(filters.tierCompleted).map(Number).filter(n => !isNaN(n));
    const classifications = parse(filters.classification);
    const federalMandates = parse(filters.federalMandate);
    const pipelineRuns = parse(filters.pipelineRun);
    const issueTypes = parse(filters.issueType);
    const severities = parse(filters.severity) as ('high' | 'medium' | 'low' | 'none')[];
    const severityChanges = parse(filters.severityChanged);
    const federalMandatesConfirmed = parse(filters.federalMandateConfirmed);
    const stateDiscretions = parse(filters.stateDiscretion);
    const alternativesFound = parse(filters.alternativeFound);
    const evidenceGaps = parse(filters.evidenceGap);
    const supersededByLaws = parse(filters.supersededByLaw);
    const advocacyForChanges = parse(filters.advocacyForChange);
    const tier3Triggers = parse(filters.tier3Trigger);
    const easyCleanups = parse(filters.easyCleanup);
    const markerIds = filters.marker ? parseCommaSeparated(filters.marker).map(Number).filter(n => !isNaN(n)) : undefined;

    return {
      tiersCompleted: tiers.length > 0 ? tiers : undefined,
      classifications: classifications.length > 0 ? classifications : undefined,
      federalMandates: federalMandates.length > 0 ? federalMandates : undefined,
      pipelineRuns: pipelineRuns.length > 0 ? pipelineRuns : undefined,
      issueTypes: issueTypes.length > 0 ? issueTypes : undefined,
      severities: severities.length > 0 ? severities : undefined,
      severityChanges: severityChanges.length > 0 ? severityChanges : undefined,
      federalMandatesConfirmed: federalMandatesConfirmed.length > 0 ? federalMandatesConfirmed : undefined,
      stateDiscretions: stateDiscretions.length > 0 ? stateDiscretions : undefined,
      alternativesFound: alternativesFound.length > 0 ? alternativesFound : undefined,
      evidenceGaps: evidenceGaps.length > 0 ? evidenceGaps : undefined,
      supersededByLaws: supersededByLaws.length > 0 ? supersededByLaws : undefined,
      advocacyForChanges: advocacyForChanges.length > 0 ? advocacyForChanges : undefined,
      tier3Triggers: tier3Triggers.length > 0 ? tier3Triggers : undefined,
      easyCleanups: easyCleanups.length > 0 ? easyCleanups : undefined,
      bookmarkedOnly: filters.bookmarkedOnly === 'true' ? true : undefined,
      markerGroupIds: markerIds?.length ? markerIds : undefined,
    };
  }, [filters]);

  // Fetch data when filters or source change
  useEffect(() => {
    startTransition(async () => {
      const options = {
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy: filters.sortBy as 'issueType' | 'severity' | 'highestTier' | 'createdAt',
        sortOrder: filters.sortOrder as 'asc' | 'desc',
        filters: buildFilters(),
      };

      if (isGuidance) {
        const result = await getGuidanceAnalysisListPaginated(jurisdiction, options);
        if (result.success) {
          setError(null);
          setRows(toUnifiedRows(source, result.data));
          setPagination({ total: result.data.total, page: result.data.page, pageSize: result.data.pageSize, totalPages: result.data.totalPages });
        } else {
          console.error('[AnalysisTable] Failed to fetch data:', result.error);
          setError(result.error);
        }
      } else {
        const result = await getAnalysisListPaginated(jurisdiction, options);
        if (result.success) {
          setError(null);
          setRows(toUnifiedRows(source, result.data));
          setPagination({ total: result.data.total, page: result.data.page, pageSize: result.data.pageSize, totalPages: result.data.totalPages });
        } else {
          console.error('[AnalysisTable] Failed to fetch data:', result.error);
          setError(result.error);
        }
      }
    });
  }, [jurisdiction, filters, isGuidance, source, buildFilters]);

  // Refresh bookmark data (called on drawer close to sync changes made in drawer)
  const refreshBookmarkData = useCallback(async () => {
    const [bookmarkResult, markersResult] = await Promise.all([
      isGuidance
        ? getBookmarkedGuidanceDocIssuePairs(jurisdiction)
        : getBookmarkedDocIssuePairs(jurisdiction),
      getAnalysisBookmarkMarkersMap(jurisdiction),
    ]);
    if (bookmarkResult.success) setBookmarkedPairs(bookmarkResult.data);
    if (markersResult.success) setBookmarkMarkersMap(markersResult.data);
  }, [jurisdiction, isGuidance]);

  // Sync drawer state with URL (open, close, or switch item on history navigation)
  useEffect(() => {
    if (drawerItemFromUrl && rows.length > 0) {
      const match = rows.find(r => rowMarkerKey(r) === drawerItemFromUrl);
      if (match) {
        setSelectedItem(match);
        setDrawerOpen(true);
      }
    } else if (!drawerItemFromUrl && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [drawerItemFromUrl, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      // Clear URL state and refresh bookmark/marker data when drawer closes
      setFilters({ drawerItem: null });
      refreshBookmarkData();
    }
  }, [refreshBookmarkData, setFilters]);

  const handleRowClick = useCallback((item: UnifiedAnalysisRow) => {
    setSelectedItem(item);
    setDrawerOpen(true);
    setFilters({ drawerItem: rowMarkerKey(item) });
  }, [setFilters]);

  // Compute current index for drawer navigation
  const currentIndex = useMemo(() => {
    if (!selectedItem) return -1;
    const key = rowMarkerKey(selectedItem);
    return rows.findIndex(r => rowMarkerKey(r) === key);
  }, [selectedItem, rows]);

  // Navigate to a different row from inside the drawer
  const handleNavigate = useCallback((index: number) => {
    if (index >= 0 && index < rows.length) {
      setSelectedItem(rows[index]);
      setFilters({ drawerItem: rowMarkerKey(rows[index]) });
    }
  }, [rows, setFilters]);

  // Ref for scrolling active row into view
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Scroll active row into view when navigating
  useEffect(() => {
    if (!drawerOpen || !selectedItem) return;
    const key = rowMarkerKey(selectedItem);
    const row = rowRefs.current.get(key);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [drawerOpen, selectedItem]);

  const handlePageChange = (newPage: number) => {
    setFilters({ page: newPage });
  };

  if (error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-background)] p-8 text-center">
        <p className="text-[var(--color-danger)] font-medium">Failed to load pipeline data</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">{error}</p>
      </div>
    );
  }

  if (!pagination && isPending) {
    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">Loading pipeline data...</div>
      </div>
    );
  }

  if (!pagination || rows.length === 0) {
    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
        <p className="text-[var(--color-text-muted)]">No pipeline records found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
              <th className="w-8 px-2 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected && !isAllSelected;
                  }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] cursor-pointer"
                  aria-label="Select all visible rows"
                />
              </th>
              <th className="w-10 px-2 py-3"></th>
              <th className="w-16 px-1 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Issue Type</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Document</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T1</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T2</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T3</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Severity</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Federal</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Easy Fix</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const docId = item.kind === 'guidance' ? item.guidanceDocumentId : item.documentId;
              const markerKey = item.kind === 'guidance'
                ? `g-${item.guidanceDocumentId}-${item.issueType}`
                : `r-${item.documentId}-${item.issueType}`;
              const isBookmarked = bookmarkedPairs.has(markerKey);
              const markerEntry = bookmarkMarkersMap.get(markerKey);
              const isSelected = selectedKeys.has(markerKey);
              return (
                <AnalysisTableRow
                  key={markerKey}
                  item={item}
                  jurisdiction={jurisdiction}
                  isBookmarked={isBookmarked}
                  onBookmarkToggle={() => handleBookmarkToggle(docId, item.issueType)}
                  isGuidance={isGuidance}
                  markerEntry={markerEntry}
                  availableGroups={markerGroupsList}
                  onMarkerToggle={handleMarkerToggle}
                  onCreateCustomMarker={markerEntry ? (name) => handleCreateCustomMarker(markerEntry.bookmarkId, markerKey, name) : undefined}
                  onRowClick={handleRowClick}
                  isSelected={isSelected}
                  onToggleSelection={() => toggleSelection(markerKey)}
                  onSaveNotes={markerEntry ? (notes, createdBy) => handleSaveNotes(markerEntry.bookmarkId, markerKey, notes, createdBy) : undefined}
                  bookmarkName={bookmarkName}
                  isActive={drawerOpen && selectedItem !== null && markerKey === rowMarkerKey(selectedItem)}
                  rowRef={(el) => {
                    if (el) rowRefs.current.set(markerKey, el);
                    else rowRefs.current.delete(markerKey);
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onMarkAll={handleBulkMarkAll}
          onAssignMarker={handleBulkAssignMarker}
          onCreateAndAssign={handleBulkCreateAndAssign}
          onUnmarkAll={handleBulkUnmarkAll}
          onClear={clearSelection}
          availableGroups={markerGroupsList}
          isProcessing={isProcessing}
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
        <div className="text-xs text-[var(--color-text-muted)]">
          Showing {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total.toLocaleString()}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || isPending}
            className="p-1.5 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm text-[var(--color-text-muted)]">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || isPending}
            className="p-1.5 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
        </div>
      )}

      {/* Detail Drawer */}
      <AnalysisDetailDrawer
        item={selectedItem}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        jurisdiction={jurisdiction}
        rows={rows}
        currentIndex={currentIndex}
        onNavigate={handleNavigate}
        onTriageChanged={refreshBookmarkData}
      />
    </div>
  );
}

interface AnalysisTableRowProps {
  item: UnifiedAnalysisRow;
  jurisdiction: JurisdictionCode;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  isGuidance: boolean;
  markerEntry?: BookmarkMarkerEntry;
  availableGroups: MarkerGroup[];
  onMarkerToggle: (bookmarkId: number, markerGroupId: number, assign: boolean) => void;
  onCreateCustomMarker?: (name: string) => void;
  onRowClick: (item: UnifiedAnalysisRow) => void;
  isSelected: boolean;
  onToggleSelection: () => void;
  onSaveNotes?: (notes: string, createdBy?: string) => Promise<void>;
  bookmarkName: string;
  isActive: boolean;
  rowRef?: (el: HTMLTableRowElement | null) => void;
}

function AnalysisTableRow({
  item,
  jurisdiction,
  isBookmarked,
  onBookmarkToggle,
  isGuidance,
  markerEntry,
  availableGroups,
  onMarkerToggle,
  onCreateCustomMarker,
  onRowClick,
  isSelected,
  onToggleSelection,
  onSaveNotes,
  bookmarkName,
  isActive,
  rowRef,
}: AnalysisTableRowProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[item.issueType as keyof typeof ISSUE_TYPE_LABELS] || item.issueType;

  // Priority left border: red for critical quick wins, amber for high severity only
  const isQuickWin = (item.finalSeverity ?? 0) >= 7 && item.easyCleanupCandidate;
  const isHighSeverity = (item.finalSeverity ?? 0) >= 7;
  const borderClass = isQuickWin
    ? 'border-l-4 border-l-[var(--color-danger)]'
    : isHighSeverity
      ? 'border-l-4 border-l-[var(--color-warning)]'
      : '';

  // Build the detail link based on source type
  const detailHref = item.kind === 'guidance'
    ? `/${jurisdiction.toLowerCase()}/pipeline/guidance/${item.guidanceDocumentId}/${item.issueType}`
    : `/${jurisdiction.toLowerCase()}/pipeline/${item.documentId}/${item.issueType}`;

  return (
    <>
      <tr
        ref={rowRef}
        className={`border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] cursor-pointer ${borderClass}${isActive ? ' ring-1 ring-inset ring-[var(--color-primary)] bg-blue-50/40' : ''}${isSelected ? ' bg-[var(--color-primary-weaker)]' : ''}${isBookmarked && markerEntry ? ' !border-b-0' : ''}`}
        onClick={(e) => {
          // Don't open drawer when clicking interactive elements (buttons, links, inputs)
          const target = e.target as HTMLElement;
          if (target.closest('a, button, [role="button"], input, textarea, [data-no-row-click]')) return;
          onRowClick(item);
        }}
      >
        {/* Checkbox */}
        <td className="px-2 py-3 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            className="w-4 h-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] cursor-pointer"
            aria-label={`Select ${issueTypeLabel}`}
          />
        </td>

        {/* Bookmark */}
        <td className="px-2 py-3 text-center">
          <BookmarkButton
            isBookmarked={isBookmarked}
            onToggle={onBookmarkToggle}
            size="sm"
          />
        </td>

        {/* Markers */}
        <td className="px-1 py-3">
          {markerEntry && (
            <div className="flex items-center gap-0.5">
              <MarkerDots markers={markerEntry.markers} />
              <MarkerPicker
                bookmarkId={markerEntry.bookmarkId}
                assignedMarkerIds={markerEntry.markers.map(m => m.id)}
                availableGroups={availableGroups}
                onToggle={onMarkerToggle}
                onCreateCustom={onCreateCustomMarker}
              />
            </div>
          )}
        </td>

        {/* Issue Type */}
        <td className="px-4 py-3">
          <Badge variant="warning" className="text-xs">
            {issueTypeLabel}
          </Badge>
        </td>

        {/* Document */}
        <td className="px-4 py-3 max-w-xs">
          {item.kind === 'guidance' ? (
            <>
              {item.agency && (
                <div className="truncate text-xs text-[var(--color-text-muted)] font-medium" title={item.agency}>
                  {item.agency}
                </div>
              )}
              <div className="truncate text-[var(--color-text)]" title={item.documentTitle || ''}>
                {item.documentTitle || 'Untitled'}
              </div>
            </>
          ) : (
            <>
              <div className="truncate text-[var(--color-text)]" title={item.documentTitle || ''}>
                {item.documentTitle || 'Untitled'}
              </div>
              {item.citation && (
                <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={item.citation}>
                  {item.citation}
                </div>
              )}
            </>
          )}
        </td>

        {/* Tier Classifications (V5: 3 tiers, T3 = web search) */}
        <td className="px-2 py-3 text-center">
          <ClassificationBadge classification={item.tier1Classification} />
        </td>
        <td className="px-2 py-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <ClassificationBadge classification={item.tier2Classification} />
            {item.rerunCount > 0 && (
              <span
                className="text-[10px] px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-medium"
                title={`Tier 2 required ${item.rerunCount} re-run(s) for additional context`}
              >
                {item.rerunCount}x rerun
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-3 text-center">
          <ClassificationBadge classification={item.tier3Classification} />
        </td>

        {/* Severity */}
        <td className="px-3 py-3 text-center">
          {item.finalSeverity !== null ? (
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                item.finalSeverity >= 7
                  ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                  : item.finalSeverity >= 4
                    ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                    : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
              }`}
            >
              {item.finalSeverity}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">{'\u2014'}</span>
          )}
        </td>

        {/* Federal Mandate */}
        <td className="px-3 py-3 text-center">
          {item.federalMandateFound ? (
            <Badge variant="danger" className="text-xs">Yes</Badge>
          ) : (
            <span className="text-[var(--color-text-muted)]">{'\u2014'}</span>
          )}
        </td>

        {/* Easy Cleanup */}
        <td className="px-3 py-3 text-center">
          {item.easyCleanupCandidate ? (
            <Badge
              variant="success"
              className="text-xs"
              title={item.cleanupType === 'alternative_in_practice'
                ? 'Alternative already accepted in practice'
                : item.cleanupType === 'alternative_authorized'
                  ? 'State has authorized alternative'
                  : 'Peer state has solution'}
            >
              {item.cleanupEffort === 'trivial' ? '\uD83C\uDFAF Trivial' :
               item.cleanupEffort === 'easy' ? '\u2728 Easy' :
               '\uD83D\uDCCB Medium'}
            </Badge>
          ) : (
            <span className="text-[var(--color-text-muted)]">{'\u2014'}</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 text-center">
          <Link
            href={detailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          >
            View
            <ExternalLink className="w-3 h-3" />
          </Link>
        </td>
      </tr>

      {/* Expanded row with markers + notes (always shown for bookmarked items) */}
      {isBookmarked && markerEntry && onSaveNotes && (
        <tr className="border-b border-[var(--color-neutral-100)]">
          <td colSpan={COLUMN_COUNT} className="px-4 pb-3 pt-0" onClick={(e) => e.stopPropagation()}>
            {/* Inline marker badges */}
            {availableGroups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {markerEntry.markers.length > 0 ? (
                  markerEntry.markers.map(m => (
                    <MarkerBadge
                      key={m.id}
                      name={m.name}
                      color={m.color}
                      size="sm"
                      onRemove={() => onMarkerToggle(markerEntry.bookmarkId, m.id, false)}
                    />
                  ))
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)] italic">No label chosen</span>
                )}
                <MarkerPicker
                  bookmarkId={markerEntry.bookmarkId}
                  assignedMarkerIds={markerEntry.markers.map(m => m.id)}
                  availableGroups={availableGroups}
                  onToggle={onMarkerToggle}
                  onCreateCustom={onCreateCustomMarker}
                />
              </div>
            )}
            {/* Notes editor */}
            <BookmarkNotesEditor
              notes={markerEntry.notes}
              onSave={onSaveNotes}
              createdBy={markerEntry.createdBy}
              showName
              defaultName={bookmarkName}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export default AnalysisTable;
