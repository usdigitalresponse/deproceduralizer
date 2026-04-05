'use client';

import { useState, useCallback, useMemo, type ComponentType } from 'react';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { Trash2, ExternalLink, FileText, ListChecks, BookOpen, DollarSign, Sparkles, AlertTriangle, Zap } from 'lucide-react';
import type { BookmarkWithDetails, JurisdictionCode } from '@deproceduralizer/database';
import { Badge, MultiSelect } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui/Badge';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { tableRowClass, tableHeaderClass } from '@/components/ui/table-styles';
import { removeBookmark, updateBookmarkNotes, getFineBookmark } from '@/lib/actions/bookmarks';
import { getFineById } from '@/lib/actions/fines';
import type { FineWithContext } from '@/lib/actions/fines';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { PENALTY_TYPE_LABELS } from '@/lib/constants/fines';
import { bookmarksParsers } from '@/lib/url/parsers';
import { FILTER_NULL_VALUE } from '@/lib/constants/values';
import type { BookmarkTabValue } from '@/lib/constants/values';
import { BookmarkNotesEditor } from './BookmarkNotesEditor';
import { FinesDetailDrawer } from '@/components/fines/FinesDetailDrawer';
import { useBookmarkName } from '@/hooks/useBookmarkName';

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

interface BookmarksContentProps {
  bookmarks: BookmarkWithDetails[];
  counts: { analysis: number; document: number; guidance: number; fine: number; total: number };
  jurisdiction: JurisdictionCode;
}

type FineSortField = 'type' | 'amount' | 'agency' | 'whoPays' | 'description' | 'by' | 'bookmarked';
type SortOrder = 'asc' | 'desc';

const FINE_SORT_OPTIONS = [
  { value: 'bookmarked', label: 'Date Marked' },
  { value: 'type', label: 'Type' },
  { value: 'amount', label: 'Amount' },
  { value: 'agency', label: 'Agency' },
  { value: 'whoPays', label: 'Who Pays' },
  { value: 'by', label: 'Marked By' },
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

export function BookmarksContent({ bookmarks, counts, jurisdiction }: BookmarksContentProps) {
  const [params, setParams] = useQueryStates(bookmarksParsers, { shallow: true });
  const activeTab = params.tab as BookmarkTabValue;
  const setActiveTab = useCallback((tab: BookmarkTabValue) => setParams({ tab }), [setParams]);
  const [localBookmarks, setLocalBookmarks] = useState(bookmarks);
  const [fineSortBy, setFineSortBy] = useState<FineSortField>('bookmarked');
  const [fineSortOrder, setFineSortOrder] = useState<SortOrder>('desc');
  const [fineFilterType, setFineFilterType] = useState<string[]>([]);
  const [fineFilterAgency, setFineFilterAgency] = useState<string[]>([]);
  const [fineFilterWhoPays, setFineFilterWhoPays] = useState<string[]>([]);
  const [fineFilterBy, setFineFilterBy] = useState<string[]>([]);
  const [fineFilterDate, setFineFilterDate] = useState<string[]>([]);
  const [drawerFine, setDrawerFine] = useState<FineWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fineCache, setFineCache] = useState<Map<number, FineWithContext>>(new Map());
  const { bookmarkName, saveBookmarkName } = useBookmarkName();

  const filteredBookmarks = useMemo(() => localBookmarks.filter(b => {
    if (activeTab === 'analysis') return b.analysisId !== null;
    if (activeTab === 'guidance') return b.guidanceDocumentId !== null && b.analysisId === null;
    if (activeTab === 'fine') return b.fineId !== null;
    return b.analysisId === null && b.guidanceDocumentId === null && b.fineId === null; // document
  }), [localBookmarks, activeTab]);

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

  const hasFineActiveFilters = fineFilterType.length > 0 || fineFilterAgency.length > 0 || fineFilterWhoPays.length > 0 || fineFilterBy.length > 0 || fineFilterDate.length > 0;

  const clearFineFilters = useCallback(() => {
    setFineFilterType([]);
    setFineFilterAgency([]);
    setFineFilterWhoPays([]);
    setFineFilterBy([]);
    setFineFilterDate([]);
  }, []);

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

  const handleRemove = useCallback(async (bookmarkId: number) => {
    setLocalBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    const result = await removeBookmark(bookmarkId);
    if (!result.success) {
      setLocalBookmarks(bookmarks);
      console.error('Failed to remove bookmark:', result.error);
    }
  }, [bookmarks]);

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
      // Sync bookmark data back to the table when drawer closes
      const result = await getFineBookmark(drawerFine.id);
      if (result.success && result.data) {
        setLocalBookmarks(prev =>
          prev.map(b => b.fineId === drawerFine.id
            ? { ...b, notes: result.data!.notes, createdBy: result.data!.createdBy }
            : b
          )
        );
      } else {
        // Bookmark was removed in the drawer
        setLocalBookmarks(prev => prev.filter(b => b.fineId !== drawerFine.id));
      }
    }
  }, [drawerFine]);

  const handleDrawerBookmarkChange = useCallback((fineId: number, bookmarked: boolean) => {
    if (!bookmarked) {
      setLocalBookmarks(prev => prev.filter(b => b.fineId !== fineId));
    }
  }, []);

  const handleSaveNotes = useCallback(async (bookmarkId: number, notes: string) => {
    const result = await updateBookmarkNotes(bookmarkId, notes);
    if (result.success) {
      setLocalBookmarks(prev =>
        prev.map(b => b.id === bookmarkId ? { ...b, notes } : b)
      );
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-[var(--color-neutral-200)]">
        <TabButton icon={ListChecks} label="Analyses" count={counts.analysis} badgeVariant="warning" isActive={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
        <TabButton icon={FileText} label="Documents" count={counts.document} badgeVariant="default" isActive={activeTab === 'document'} onClick={() => setActiveTab('document')} />
        <TabButton icon={BookOpen} label="Guidance" count={counts.guidance} badgeVariant="success" isActive={activeTab === 'guidance'} onClick={() => setActiveTab('guidance')} />
        <TabButton icon={DollarSign} label="Fines" count={counts.fine} badgeVariant="info" isActive={activeTab === 'fine'} onClick={() => setActiveTab('fine')} />
      </div>

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
            No {activeTab === 'analysis' ? 'analyses' : activeTab === 'guidance' ? 'guidance documents' : activeTab === 'fine' ? 'fines' : 'documents'} marked yet.
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {activeTab === 'analysis'
              ? 'Mark analyses from the Pipeline page to track important compliance findings'
              : activeTab === 'guidance'
                ? 'Mark guidance documents to track important policy directives'
                : activeTab === 'fine'
                  ? 'Star fines and fees from the Fines & Fees page to build your reference list'
                  : 'Star any regulation from the Browse or Detail page to save it here'}
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
                <th className={tableHeaderClass}>Notes</th>
                <th className={tableHeaderClass}>By</th>
                <th className={tableHeaderClass}>Marked</th>
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
            onSortByChange={(v) => setFineSortBy(v as FineSortField)}
            onSortOrderToggle={() => setFineSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            hasActiveFilters={hasFineActiveFilters}
            onClearFilters={clearFineFilters}
          >
            <FilterField label="Type">
              <MultiSelect
                label="Type"
                value={fineFilterType}
                onChange={setFineFilterType}
                options={typeFilterOptions}
                placeholder="All Types"
              />
            </FilterField>
            <FilterField label="Agency">
              <MultiSelect
                label="Agency"
                value={fineFilterAgency}
                onChange={setFineFilterAgency}
                options={agencyFilterOptions}
                placeholder="All Agencies"
              />
            </FilterField>
            <FilterField label="Who Pays">
              <MultiSelect
                label="Who Pays"
                value={fineFilterWhoPays}
                onChange={setFineFilterWhoPays}
                options={whoPaysFilterOptions}
                placeholder="All"
              />
            </FilterField>
            <FilterField label="By">
              <MultiSelect
                label="By"
                value={fineFilterBy}
                onChange={setFineFilterBy}
                options={byFilterOptions}
                placeholder="All"
              />
            </FilterField>
            <FilterField label="Date">
              <MultiSelect
                label="Date"
                value={fineFilterDate}
                onChange={setFineFilterDate}
                options={dateFilterOptions}
                placeholder="All Dates"
              />
            </FilterField>
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
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">By</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Marked</th>
                    <th className="text-right px-3 py-3 font-medium text-[var(--color-text-muted)]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFineBookmarks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
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
                <th className={tableHeaderClass}>Notes</th>
                <th className={tableHeaderClass}>By</th>
                <th className={tableHeaderClass}>Marked</th>
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
    </div>
  );
}

// Analysis bookmark card - shows all the detailed info
interface AnalysisBookmarkCardProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
}

function AnalysisBookmarkCard({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
}: AnalysisBookmarkCardProps) {
  const issueTypeLabel = bookmark.issueType
    ? ISSUE_TYPE_LABELS[bookmark.issueType as keyof typeof ISSUE_TYPE_LABELS] || bookmark.issueType
    : null;

  const isGuidanceAnalysis = bookmark.guidanceDocumentId !== null && bookmark.documentId === null;
  const viewUrl = isGuidanceAnalysis
    ? `/${jurisdiction.toLowerCase()}/pipeline/guidance/${bookmark.guidanceDocumentId}/${bookmark.issueType}`
    : `/${jurisdiction.toLowerCase()}/pipeline/${bookmark.documentId}/${bookmark.issueType}`;

  // Use final severity if available, fallback to base severity
  const severity = bookmark.analysisFinalSeverity ?? bookmark.analysisSeverity;

  // Use tier3 classification if available, fallback to tier2
  const classification = bookmark.analysisTier3Classification || bookmark.analysisClassification;

  // Format cleanup effort
  const cleanupEffortLabel = bookmark.cleanupEffort === 'trivial' ? 'Trivial'
    : bookmark.cleanupEffort === 'easy' ? 'Easy'
    : bookmark.cleanupEffort === 'medium' ? 'Medium'
    : bookmark.cleanupEffort;

  // Format cleanup type
  const cleanupTypeLabel = bookmark.cleanupType === 'alternative_in_practice'
    ? 'Alternative in Practice'
    : bookmark.cleanupType === 'alternative_authorized'
    ? 'State Authorized Alternative'
    : bookmark.cleanupType === 'peer_state_solution'
    ? 'Peer State Has Solution'
    : bookmark.cleanupType;

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Easy Fix Banner */}
      {bookmark.easyCleanupCandidate && (
        <div className="bg-[var(--color-success-bg)] px-4 py-2 flex items-center gap-3 border-b border-[var(--color-success)]">
          <Sparkles className="w-5 h-5 text-[var(--color-success)]" />
          <span className="text-sm font-medium text-[var(--color-success)]">
            Easy Cleanup Opportunity
          </span>
          {cleanupEffortLabel && (
            <Badge variant="success" className="text-xs">
              {cleanupEffortLabel} Fix
            </Badge>
          )}
          {cleanupTypeLabel && (
            <span className="text-xs text-[var(--color-success)]">
              {cleanupTypeLabel}
            </span>
          )}
        </div>
      )}

      {/* Federal Mandate Banner */}
      {bookmark.federalMandateFound && !bookmark.easyCleanupCandidate && (
        <div className="bg-[var(--color-danger-bg)] px-4 py-2 flex items-center gap-3 border-b border-[var(--color-danger)]">
          <AlertTriangle className="w-5 h-5 text-[var(--color-danger)]" />
          <span className="text-sm font-medium text-[var(--color-danger)]">
            Federal Mandate Found
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Top row: Badges and Actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Issue Type */}
            {issueTypeLabel && (
              <Badge variant="warning" className="text-xs">
                {issueTypeLabel}
              </Badge>
            )}

            {/* Tier Progress */}
            {bookmark.highestTierCompleted !== null && (
              <Badge variant="default" className="text-xs">
                Tier {bookmark.highestTierCompleted}
              </Badge>
            )}

            {/* Classification */}
            {classification && (
              <Badge
                variant={classification === 'burdensome' ? 'danger' : classification === 'justified' ? 'success' : 'default'}
                className="text-xs capitalize"
              >
                {classification}
              </Badge>
            )}

            {/* Federal Mandate (small badge if easy fix banner is showing) */}
            {bookmark.federalMandateFound && bookmark.easyCleanupCandidate && (
              <Badge variant="danger" className="text-xs">
                Federal
              </Badge>
            )}

            {/* Severity */}
            {severity !== null && (
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  severity >= 7
                    ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                    : severity >= 4
                      ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                      : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                }`}
                title={`Severity: ${severity}/10`}
              >
                {severity}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-weaker)] hover:bg-[var(--color-primary-weak)] rounded transition-colors"
            >
              View Analysis
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={onRemove}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
              aria-label="Unsave"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Title and Citation */}
        <div className="mb-3">
          {isGuidanceAnalysis ? (
            <>
              {bookmark.guidanceAgency && (
                <p className="text-xs text-[var(--color-text-muted)] font-medium">{bookmark.guidanceAgency}</p>
              )}
              <h3 className="font-medium text-[var(--color-text)]" title={bookmark.guidanceTitle || ''}>
                {bookmark.guidanceTitle || 'Untitled Document'}
              </h3>
              {bookmark.guidanceCanonicalRef && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                  {bookmark.guidanceCanonicalRef}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 className="font-medium text-[var(--color-text)]" title={bookmark.documentTitle || ''}>
                {bookmark.documentTitle || 'Untitled Document'}
              </h3>
              {bookmark.documentCitation && (
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">
                  {bookmark.documentCitation}
                </p>
              )}
            </>
          )}
        </div>

        {/* Tier 3 Trigger Reason (if available) */}
        {bookmark.tier3TriggerReason && (
          <div className="mb-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-medium">Escalated to Tier 3:</span> {bookmark.tier3TriggerReason}
            </span>
          </div>
        )}

        {/* Notes */}
        <div className="pt-3 border-t border-[var(--color-neutral-100)]">
          <div className="flex items-center justify-between gap-2">
            <BookmarkNotesEditor notes={bookmark.notes} onSave={onSaveNotes} />
            <div className="flex items-center gap-2 shrink-0">
              {bookmark.createdBy && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {bookmark.createdBy}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-muted)]">
                {bookmark.createdAt
                  ? new Date(bookmark.createdAt).toLocaleDateString()
                  : ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple document bookmark row
interface DocumentBookmarkRowProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
}

function DocumentBookmarkRow({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
}: DocumentBookmarkRowProps) {
  if (!bookmark.documentId) return null;
  const viewUrl = `/${jurisdiction.toLowerCase()}/regulations/${bookmark.documentId}`;

  return (
    <tr className={tableRowClass}>
      {/* Document */}
      <td className="px-4 py-3 max-w-xs">
        <div className="truncate text-[var(--color-text)]" title={bookmark.documentTitle || ''}>
          {bookmark.documentTitle || 'Untitled'}
        </div>
        {bookmark.documentCitation && (
          <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={bookmark.documentCitation}>
            {bookmark.documentCitation}
          </div>
        )}
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        <BookmarkNotesEditor notes={bookmark.notes} onSave={onSaveNotes} compact />
      </td>

      {/* By */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.createdBy || '-'}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.createdAt
          ? new Date(bookmark.createdAt).toLocaleDateString()
          : '-'}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          >
            View
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            onClick={onRemove}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
            aria-label="Unsave"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Guidance document bookmark row
interface GuidanceBookmarkRowProps {
  bookmark: BookmarkWithDetails;
  jurisdiction: JurisdictionCode;
  onSaveNotes: (notes: string) => Promise<void>;
  onRemove: () => void;
}

function GuidanceBookmarkRow({
  bookmark,
  jurisdiction,
  onSaveNotes,
  onRemove,
}: GuidanceBookmarkRowProps) {
  const viewUrl = `/${jurisdiction.toLowerCase()}/guidance/${bookmark.guidanceDocumentId}`;

  return (
    <tr className={tableRowClass}>
      {/* Title & Ref */}
      <td className="px-4 py-3 max-w-xs">
        <div className="truncate text-[var(--color-text)]" title={bookmark.guidanceTitle || ''}>
          {bookmark.guidanceTitle || 'Untitled'}
        </div>
        {bookmark.guidanceCanonicalRef && (
          <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={bookmark.guidanceCanonicalRef}>
            {bookmark.guidanceCanonicalRef}
          </div>
        )}
      </td>

      {/* Agency */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.guidanceAgency || '-'}
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        <BookmarkNotesEditor notes={bookmark.notes} onSave={onSaveNotes} compact />
      </td>

      {/* By */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.createdBy || '-'}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {bookmark.createdAt
          ? new Date(bookmark.createdAt).toLocaleDateString()
          : '-'}
      </td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          >
            View
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            onClick={onRemove}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
            aria-label="Unsave"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Fine bookmark row
interface FineBookmarkRowProps {
  bookmark: BookmarkWithDetails;
  onRowClick: () => void;
  onSaveNotes: (notes: string, createdBy?: string) => Promise<void>;
  onRemove: () => void;
  bookmarkName: string;
}

function FineBookmarkRow({
  bookmark,
  onRowClick,
  onSaveNotes,
  onRemove,
  bookmarkName,
}: FineBookmarkRowProps) {
  if (!bookmark.fineId) return null;

  return (
    <>
      <tr
        onClick={onRowClick}
        className="cursor-pointer hover:bg-[var(--color-neutral-50)] transition-colors"
      >
        {/* Type */}
        <td className="px-4 py-3">
          <span className="text-xs font-medium">
            {bookmark.finePenaltyType
              ? (PENALTY_TYPE_LABELS[bookmark.finePenaltyType] || bookmark.finePenaltyType)
              : '-'}
          </span>
        </td>

        {/* Amount */}
        <td className="px-4 py-3 text-sm font-medium text-[var(--color-text)]">
          {bookmark.fineAmount || '-'}
        </td>

        {/* Agency */}
        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] max-w-[150px] truncate">
          {bookmark.fineAgencyCanonicalName || '-'}
        </td>

        {/* Description */}
        <td className="px-4 py-3 max-w-[200px]">
          <div className="truncate text-xs text-[var(--color-text-secondary)]" title={bookmark.fineViolationDescription || ''}>
            {bookmark.fineViolationDescription || '-'}
          </div>
        </td>

        {/* By */}
        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
          {bookmark.createdBy || '-'}
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
          {bookmark.createdAt
            ? new Date(bookmark.createdAt).toLocaleDateString()
            : '-'}
        </td>

        {/* Actions */}
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onRemove}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded"
              aria-label="Unsave"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      <tr className="border-b border-[var(--color-neutral-100)]">
        <td colSpan={7} className="px-4 pb-3 pt-0" onClick={(e) => e.stopPropagation()}>
          <BookmarkNotesEditor
            notes={bookmark.notes}
            onSave={onSaveNotes}
            createdBy={bookmark.createdBy}
            showName
            defaultName={bookmarkName}
          />
        </td>
      </tr>
    </>
  );
}

export default BookmarksContent;
