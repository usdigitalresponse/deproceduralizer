'use client';

import { useState, useCallback, useMemo, type ComponentType } from 'react';
import { useQueryStates } from 'nuqs';
import { FileText, ListChecks, BookOpen, DollarSign, Sparkles, AlertTriangle, Settings, Tag } from 'lucide-react';
import type { BookmarkWithDetails, MarkerGroup, JurisdictionCode } from '@deproceduralizer/database';
import { Badge, MultiSelect } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui/Badge';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { tableHeaderClass } from '@/components/ui/table-styles';
import { updateBookmarkNotes, getFineBookmark, getMarkersForBookmark } from '@/lib/actions/bookmarks';
import { getFineById } from '@/lib/actions/fines';
import type { FineWithContext } from '@/lib/actions/fines';
import { PENALTY_TYPE_LABELS } from '@/lib/constants/fines';
import { markersParsers } from '@/lib/url/parsers';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';
import { FILTER_NULL_VALUE } from '@/lib/constants/values';
import type { MarkerTabValue } from '@/lib/constants/values';
import { useMarkerMutations } from '@/hooks/useMarkerMutations';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import { AnalysisBookmarkCard } from './AnalysisBookmarkCard';
import { DocumentBookmarkRow } from './DocumentBookmarkRow';
import { GuidanceBookmarkRow } from './GuidanceBookmarkRow';
import { FineBookmarkRow } from './FineBookmarkRow';
import { MarkerGroupManager } from './MarkerGroupManager';
import { FinesDetailDrawer } from '@/components/fines/FinesDetailDrawer';

function TabButton({
  icon: Icon,
  label,
  count,
  badgeVariant = 'default',
  isActive,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count: number;
  badgeVariant?: BadgeVariant;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 -mb-px text-sm font-medium transition-colors
        ${isActive
          ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      <Badge variant={badgeVariant} className="text-xs ml-1">
        {count}
      </Badge>
    </button>
  );
}

interface MarkersContentProps {
  bookmarks: BookmarkWithDetails[];
  counts: { analysis: number; document: number; guidance: number; fine: number; total: number };
  jurisdiction: JurisdictionCode;
  markerGroups: MarkerGroup[];
}

type FineSortField = 'type' | 'amount' | 'agency' | 'whoPays' | 'description' | 'by' | 'bookmarked';
type SortOrder = 'asc' | 'desc';

const FINE_SORT_OPTIONS = [
  { value: 'bookmarked', label: 'Date Saved' },
  { value: 'type', label: 'Type' },
  { value: 'amount', label: 'Amount' },
  { value: 'agency', label: 'Agency' },
  { value: 'whoPays', label: 'Who Pays' },
  { value: 'by', label: 'Saved By' },
];

function parseAmount(amount: string | null): number {
  if (!amount) return 0;
  const cleaned = amount.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function getDateThresholds() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    today,
    weekAgo: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
    monthAgo: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
  };
}

function classifyDate(d: Date | null, thresholds: ReturnType<typeof getDateThresholds>): string {
  if (!d) return 'older';
  if (d >= thresholds.today) return 'today';
  if (d >= thresholds.weekAgo) return 'week';
  if (d >= thresholds.monthAgo) return 'month';
  return 'older';
}

export function MarkersContent({ bookmarks, counts, jurisdiction, markerGroups }: MarkersContentProps) {
  const [params, setParams] = useQueryStates(markersParsers, { shallow: true });
  const activeTab = params.tab as MarkerTabValue;
  const setActiveTab = useCallback((tab: MarkerTabValue) => setParams({ tab }), [setParams]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [drawerFine, setDrawerFine] = useState<FineWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fineCache, setFineCache] = useState<Map<number, FineWithContext>>(new Map());
  const { bookmarkName, saveBookmarkName } = useBookmarkName();

  const {
    localBookmarks, setLocalBookmarks,
    localGroups,
    handleRemove, handleSaveNotes, handleMarkerToggle, handleCreateCustomMarker,
    handleCreateGroup, handleUpdateGroup, handleDeleteGroup,
    handleDeleteGroupAndUnmarkAll, handleReorderGroups,
  } = useMarkerMutations({ bookmarks, markerGroups, jurisdiction });

  // Fine-tab filters from URL state
  const fineSortBy = (params.mFineSortBy || 'bookmarked') as FineSortField;
  const fineSortOrder = (params.mFineSortOrder || 'desc') as SortOrder;
  const fineFilterType = parseCommaSeparated(params.mFineType);
  const fineFilterAgency = parseCommaSeparated(params.mFineAgency);
  const fineFilterWhoPays = parseCommaSeparated(params.mFineWhoPays);
  const fineFilterBy = parseCommaSeparated(params.mFineBy);
  const fineFilterDate = parseCommaSeparated(params.mFineDate);
  const selectedCategoryFilter = parseCommaSeparated(params.mCategory);

  const filteredBookmarks = useMemo(() => {
    let result = localBookmarks.filter(b => {
      if (activeTab === 'analysis') return b.analysisId !== null;
      if (activeTab === 'guidance') return b.guidanceDocumentId !== null && b.analysisId === null;
      if (activeTab === 'fine') return b.fineId !== null;
      return b.analysisId === null && b.guidanceDocumentId === null && b.fineId === null; // document
    });

    // Apply category filter across all tabs
    if (selectedCategoryFilter.length > 0) {
      const filterIds = selectedCategoryFilter.map(Number);
      result = result.filter(b => b.markers.some(m => filterIds.includes(m.id)));
    }

    return result;
  }, [localBookmarks, activeTab, selectedCategoryFilter]);

  // Build category filter options from marker groups that are actually assigned to bookmarks
  const categoryFilterOptions = useMemo(() => {
    // Get all marker IDs assigned across bookmarks in the current tab (before category filtering)
    const tabBookmarks = localBookmarks.filter(b => {
      if (activeTab === 'analysis') return b.analysisId !== null;
      if (activeTab === 'guidance') return b.guidanceDocumentId !== null && b.analysisId === null;
      if (activeTab === 'fine') return b.fineId !== null;
      return b.analysisId === null && b.guidanceDocumentId === null && b.fineId === null;
    });
    const assignedIds = new Set<number>();
    for (const b of tabBookmarks) {
      for (const m of b.markers) {
        assignedIds.add(m.id);
      }
    }
    return localGroups
      .filter(g => assignedIds.has(g.id))
      .map(g => ({ value: String(g.id), label: g.name }));
  }, [localBookmarks, activeTab, localGroups]);

  // Derive filter options from tab-filtered bookmarks (before dropdown filtering)
  const typeFilterOptions = useMemo(() => {
    const unique = [...new Set(filteredBookmarks.map(b => b.finePenaltyType).filter(Boolean))] as string[];
    return unique.sort().map(t => ({ value: t, label: PENALTY_TYPE_LABELS[t] || t }));
  }, [filteredBookmarks]);

  const agencyFilterOptions = useMemo(() => {
    const unique = [...new Set(filteredBookmarks.map(b => b.fineAgencyCanonicalName).filter(Boolean))] as string[];
    return unique.sort().map(a => ({ value: a, label: a }));
  }, [filteredBookmarks]);

  const whoPaysFilterOptions = useMemo(() => {
    const unique = [...new Set(filteredBookmarks.map(b => b.fineWhoPays).filter(Boolean))] as string[];
    return unique.sort().map(w => ({ value: w, label: w }));
  }, [filteredBookmarks]);

  const byFilterOptions = useMemo(() => {
    const hasNull = filteredBookmarks.some(b => !b.createdBy);
    const unique = [...new Set(filteredBookmarks.map(b => b.createdBy).filter(Boolean))] as string[];
    const options = unique.sort().map(name => ({ value: name, label: name }));
    if (hasNull) {
      options.push({ value: FILTER_NULL_VALUE, label: 'Unattributed' });
    }
    return options;
  }, [filteredBookmarks]);

  const dateFilterOptions = useMemo(() => {
    const thresholds = getDateThresholds();
    const counts: Record<string, number> = { today: 0, week: 0, month: 0, older: 0 };

    for (const b of filteredBookmarks) {
      const d = b.createdAt ? new Date(b.createdAt) : null;
      counts[classifyDate(d, thresholds)]++;
    }

    const labels: Record<string, string> = { today: 'Today', week: 'This Week', month: 'This Month', older: 'Older' };
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([value, count]) => ({ value, label: labels[value], count }));
  }, [filteredBookmarks]);

  const hasFineActiveFilters = fineFilterType.length > 0 || fineFilterAgency.length > 0 || fineFilterWhoPays.length > 0 || fineFilterBy.length > 0 || fineFilterDate.length > 0 || selectedCategoryFilter.length > 0;

  const clearFineFilters = useCallback(() => {
    setParams({
      mFineType: null, mFineAgency: null, mFineWhoPays: null,
      mFineBy: null, mFineDate: null, mCategory: null,
    });
  }, [setParams]);

  // Apply dropdown filters, then sort
  const sortedFineBookmarks = useMemo(() => {
    if (activeTab !== 'fine') return filteredBookmarks;

    let result = filteredBookmarks;
    if (fineFilterType.length > 0) {
      result = result.filter(b => b.finePenaltyType && fineFilterType.includes(b.finePenaltyType));
    }
    if (fineFilterAgency.length > 0) {
      result = result.filter(b => b.fineAgencyCanonicalName && fineFilterAgency.includes(b.fineAgencyCanonicalName));
    }
    if (fineFilterWhoPays.length > 0) {
      result = result.filter(b => b.fineWhoPays && fineFilterWhoPays.includes(b.fineWhoPays));
    }
    if (fineFilterBy.length > 0) {
      result = result.filter(b => {
        if (!b.createdBy) return fineFilterBy.includes(FILTER_NULL_VALUE);
        return fineFilterBy.includes(b.createdBy);
      });
    }
    if (fineFilterDate.length > 0) {
      const thresholds = getDateThresholds();
      result = result.filter(b => {
        const d = b.createdAt ? new Date(b.createdAt) : null;
        return fineFilterDate.includes(classifyDate(d, thresholds));
      });
    }

    const sorted = [...result];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (fineSortBy) {
        case 'type': {
          const aLabel = a.finePenaltyType ? (PENALTY_TYPE_LABELS[a.finePenaltyType] || a.finePenaltyType) : '';
          const bLabel = b.finePenaltyType ? (PENALTY_TYPE_LABELS[b.finePenaltyType] || b.finePenaltyType) : '';
          cmp = aLabel.localeCompare(bLabel);
          break;
        }
        case 'amount':
          cmp = parseAmount(a.fineAmount) - parseAmount(b.fineAmount);
          break;
        case 'agency': {
          const aAgency = a.fineAgencyCanonicalName || '';
          const bAgency = b.fineAgencyCanonicalName || '';
          cmp = aAgency.localeCompare(bAgency);
          break;
        }
        case 'whoPays': {
          const aWho = a.fineWhoPays || '';
          const bWho = b.fineWhoPays || '';
          cmp = aWho.localeCompare(bWho);
          break;
        }
        case 'description': {
          const aDesc = a.fineViolationDescription || '';
          const bDesc = b.fineViolationDescription || '';
          cmp = aDesc.localeCompare(bDesc);
          break;
        }
        case 'by': {
          const aBy = a.createdBy || '';
          const bBy = b.createdBy || '';
          cmp = aBy.localeCompare(bBy);
          break;
        }
        case 'bookmarked': {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return fineSortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredBookmarks, fineSortBy, fineSortOrder, activeTab, fineFilterType, fineFilterAgency, fineFilterWhoPays, fineFilterBy, fineFilterDate]);

  // Count easy fixes and federal mandates for summary
  const easyFixCount = filteredBookmarks.filter(b => b.easyCleanupCandidate).length;
  const federalCount = filteredBookmarks.filter(b => b.federalMandateFound).length;

  const handleOpenFineDrawer = useCallback(async (fineId: number) => {
    const cached = fineCache.get(fineId);
    if (cached) {
      setDrawerFine(cached);
      setDrawerOpen(true);
      return;
    }
    const result = await getFineById(fineId);
    if (result.success && result.data) {
      setFineCache(prev => new Map(prev).set(fineId, result.data!));
      setDrawerFine(result.data);
      setDrawerOpen(true);
    }
  }, [fineCache]);

  const handleDrawerOpenChange = useCallback(async (open: boolean) => {
    setDrawerOpen(open);
    if (!open && drawerFine) {
      // Sync bookmark data (notes + markers) back to the table when drawer closes
      const [bookmarkResult, markersResult] = await Promise.all([
        getFineBookmark(drawerFine.id),
        getMarkersForBookmark(
          localBookmarks.find(b => b.fineId === drawerFine.id)?.id ?? -1
        ),
      ]);
      if (bookmarkResult.success && bookmarkResult.data) {
        const newMarkers = markersResult.success ? markersResult.data : [];
        setLocalBookmarks(prev =>
          prev.map(b => b.fineId === drawerFine.id
            ? { ...b, notes: bookmarkResult.data!.notes, createdBy: bookmarkResult.data!.createdBy, markers: newMarkers }
            : b
          )
        );
      } else {
        // Bookmark was removed in the drawer
        setLocalBookmarks(prev => prev.filter(b => b.fineId !== drawerFine.id));
      }
    }
  }, [drawerFine, localBookmarks]);

  const handleDrawerBookmarkChange = useCallback((fineId: number, bookmarked: boolean) => {
    if (!bookmarked) {
      setLocalBookmarks(prev => prev.filter(b => b.fineId !== fineId));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Buttons + Manage Button */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex gap-2 border-b border-[var(--color-neutral-200)] flex-1">
          <TabButton icon={ListChecks} label="Analyses" count={counts.analysis} badgeVariant="warning" isActive={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
          <TabButton icon={FileText} label="Documents" count={counts.document} badgeVariant="default" isActive={activeTab === 'document'} onClick={() => setActiveTab('document')} />
          <TabButton icon={BookOpen} label="Guidance" count={counts.guidance} badgeVariant="success" isActive={activeTab === 'guidance'} onClick={() => setActiveTab('guidance')} />
          <TabButton icon={DollarSign} label="Fines" count={counts.fine} badgeVariant="info" isActive={activeTab === 'fine'} onClick={() => setActiveTab('fine')} />
        </div>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="
            inline-flex items-center gap-1.5
            px-3 py-1.5 mb-1
            text-xs font-medium
            text-[var(--color-text-secondary)]
            hover:text-[var(--color-primary)]
            hover:bg-[var(--color-neutral-100)]
            rounded-[var(--radius-sm)]
            transition-colors duration-[var(--duration-fast)]
            cursor-pointer
          "
        >
          <Settings className="w-3.5 h-3.5" />
          Manage Labels
        </button>
      </div>

      {/* Category Filter Chips */}
      {categoryFilterOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            Labels:
          </span>
          {localGroups.map(group => {
            const isSelected = selectedCategoryFilter.includes(String(group.id));
            // Only show groups that have bookmarks in this tab
            if (!categoryFilterOptions.some(o => o.value === String(group.id))) return null;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  const updated = isSelected
                    ? selectedCategoryFilter.filter(id => id !== String(group.id))
                    : [...selectedCategoryFilter, String(group.id)];
                  setParams({ mCategory: serializeCommaSeparated(updated) });
                }}
                className={`
                  inline-flex items-center gap-1.5
                  px-2.5 py-1 rounded-full
                  text-xs font-medium
                  border transition-colors duration-[var(--duration-fast)]
                  cursor-pointer
                  ${isSelected
                    ? 'bg-[var(--color-primary-weaker)] border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-neutral-50)] border-[var(--color-neutral-200)] text-[var(--color-text-secondary)] hover:border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)]'
                  }
                `}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                {group.name}
              </button>
            );
          })}
          {selectedCategoryFilter.length > 0 && (
            <button
              type="button"
              onClick={() => setParams({ mCategory: null })}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] underline cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Summary Stats (Analysis tab only) */}
      {activeTab === 'analysis' && filteredBookmarks.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          {easyFixCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-full">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">{easyFixCount} Easy Fix{easyFixCount !== 1 ? 'es' : ''}</span>
            </div>
          )}
          {federalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded-full">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{federalCount} Federal Mandate{federalCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Bookmarks List */}
      {filteredBookmarks.length === 0 ? (
        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            No {activeTab === 'analysis' ? 'analyses' : activeTab === 'guidance' ? 'guidance documents' : activeTab === 'fine' ? 'fines' : 'documents'} saved yet.
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {activeTab === 'analysis'
              ? 'Save analyses from the Pipeline page to track important compliance findings'
              : activeTab === 'guidance'
                ? 'Save guidance documents to track important policy directives'
                : activeTab === 'fine'
                  ? 'Save fines and fees from the Fines & Fees page to build your reference list'
                  : 'Save any regulation from the Browse or Detail page to add it here'}
          </p>
        </div>
      ) : activeTab === 'analysis' ? (
        // Card-based layout for analyses (more info to show)
        <div className="space-y-4">
          {filteredBookmarks.map((bookmark) => (
            <AnalysisBookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              jurisdiction={jurisdiction}
              onSaveNotes={(notes) => handleSaveNotes(bookmark.id, notes)}
              onRemove={() => handleRemove(bookmark.id)}
              availableGroups={localGroups}
              onMarkerToggle={handleMarkerToggle}
              onCreateCustomMarker={handleCreateCustomMarker}
            />
          ))}
        </div>
      ) : activeTab === 'guidance' ? (
        // Table layout for guidance documents
        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className={tableHeaderClass}>Guidance Document</th>
                <th className={tableHeaderClass}>Agency</th>
                <th className={tableHeaderClass}>Labels</th>
                <th className={tableHeaderClass}>Notes</th>
                <th className={tableHeaderClass}>By</th>
                <th className={tableHeaderClass}>Saved</th>
                <th className={`${tableHeaderClass} !text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookmarks.map((bookmark) => (
                <GuidanceBookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  jurisdiction={jurisdiction}
                  onSaveNotes={(notes) => handleSaveNotes(bookmark.id, notes)}
                  onRemove={() => handleRemove(bookmark.id)}
                  availableGroups={localGroups}
                  onMarkerToggle={handleMarkerToggle}
                  onCreateCustomMarker={handleCreateCustomMarker}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : activeTab === 'fine' ? (
        // Table layout for fines with filters
        <div className="space-y-4">
          <FilterBar
            showSortControls
            sortBy={fineSortBy}
            sortOrder={fineSortOrder}
            sortOptions={FINE_SORT_OPTIONS}
            onSortByChange={(v) => setParams({ mFineSortBy: v })}
            onSortOrderToggle={() => setParams({ mFineSortOrder: fineSortOrder === 'asc' ? 'desc' : 'asc' })}
            hasActiveFilters={hasFineActiveFilters}
            onClearFilters={clearFineFilters}
          >
            <FilterField label="Type">
              <MultiSelect
                label="Type"
                value={fineFilterType}
                onChange={(v) => setParams({ mFineType: serializeCommaSeparated(v) })}
                options={typeFilterOptions}
                placeholder="All Types"
              />
            </FilterField>
            <FilterField label="Agency">
              <MultiSelect
                label="Agency"
                value={fineFilterAgency}
                onChange={(v) => setParams({ mFineAgency: serializeCommaSeparated(v) })}
                options={agencyFilterOptions}
                placeholder="All Agencies"
              />
            </FilterField>
            <FilterField label="Who Pays">
              <MultiSelect
                label="Who Pays"
                value={fineFilterWhoPays}
                onChange={(v) => setParams({ mFineWhoPays: serializeCommaSeparated(v) })}
                options={whoPaysFilterOptions}
                placeholder="All"
              />
            </FilterField>
            <FilterField label="By">
              <MultiSelect
                label="By"
                value={fineFilterBy}
                onChange={(v) => setParams({ mFineBy: serializeCommaSeparated(v) })}
                options={byFilterOptions}
                placeholder="All"
              />
            </FilterField>
            <FilterField label="Date">
              <MultiSelect
                label="Date"
                value={fineFilterDate}
                onChange={(v) => setParams({ mFineDate: serializeCommaSeparated(v) })}
                options={dateFilterOptions}
                placeholder="All Dates"
              />
            </FilterField>
            {categoryFilterOptions.length > 0 && (
              <FilterField label="Label">
                <MultiSelect
                  label="Label"
                  value={selectedCategoryFilter}
                  onChange={(v) => setParams({ mCategory: serializeCommaSeparated(v) })}
                  options={categoryFilterOptions}
                  placeholder="All Labels"
                />
              </FilterField>
            )}
          </FilterBar>
          <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Agency</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Labels</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">By</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Saved</th>
                    <th className="text-right px-3 py-3 font-medium text-[var(--color-text-muted)]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFineBookmarks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                        No fines match the current filters.
                      </td>
                    </tr>
                  ) : sortedFineBookmarks.map((bookmark) => (
                    <FineBookmarkRow
                      key={bookmark.id}
                      bookmark={bookmark}
                      onRowClick={() => bookmark.fineId && handleOpenFineDrawer(bookmark.fineId)}
                      onSaveNotes={async (notes, createdBy) => {
                        if (createdBy) saveBookmarkName(createdBy);
                        const result = await updateBookmarkNotes(bookmark.id, notes, createdBy);
                        if (result.success) {
                          setLocalBookmarks(prev =>
                            prev.map(b => b.id === bookmark.id
                              ? { ...b, notes, createdBy: createdBy ?? b.createdBy }
                              : b
                            )
                          );
                        }
                      }}
                      onRemove={() => handleRemove(bookmark.id)}
                      bookmarkName={bookmarkName}
                      availableGroups={localGroups}
                      onMarkerToggle={handleMarkerToggle}
                      onCreateCustomMarker={handleCreateCustomMarker}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // Simple table for documents
        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <th className={tableHeaderClass}>Document</th>
                <th className={tableHeaderClass}>Labels</th>
                <th className={tableHeaderClass}>Notes</th>
                <th className={tableHeaderClass}>By</th>
                <th className={tableHeaderClass}>Saved</th>
                <th className={`${tableHeaderClass} !text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookmarks.map((bookmark) => (
                <DocumentBookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  jurisdiction={jurisdiction}
                  onSaveNotes={(notes) => handleSaveNotes(bookmark.id, notes)}
                  onRemove={() => handleRemove(bookmark.id)}
                  availableGroups={localGroups}
                  onMarkerToggle={handleMarkerToggle}
                  onCreateCustomMarker={handleCreateCustomMarker}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Fines detail drawer */}
      <FinesDetailDrawer
        fine={drawerFine}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        state={jurisdiction.toLowerCase()}
        onBookmarkChange={handleDrawerBookmarkChange}
      />

      {/* Marker Group Manager dialog */}
      <MarkerGroupManager
        groups={localGroups}
        jurisdiction={jurisdiction}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onDeleteGroupAndUnmarkAll={handleDeleteGroupAndUnmarkAll}
        onReorder={handleReorderGroups}
        open={managerOpen}
        onOpenChange={setManagerOpen}
      />
    </div>
  );
}

export default MarkersContent;
