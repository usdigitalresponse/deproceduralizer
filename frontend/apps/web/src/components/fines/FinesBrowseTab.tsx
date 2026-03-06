'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQueryStates } from 'nuqs';
import { Download, FileArchive } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { FinesTable } from './FinesTable';
import { FinesDetailDrawer } from './FinesDetailDrawer';
import { getFinesPaginated, exportFinesCsv, exportFinesZipByAgency } from '@/lib/actions/fines';
import { finesParsers } from '@/lib/url/parsers';
import { SOURCE_TYPE_LABELS } from '@/lib/constants/fines';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { FineWithContext } from '@/lib/actions/fines';

interface FinesBrowseTabProps {
  jurisdiction: JurisdictionCode;
  agencies: string[];
  whoPaysValues: string[];
  perUnitValues: string[];
}

const sortOptions = [
  { value: 'createdAt', label: 'Date Added' },
  { value: 'penaltyType', label: 'Type' },
  { value: 'amount', label: 'Amount' },
  { value: 'responsibleAgency', label: 'Agency' },
];

const penaltyTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'fine', label: 'Fines' },
  { value: 'fee', label: 'Fees' },
  { value: 'penalty', label: 'Penalties' },
  { value: 'surcharge', label: 'Surcharges' },
  { value: 'forfeiture', label: 'Forfeitures' },
  { value: 'other', label: 'Other' },
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
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFine, setSelectedFine] = useState<FineWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const agencyOptions = [
    { value: 'all', label: 'All Agencies' },
    ...agencies.map(a => ({ value: a, label: a })),
  ];

  const whoPaysOptions = [
    { value: 'all', label: 'All' },
    ...whoPaysValues.map(v => ({ value: v, label: v })),
  ];

  const perUnitOptions = [
    { value: 'all', label: 'All' },
    ...perUnitValues.map(v => ({ value: v, label: v })),
  ];

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildFilters = useCallback((overrides: Record<string, unknown> = {}) => {
    const resolve = <T,>(key: string, fallback: T): T =>
      key in overrides ? (overrides[key] as T) : fallback;

    const penaltyType = resolve('penaltyType', params.penaltyType) as string | null;
    const agency = resolve('agency', params.agency) as string | null;
    const search = resolve('search', params.search) as string | null;
    const sourceType = resolve('sourceType', params.sourceType) as string | null;
    const amountMin = resolve('amountMin', params.amountMin) as number | null;
    const amountMax = resolve('amountMax', params.amountMax) as number | null;
    const whoPays = resolve('whoPays', params.whoPays) as string | null;
    const perUnit = resolve('perUnit', params.perUnit) as string | null;

    const resolvedSourceType: 'regulation' | 'guidance' | undefined =
      sourceType === 'regulation' || sourceType === 'guidance'
        ? sourceType
        : undefined;

    return {
      penaltyType: penaltyType === 'all' ? undefined : penaltyType || undefined,
      agency: agency === 'all' ? undefined : agency || undefined,
      search: search || undefined,
      sourceType: resolvedSourceType,
      amountMin: amountMin ?? undefined,
      amountMax: amountMax ?? undefined,
      whoPays: whoPays === 'all' ? undefined : whoPays || undefined,
      perUnit: perUnit === 'all' ? undefined : perUnit || undefined,
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

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage } as Parameters<typeof setParams>[0]);
    fetchData({ page: newPage });
  }, [setParams, fetchData]);

  const hasActiveFilters = Boolean(
    (params.penaltyType && params.penaltyType !== 'all') ||
    params.agency ||
    params.search ||
    params.sourceType ||
    params.amountMin !== null ||
    params.amountMax !== null ||
    params.whoPays ||
    params.perUnit
  );

  const clearFilters = useCallback(() => {
    const defaults = {
      penaltyType: 'all' as const,
      agency: null,
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

  const currentFilters = buildFilters();

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await exportFinesCsv(jurisdiction, currentFilters);
      if (result.success) {
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fines-fees-${jurisdiction.toLowerCase()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Failed to export CSV');
      }
    } finally {
      setIsExporting(false);
    }
  }, [jurisdiction, currentFilters]);

  const handleExportZip = useCallback(async () => {
    setIsExportingZip(true);
    try {
      const result = await exportFinesZipByAgency(jurisdiction, currentFilters);
      if (result.success) {
        const byteString = atob(result.data);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          bytes[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fines-by-agency-${jurisdiction.toLowerCase()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Failed to export ZIP');
      }
    } finally {
      setIsExportingZip(false);
    }
  }, [jurisdiction, currentFilters]);

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
          <Select
            value={params.penaltyType || 'all'}
            onValueChange={(v) => handleFilterChange('penaltyType', v === 'all' ? null : v)}
            options={penaltyTypeOptions}
            aria-label="Filter by penalty type"
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
          <Select
            value={params.agency || 'all'}
            onValueChange={(v) => handleFilterChange('agency', v === 'all' ? null : v)}
            options={agencyOptions}
            aria-label="Filter by agency"
          />
        </FilterField>
        <FilterField label="Who Pays">
          <Select
            value={params.whoPays || 'all'}
            onValueChange={(v) => handleFilterChange('whoPays', v === 'all' ? null : v)}
            options={whoPaysOptions}
            aria-label="Filter by who pays"
          />
        </FilterField>
        <FilterField label="Per Unit">
          <Select
            value={params.perUnit || 'all'}
            onValueChange={(v) => handleFilterChange('perUnit', v === 'all' ? null : v)}
            options={perUnitOptions}
            aria-label="Filter by per unit"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportZip}
                disabled={isExportingZip || total === 0}
              >
                <FileArchive className="w-3.5 h-3.5 mr-1.5" />
                {isExportingZip ? 'Exporting...' : 'Export by Agency (ZIP)'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || total === 0}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
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
