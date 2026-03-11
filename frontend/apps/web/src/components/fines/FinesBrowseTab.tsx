'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Download, FileArchive, Filter } from 'lucide-react';
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
import type { AgencyOption } from '@/lib/actions/fines';
import { finesParsers } from '@/lib/url/parsers';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';
import { SOURCE_TYPE_LABELS, PENALTY_TYPE_MULTISELECT_OPTIONS, AGENCY_LEVEL_MULTISELECT_OPTIONS } from '@/lib/constants/fines';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { FineWithContext } from '@/lib/actions/fines';

interface FinesBrowseTabProps {
  jurisdiction: JurisdictionCode;
  agencies: AgencyOption[];
  whoPaysValues: string[];
  perUnitValues: string[];
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

export function FinesBrowseTab({ jurisdiction, agencies, whoPaysValues, perUnitValues }: FinesBrowseTabProps) {
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

  // Parse URL state for multi-select filters
  const selectedPenaltyTypes = useMemo(() => parseCommaSeparated(params.penaltyType), [params.penaltyType]);
  const selectedAgencies = useMemo(() => parseCommaSeparated(params.agency), [params.agency]);
  const selectedAgencyLevels = useMemo(() => parseCommaSeparated(params.agencyLevel), [params.agencyLevel]);
  const selectedWhoPays = useMemo(() => parseCommaSeparated(params.whoPays), [params.whoPays]);
  const selectedPerUnits = useMemo(() => parseCommaSeparated(params.perUnit), [params.perUnit]);

  // Build option arrays — agencies now use ID-based values
  const agencyOptions = useMemo(() =>
    agencies.map(a => ({ value: String(a.id), label: a.name })),
  [agencies]);

  const whoPaysOptions = useMemo(() =>
    whoPaysValues.map(v => ({ value: v, label: v })),
  [whoPaysValues]);

  const perUnitOptions = useMemo(() =>
    perUnitValues.map(v => ({ value: v, label: v })),
  [perUnitValues]);

  useEffect(() => {
    fetchData();
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
    params.perUnit
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
      page: 1,
    };
    setParams(defaults as Parameters<typeof setParams>[0]);
    fetchData(defaults);
  }, [setParams, fetchData]);

  const handleRowClick = useCallback((fine: FineWithContext) => {
    setSelectedFine(fine);
    setDrawerOpen(true);
  }, []);

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

  const handleExportAll = useCallback(async () => {
    setExporting('all');
    try {
      const result = await exportFinesCsv(jurisdiction, { ...exportLevelFilter });
      if (result.success) {
        const suffix = exportStateOnly ? 'state' : 'all';
        triggerDownload(result.data, `fines-fees-${suffix}-${jurisdiction.toLowerCase()}.csv`, 'text/csv');
      } else {
        setError(result.error || 'Failed to export CSV');
      }
    } finally {
      setExporting(null);
    }
  }, [jurisdiction, triggerDownload, exportLevelFilter, exportStateOnly]);

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
            options={PENALTY_TYPE_MULTISELECT_OPTIONS}
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
            options={AGENCY_LEVEL_MULTISELECT_OPTIONS}
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

              {/* Export All — exports unfiltered data (respects state-only toggle) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportAll}
                disabled={exporting === 'all'}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {exporting === 'all' ? 'Exporting...' : 'Export All (CSV)'}
              </Button>

              {/* Divider between "Export All" and filtered exports */}
              <div className="h-5 border-l border-[var(--color-neutral-300)]" />

              {/* Filtered exports — respect current filter state */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportZip}
                    disabled={exporting === 'zip' || total === 0}
                  >
                    {hasActiveFilters && <Filter className="w-3 h-3 mr-1" />}
                    <FileArchive className="w-3.5 h-3.5 mr-1.5" />
                    {exporting === 'zip'
                      ? 'Exporting...'
                      : hasActiveFilters
                        ? 'Export Filtered by Agency (ZIP)'
                        : 'Export by Agency (ZIP)'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExport}
                    disabled={exporting === 'csv' || total === 0}
                  >
                    {hasActiveFilters && <Filter className="w-3 h-3 mr-1" />}
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {exporting === 'csv'
                      ? 'Exporting...'
                      : hasActiveFilters
                        ? 'Export Filtered CSV'
                        : 'Export CSV'}
                  </Button>
                </div>
                {hasActiveFilters && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Exports {total} filtered result{total !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="p-4">
            <FinesTable data={data} state={jurisdiction} onRowClick={handleRowClick} />
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
        onOpenChange={setDrawerOpen}
        state={jurisdiction}
      />
    </div>
  );
}
