'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryStates } from 'nuqs';
import { Download, FileArchive, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { MultiSelect } from '@/components/ui';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { FinesTable } from './FinesTable';
import { FinesDetailDrawer } from './FinesDetailDrawer';
import { getFinesPaginated, exportFinesCsv, exportFinesZipByAgency } from '@/lib/actions/fines';
import { getFineBookmarksWithNotes, toggleFineBookmark, updateBookmarkNotes } from '@/lib/actions/bookmarks';
import type { FineBookmarkInfo } from '@/lib/actions/bookmarks';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import type { AgencyOption } from '@/lib/actions/fines';
import { finesParsers } from '@/lib/url/parsers';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';
import { SOURCE_TYPE_LABELS, PENALTY_TYPE_MULTISELECT_OPTIONS, AGENCY_LEVEL_MULTISELECT_OPTIONS, FINES_CLASSIFICATION_OPTIONS } from '@/lib/constants/fines';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { FineWithContext, FinesOverviewStats } from '@/lib/actions/fines';

interface FinesBrowseTabProps {
  jurisdiction: JurisdictionCode;
  agencies: AgencyOption[];
  whoPaysValues: string[];
  perUnitValues: string[];
  stats: FinesOverviewStats | null;
}

const sortOptions = [
  { value: 'createdAt', label: 'Date Added' },
  { value: 'penaltyType', label: 'Type' },
  { value: 'amount', label: 'Amount' },
  { value: 'responsibleAgency', label: 'Agency' },
];

const sourceTypeOptions = [
  { value: 'all', label: 'All Sources' },
  ...Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const classificationOptions = FINES_CLASSIFICATION_OPTIONS.map(o => ({ value: o.value, label: o.label }));

export function FinesBrowseTab({ jurisdiction, agencies, whoPaysValues, perUnitValues, stats }: FinesBrowseTabProps) {
  const [params, setParams] = useQueryStates(finesParsers, { shallow: true });
  const [data, setData] = useState<FineWithContext[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'zip' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFine, setSelectedFine] = useState<FineWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportStateOnly, setExportStateOnly] = useState(true);
  const [fineBookmarks, setFineBookmarks] = useState<Map<number, FineBookmarkInfo>>(new Map());
  const bookmarkedIds = useMemo(() => new Set(fineBookmarks.keys()), [fineBookmarks]);
  const { bookmarkName } = useBookmarkName();

  // Parse URL state for multi-select filters
  const selectedPenaltyTypes = useMemo(() => parseCommaSeparated(params.penaltyType), [params.penaltyType]);
  const selectedAgencies = useMemo(() => parseCommaSeparated(params.agency), [params.agency]);
  const selectedAgencyLevels = useMemo(() => parseCommaSeparated(params.agencyLevel), [params.agencyLevel]);
  const selectedWhoPays = useMemo(() => parseCommaSeparated(params.whoPays), [params.whoPays]);
  const selectedPerUnits = useMemo(() => parseCommaSeparated(params.perUnit), [params.perUnit]);

  // Build option arrays with counts from stats
  const penaltyTypeOptions = useMemo(() => {
    const countMap = new Map(stats?.byType?.map(d => [d.type, d.count]) ?? []);
    return PENALTY_TYPE_MULTISELECT_OPTIONS.map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [stats?.byType]);

  const agencyOptions = useMemo(() => {
    const countMap = new Map(stats?.byAgency?.map(d => [d.agency, d.count]) ?? []);
    return agencies.map(a => ({
      value: String(a.id),
      label: a.name,
      count: countMap.get(a.name),
    }));
  }, [agencies, stats?.byAgency]);

  const agencyLevelOptions = useMemo(() => {
    const countMap = new Map(stats?.byLevel?.map(d => [d.level, d.count]) ?? []);
    return AGENCY_LEVEL_MULTISELECT_OPTIONS.map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [stats?.byLevel]);

  const whoPaysOptions = useMemo(() => {
    const countMap = new Map(stats?.byWhoPays?.map(d => [d.whoPays, d.count]) ?? []);
    return whoPaysValues.map(v => {
      const cnt = countMap.get(v.toLowerCase().trim());
      return { value: v, label: v, count: cnt };
    });
  }, [whoPaysValues, stats?.byWhoPays]);

  const perUnitOptions = useMemo(() => {
    const countMap = new Map(stats?.byPerUnit?.map(d => [d.perUnit, d.count]) ?? []);
    return perUnitValues.map(v => ({
      value: v,
      label: v,
      count: countMap.get(v.toLowerCase().trim()),
    }));
  }, [perUnitValues, stats?.byPerUnit]);

  useEffect(() => {
    fetchData();
    // Fetch bookmarked fines with notes
    getFineBookmarksWithNotes(jurisdiction).then(result => {
      if (result.success) {
        setFineBookmarks(new Map(result.data.map(b => [b.fineId, b])));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildFilters = useCallback((overrides: Record<string, unknown> = {}) => {
    const resolve = <T,>(key: string, fallback: T): T =>
      key in overrides ? (overrides[key] as T) : fallback;

    const penaltyTypeRaw = resolve('penaltyType', params.penaltyType) as string | null;
    const agencyRaw = resolve('agency', params.agency) as string | null;
    const agencyLevelRaw = resolve('agencyLevel', params.agencyLevel) as string | null;
    const search = resolve('search', params.search) as string | null;
    const sourceType = resolve('sourceType', params.sourceType) as string | null;
    const amountMin = resolve('amountMin', params.amountMin) as number | null;
    const amountMax = resolve('amountMax', params.amountMax) as number | null;
    const whoPaysRaw = resolve('whoPays', params.whoPays) as string | null;
    const perUnitRaw = resolve('perUnit', params.perUnit) as string | null;
    const classificationRaw = resolve('classification', params.classification) as string | null;

    const resolvedSourceType: 'regulation' | 'guidance' | undefined =
      sourceType === 'regulation' || sourceType === 'guidance'
        ? sourceType
        : undefined;

    return {
      penaltyType: penaltyTypeRaw || undefined,
      agency: agencyRaw || undefined,
      agencyLevel: agencyLevelRaw || undefined,
      search: search || undefined,
      sourceType: resolvedSourceType,
      amountMin: amountMin ?? undefined,
      amountMax: amountMax ?? undefined,
      whoPays: whoPaysRaw || undefined,
      perUnit: perUnitRaw || undefined,
      classification: classificationRaw && classificationRaw !== 'all' ? classificationRaw : undefined,
    };
  }, [params]);

  const fetchData = useCallback(async (overrides: Record<string, unknown> = {}) => {
    setIsLoading(true);
    try {
      const resolve = <T,>(key: string, fallback: T): T =>
        key in overrides ? (overrides[key] as T) : fallback;

      const page = resolve('page', params.page) as number;
      const filters = buildFilters(overrides);

      const result = await getFinesPaginated(jurisdiction, {
        page,
        pageSize: params.pageSize,
        sortBy: resolve('sortBy', params.sortBy) as 'penaltyType' | 'amount' | 'responsibleAgency' | 'createdAt',
        sortOrder: resolve('sortOrder', params.sortOrder) as 'asc' | 'desc',
        filters,
      });
      if (result.success) {
        setError(null);
        setData(result.data.data);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        setError(result.error || 'Failed to load fines');
        setData([]);
        setTotal(0);
        setTotalPages(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jurisdiction, params, buildFilters]);

  const handleFilterChange = useCallback((key: string, value: string | number | null) => {
    const newParams = { [key]: value, page: 1 };
    setParams(newParams as Parameters<typeof setParams>[0]);
    fetchData({ ...newParams });
  }, [setParams, fetchData]);

  const handleMultiFilterChange = useCallback((key: string, values: string[]) => {
    const serialized = serializeCommaSeparated(values);
    const newParams = { [key]: serialized, page: 1 };
    setParams(newParams as Parameters<typeof setParams>[0]);
    fetchData({ ...newParams });
  }, [setParams, fetchData]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage } as Parameters<typeof setParams>[0]);
    fetchData({ page: newPage });
  }, [setParams, fetchData]);

  const hasActiveFilters = Boolean(
    params.penaltyType ||
    params.agency ||
    params.agencyLevel ||
    params.search ||
    params.sourceType ||
    params.amountMin !== null ||
    params.amountMax !== null ||
    params.whoPays ||
    params.perUnit ||
    (params.classification && params.classification !== 'all')
  );

  const clearFilters = useCallback(() => {
    const defaults = {
      penaltyType: null,
      agency: null,
      agencyLevel: null,
      search: null,
      sourceType: null,
      amountMin: null,
      amountMax: null,
      whoPays: null,
      perUnit: null,
      classification: 'all',
      page: 1,
    };
    setParams(defaults as Parameters<typeof setParams>[0]);
    fetchData(defaults);
  }, [setParams, fetchData]);

  const handleRowClick = useCallback((fine: FineWithContext) => {
    setSelectedFine(fine);
    setDrawerOpen(true);
  }, []);

  const handleToggleBookmark = useCallback(async (fineId: number) => {
    const wasBookmarked = fineBookmarks.has(fineId);

    // Optimistic toggle
    setFineBookmarks(prev => {
      const next = new Map(prev);
      if (wasBookmarked) {
        next.delete(fineId);
      } else {
        next.set(fineId, { fineId, id: -1, notes: null, createdBy: bookmarkName || null });
      }
      return next;
    });

    const result = await toggleFineBookmark(fineId, jurisdiction, undefined, bookmarkName || undefined);
    if (!result.success) {
      // Revert on failure
      setFineBookmarks(prev => {
        const next = new Map(prev);
        if (wasBookmarked) {
          next.set(fineId, { fineId, id: -1, notes: null, createdBy: null });
        } else {
          next.delete(fineId);
        }
        return next;
      });
    } else if (result.data && !wasBookmarked) {
      // Update with real bookmark ID
      setFineBookmarks(prev => {
        const next = new Map(prev);
        next.set(fineId, { fineId, id: result.data!.id, notes: result.data!.notes, createdBy: result.data!.createdBy });
        return next;
      });
    }
  }, [jurisdiction, bookmarkName, fineBookmarks]);

  const handleBookmarkChange = useCallback((fineId: number, bookmarked: boolean) => {
    setFineBookmarks(prev => {
      const next = new Map(prev);
      if (bookmarked) {
        next.set(fineId, { fineId, id: -1, notes: null, createdBy: bookmarkName || null });
      } else {
        next.delete(fineId);
      }
      return next;
    });
  }, [bookmarkName]);

  const handleSaveBookmarkNotes = useCallback(async (bookmarkId: number, fineId: number, notes: string, createdBy?: string) => {
    const result = await updateBookmarkNotes(bookmarkId, notes, createdBy);
    if (result.success) {
      setFineBookmarks(prev => {
        const next = new Map(prev);
        const existing = next.get(fineId);
        if (existing) {
          next.set(fineId, { ...existing, notes: result.data.notes, createdBy: result.data.createdBy });
        }
        return next;
      });
    }
  }, []);

  const handleDrawerOpenChange = useCallback(async (open: boolean) => {
    setDrawerOpen(open);
    if (!open && selectedFine) {
      // Sync bookmark data when drawer closes (notes may have been edited in drawer)
      const result = await getFineBookmarksWithNotes(jurisdiction);
      if (result.success) {
        setFineBookmarks(new Map(result.data.map(b => [b.fineId, b])));
      }
    }
  }, [selectedFine, jurisdiction]);

  const currentFilters = useMemo(() => buildFilters(), [buildFilters]);

  const triggerDownload = useCallback((data: BlobPart, filename: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportLevelFilter = exportStateOnly ? { agencyLevel: 'state' } : {};

  const handleExport = useCallback(async () => {
    setExporting('csv');
    try {
      const result = await exportFinesCsv(jurisdiction, { ...currentFilters, ...exportLevelFilter });
      if (result.success) {
        triggerDownload(result.data, `fines-fees-${jurisdiction.toLowerCase()}.csv`, 'text/csv');
      } else {
        setError(result.error || 'Failed to export CSV');
      }
    } finally {
      setExporting(null);
    }
  }, [jurisdiction, currentFilters, triggerDownload, exportLevelFilter]);

  const handleExportZip = useCallback(async () => {
    setExporting('zip');
    try {
      const result = await exportFinesZipByAgency(jurisdiction, { ...currentFilters, ...exportLevelFilter });
      if (result.success) {
        const byteString = atob(result.data);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          bytes[i] = byteString.charCodeAt(i);
        }
        triggerDownload(bytes, `fines-by-agency-${jurisdiction.toLowerCase()}.zip`, 'application/zip');
      } else {
        setError(result.error || 'Failed to export ZIP');
      }
    } finally {
      setExporting(null);
    }
  }, [jurisdiction, currentFilters, triggerDownload, exportLevelFilter]);

  return (
    <div className="space-y-4">
      <FilterBar
        showSortControls
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        sortOptions={sortOptions}
        onSortByChange={(v) => handleFilterChange('sortBy', v)}
        onSortOrderToggle={() => handleFilterChange('sortOrder', params.sortOrder === 'desc' ? 'asc' : 'desc')}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <FilterField label="Type">
          <MultiSelect
            label="Type"
            value={selectedPenaltyTypes}
            onChange={(values) => handleMultiFilterChange('penaltyType', values)}
            options={penaltyTypeOptions}
            placeholder="All Types"
            data-testid="penalty-type-filter"
          />
        </FilterField>
        <FilterField label="Source">
          <Select
            value={params.sourceType || 'all'}
            onValueChange={(v) => handleFilterChange('sourceType', v === 'all' ? null : v)}
            options={sourceTypeOptions}
            aria-label="Filter by source type"
          />
        </FilterField>
        <FilterField label="Analysis">
          <Select
            value={params.classification || 'all'}
            onValueChange={(v) => handleFilterChange('classification', v === 'all' ? 'all' : v)}
            options={classificationOptions}
            aria-label="Filter by analysis classification"
          />
        </FilterField>
        <FilterField label="Agency">
          <MultiSelect
            label="Agency"
            value={selectedAgencies}
            onChange={(values) => handleMultiFilterChange('agency', values)}
            options={agencyOptions}
            placeholder="All Agencies"
            data-testid="agency-filter"
          />
        </FilterField>
        <FilterField label="Level">
          <MultiSelect
            label="Level"
            value={selectedAgencyLevels}
            onChange={(values) => handleMultiFilterChange('agencyLevel', values)}
            options={agencyLevelOptions}
            placeholder="All Levels"
            data-testid="agency-level-filter"
          />
        </FilterField>
        <FilterField label="Who Pays">
          <MultiSelect
            label="Who Pays"
            value={selectedWhoPays}
            onChange={(values) => handleMultiFilterChange('whoPays', values)}
            options={whoPaysOptions}
            placeholder="All"
            className="min-w-[240px]"
            data-testid="who-pays-filter"
          />
        </FilterField>
        <FilterField label="Per Unit">
          <MultiSelect
            label="Per Unit"
            value={selectedPerUnits}
            onChange={(values) => handleMultiFilterChange('perUnit', values)}
            options={perUnitOptions}
            placeholder="All"
            data-testid="per-unit-filter"
          />
        </FilterField>
        <FilterField label="Amount">
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="Min $"
              value={params.amountMin ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : null;
                handleFilterChange('amountMin', val);
              }}
              className="w-20 px-2 py-1.5 text-sm bg-[var(--color-surface)] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:outline-none"
              aria-label="Minimum amount"
            />
            <span className="text-xs text-[var(--color-text-muted)]">-</span>
            <input
              type="number"
              placeholder="Max $"
              value={params.amountMax ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : null;
                handleFilterChange('amountMax', val);
              }}
              className="w-20 px-2 py-1.5 text-sm bg-[var(--color-surface)] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:outline-none"
              aria-label="Maximum amount"
            />
          </div>
        </FilterField>
        <FilterField label="Search">
          <SearchInput
            value={params.search || ''}
            onSearch={(v) => handleFilterChange('search', v || null)}
            placeholder="Search fines, fees..."
            aria-label="Search fines"
            size="sm"
            isLoading={isLoading}
          />
        </FilterField>
      </FilterBar>

      {error && (
        <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)]">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Results */}
      <Card padding="none">
        <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
          <div className="px-4 py-3 border-b border-[var(--color-neutral-200)] flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">
              {total} result{total !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              {/* State-only export toggle */}
              <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportStateOnly}
                  onChange={(e) => setExportStateOnly(e.target.checked)}
                  className="rounded border-[var(--color-neutral-300)] text-[var(--color-primary)] focus:ring-[var(--color-focus-ring)]"
                />
                State-level only
              </label>

              <div className="h-5 border-l border-[var(--color-neutral-300)]" />

              <ExportDropdown
                exporting={exporting}
                hasActiveFilters={hasActiveFilters}
                total={total}
                onExportCsv={handleExport}
                onExportZip={handleExportZip}
              />
            </div>
          </div>
          <div className="p-4">
            <FinesTable
              data={data}
              state={jurisdiction}
              onRowClick={handleRowClick}
              bookmarkedFineIds={bookmarkedIds}
              onToggleBookmark={handleToggleBookmark}
              fineBookmarks={fineBookmarks}
              onSaveBookmarkNotes={handleSaveBookmarkNotes}
              bookmarkName={bookmarkName}
            />
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[var(--color-neutral-200)]">
              <Pagination
                page={params.page}
                totalPages={totalPages}
                total={total}
                pageSize={params.pageSize}
                showItemCount
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </Card>

      <FinesDetailDrawer
        fine={selectedFine}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        state={jurisdiction}
        onBookmarkChange={handleBookmarkChange}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export dropdown                                                     */
/* ------------------------------------------------------------------ */

interface ExportDropdownProps {
  exporting: 'csv' | 'zip' | 'all' | null;
  hasActiveFilters: boolean;
  total: number;
  onExportCsv: () => void;
  onExportZip: () => void;
}

function ExportDropdown({ exporting, hasActiveFilters, total, onExportCsv, onExportZip }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        disabled={exporting !== null}
      >
        <Download className="w-3.5 h-3.5 mr-1.5" />
        {exporting ? 'Exporting...' : 'Export'}
        <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] shadow-lg z-50 py-1">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleAction(onExportCsv)}
            disabled={exporting === 'csv' || total === 0}
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            Export CSV
          </button>

          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-neutral-50)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleAction(onExportZip)}
            disabled={exporting === 'zip' || total === 0}
          >
            <FileArchive className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            Export by Agency (ZIP)
          </button>

          {hasActiveFilters && (
            <>
              <div className="border-t border-[var(--color-neutral-100)] my-1" />
              <span className="block px-3 py-1 text-xs text-[var(--color-text-muted)]">
                {total} filtered result{total !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
