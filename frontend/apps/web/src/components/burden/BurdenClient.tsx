'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import Link from 'next/link';
import {
  Layers, AlertTriangle, BarChart3,
  FileText, BookOpen, ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Select, MultiSelect, InfoTooltip } from '@/components/ui';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProportionalBar } from '@/components/ui/ProportionalBar';
import {
  burdenParsers,
  parseCommaSeparated,
  serializeCommaSeparated,
} from '@/lib/url/parsers';
import { getBarrierBurdenRanking } from '@/lib/actions/barrier';
import { SEVERITY_MULTISELECT_OPTIONS } from '@/lib/constants/filters';
import { STRUCTURAL_CATEGORIES, getCategoryLabel, isStructuralCategory } from '@/lib/constants/barrier';
import { formatLabel } from '@/types/regulation';
import type { JurisdictionCode, BurdenOverviewStats, BurdenRankingRow } from '@deproceduralizer/database';

const STRUCTURAL_CATEGORY_SHORT: Record<string, string> = {
  ADMINISTRATIVE_BURDENS: 'Admin',
  MANDATED_STEPS_NOT_OUTCOMES: 'Steps',
  REGULATORY_COMPLEXITY: 'Complex',
  ONE_SIZE_FITS_ALL: 'One-Size',
  CASCADE_OF_RIGIDITY: 'Rigidity',
  UNFUNDED_MANDATE: 'Unfunded',
};

/** Concise descriptions of each structural burden category for tooltips. */
const STRUCTURAL_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  ADMINISTRATIVE_BURDENS:
    'Physical friction: notarization, wet signatures, in-person appearances, original documents, or unrealistic deadlines creating barriers to access.',
  MANDATED_STEPS_NOT_OUTCOMES:
    'Prescribes specific procedures without stating the goal, preventing better or more efficient approaches.',
  REGULATORY_COMPLEXITY:
    'Language so convoluted or cross-referenced that its meaning is genuinely unclear.',
  ONE_SIZE_FITS_ALL:
    'Uniform standards ignoring program diversity \u2014 identical requirements regardless of size, context, or risk level.',
  CASCADE_OF_RIGIDITY:
    'Multiple absolute mandates listed without prioritization, creating impossible compliance when goals conflict.',
  UNFUNDED_MANDATE:
    'Requirements imposed without appropriation or funding mechanism, forcing regulated entities to bear all costs.',
};

const sortOptions = [
  { value: 'adjustedBurden', label: 'Adjusted Burden' },
  { value: 'compositeBurden', label: 'Raw Composite' },
  { value: 'maxSeverity', label: 'Max Severity' },
  { value: 'issueCount', label: 'Issue Count' },
];

const sourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'regulation', label: 'Regulations' },
  { value: 'guidance', label: 'Guidance' },
];

interface BurdenClientProps {
  jurisdiction: JurisdictionCode;
  stats: BurdenOverviewStats | null;
  categories: { category: string; count: number }[];
  parts: { part: string; partName: string | null; count: number }[];
  sectionTypes: { sectionType: string; count: number }[];
}

const formatCategoryLabel = getCategoryLabel;

function buildExplanation(row: BurdenRankingRow): string {
  const parts: string[] = [];
  const clusterCount = row.structuralClusterCount;
  const multiplier = (1 + 0.1 * clusterCount).toFixed(1);

  if (clusterCount >= 5) {
    parts.push('Hits nearly all structural categories.');
  }

  parts.push(
    `${row.issueCount} issue${row.issueCount !== 1 ? 's' : ''} across ${clusterCount} structural categor${clusterCount !== 1 ? 'ies' : 'y'} (${multiplier}x multiplier). Highest individual: ${row.maxSeverity}.`
  );

  // Top structural categories present
  const structuralPresent = row.categories.filter(isStructuralCategory);
  if (structuralPresent.length > 0) {
    const names = structuralPresent.slice(0, 3).map(formatCategoryLabel).join(', ');
    parts.push(names + '.');
  }

  if (row.maxSeverity <= 6 && row.adjustedBurden > 30) {
    parts.push('No single finding above 6, but aggregate burden is severe.');
  }

  return parts.join(' ');
}

function getDocumentLink(row: BurdenRankingRow, jurisdiction: string): string {
  if (row.source === 'guidance' && row.guidanceDocumentId) {
    return `/${jurisdiction}/guidance/${row.guidanceDocumentId}`;
  }
  if (row.documentId) {
    return `/${jurisdiction}/regulations/${row.documentId}`;
  }
  return '#';
}

export function BurdenClient({ jurisdiction, stats, categories, parts, sectionTypes }: BurdenClientProps) {
  const [params, setParams] = useQueryStates(burdenParsers, { shallow: true });
  const [data, setData] = useState<BurdenRankingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Parse multi-select values from comma-separated URL params
  const selectedSeverities = useMemo(() => parseCommaSeparated(params.severity), [params.severity]);
  const selectedCategories = useMemo(() => parseCommaSeparated(params.category), [params.category]);
  const selectedParts = useMemo(() => parseCommaSeparated(params.part), [params.part]);
  const selectedSectionTypes = useMemo(() => parseCommaSeparated(params.sectionType), [params.sectionType]);

  // Build option arrays with counts
  const categoryOptions = useMemo(() =>
    categories.map(cat => ({
      value: cat.category,
      label: getCategoryLabel(cat.category),
      count: cat.count,
    })),
  [categories]);

  const partOptions = useMemo(() =>
    parts.map(p => ({
      value: p.part,
      label: p.partName
        ? `${p.partName} (Part ${p.part})`
        : `Part ${p.part}`,
      count: p.count,
    })),
  [parts]);

  const sectionTypeOptions = useMemo(() =>
    sectionTypes.map(st => ({
      value: st.sectionType,
      label: formatLabel(st.sectionType),
      count: st.count,
    })),
  [sectionTypes]);

  const isGuidanceOnly = params.source === 'guidance';

  const fetchData = useCallback(async (overrides: Record<string, unknown> = {}) => {
    setIsLoading(true);
    try {
      const resolve = <T,>(key: string, fallback: T): T =>
        key in overrides ? (overrides[key] as T) : fallback;

      const page = resolve('page', params.page) as number;
      const source = resolve('source', params.source) as 'all' | 'regulation' | 'guidance';
      const severity = resolve('severity', params.severity) as string | null;
      const category = resolve('category', params.category) as string | null;
      const part = resolve('part', params.part) as string | null;
      const sectionType = resolve('sectionType', params.sectionType) as string | null;
      const search = resolve('search', params.search) as string | null;
      const sortBy = resolve('sortBy', params.sortBy) as 'adjustedBurden' | 'compositeBurden' | 'maxSeverity' | 'issueCount';
      const sortOrder = resolve('sortOrder', params.sortOrder) as 'asc' | 'desc';

      const result = await getBarrierBurdenRanking(jurisdiction, {
        page,
        pageSize: params.pageSize,
        sortBy,
        sortOrder,
        source: source === 'all' ? undefined : source,
        severity: severity ?? undefined,
        category: category ?? undefined,
        part: part ?? undefined,
        sectionType: sectionType ?? undefined,
        search: search ?? undefined,
      });

      if (result.success) {
        setError(null);
        setData(result.data.data);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        setError(result.error);
        setData([]);
        setTotal(0);
        setTotalPages(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jurisdiction, params]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    (params.source && params.source !== 'all') ||
    params.severity ||
    params.category ||
    params.part ||
    params.sectionType ||
    params.search
  );

  const clearFilters = useCallback(() => {
    const defaults = {
      source: 'all' as const,
      severity: null,
      category: null,
      part: null,
      sectionType: null,
      search: null,
      page: 1,
    };
    setParams(defaults as Parameters<typeof setParams>[0]);
    fetchData(defaults);
  }, [setParams, fetchData]);

  const toggleRowExpanded = useCallback((analysisId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(analysisId)) {
        next.delete(analysisId);
      } else {
        next.add(analysisId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <StatGrid columns={4}>
        <StatCard
          label="Documents Analyzed"
          value={stats?.totalAnalyzed ?? 0}
          icon={FileText}
          variant="default"
        />
        <StatCard
          label="High Burden (>40)"
          value={stats?.highBurdenCount ?? 0}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatCard
          label="Average Score"
          value={stats?.averageBurden?.toFixed(1) ?? '0'}
          icon={BarChart3}
          variant="info"
        />
        <StatCard
          label="Top Structural Category"
          value={stats?.topStructuralCategory ? formatCategoryLabel(stats.topStructuralCategory) : 'N/A'}
          icon={Layers}
          variant="warning"
        />
      </StatGrid>

      {/* Filters */}
      <FilterBar
        variant="panel"
        showSortControls
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        sortOptions={sortOptions}
        onSortByChange={(v) => handleFilterChange('sortBy', v)}
        onSortOrderToggle={() => handleFilterChange('sortOrder', params.sortOrder === 'desc' ? 'asc' : 'desc')}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <FilterField label="Source">
          <Select
            value={params.source}
            onValueChange={(v) => {
              // When switching to guidance, clear part/sectionType since they don't apply
              const extra = v === 'guidance' ? { part: null, sectionType: null } : {};
              const newParams = { source: v, ...extra, page: 1 };
              setParams(newParams as Parameters<typeof setParams>[0]);
              fetchData(newParams);
            }}
            options={sourceOptions}
            aria-label="Filter by source"
          />
        </FilterField>
        <FilterField label="Severity">
          <MultiSelect
            label="Severity"
            value={selectedSeverities}
            onChange={(values) => handleMultiFilterChange('severity', values)}
            options={SEVERITY_MULTISELECT_OPTIONS}
            placeholder="All Severities"
            aria-label="Filter by severity"
          />
        </FilterField>
        <FilterField label="Category">
          <MultiSelect
            label="Category"
            value={selectedCategories}
            onChange={(values) => handleMultiFilterChange('category', values)}
            options={categoryOptions}
            placeholder="All Categories"
            aria-label="Filter by category"
          />
        </FilterField>
        {!isGuidanceOnly && partOptions.length > 0 && (
          <FilterField label="Part">
            <MultiSelect
              label="Part"
              value={selectedParts}
              onChange={(values) => handleMultiFilterChange('part', values)}
              options={partOptions}
              placeholder="All Parts"
              searchable
              aria-label="Filter by part"
            />
          </FilterField>
        )}
        {!isGuidanceOnly && sectionTypeOptions.length > 0 && (
          <FilterField label="Section Type">
            <MultiSelect
              label="Section Type"
              value={selectedSectionTypes}
              onChange={(values) => handleMultiFilterChange('sectionType', values)}
              options={sectionTypeOptions}
              placeholder="All Section Types"
              aria-label="Filter by section type"
            />
          </FilterField>
        )}
        <FilterField label="Search">
          <SearchInput
            value={params.search ?? ''}
            onSearch={(v) => handleFilterChange('search', v || null)}
            placeholder="Search document titles..."
            aria-label="Search documents"
            size="sm"
            isLoading={isLoading}
          />
        </FilterField>
      </FilterBar>

      {/* Error */}
      {error && (
        <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)]">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Results */}
      <div className={`space-y-3 ${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
        <p className="text-sm text-[var(--color-text-muted)]">
          {total} document{total !== 1 ? 's' : ''} ranked
        </p>

        {data.length === 0 && !isLoading && (
          <EmptyState title="No burden data" description="No documents with burden scores match your filters." />
        )}

        {data.map((row, index) => {
          const rank = (params.page - 1) * params.pageSize + index + 1;
          const docLink = getDocumentLink(row, jurisdiction);

          return (
            <Card key={row.analysisId} padding="none">
              <div className="flex items-start gap-4 p-4">
                {/* Rank badge */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-neutral-100)] flex items-center justify-center">
                  <span className="text-sm font-bold text-[var(--color-text)]">
                    {rank}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={docLink}
                          className="text-sm font-medium text-[var(--color-primary)] hover:underline truncate block"
                        >
                          {row.title ?? 'Untitled Document'}
                        </Link>
                        {row.url && (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Source badge */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.source === 'guidance'
                            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                            : 'bg-[var(--color-info-bg)] text-[var(--color-info)]'
                        }`}>
                          {row.source === 'guidance' ? <BookOpen className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {row.source === 'guidance' ? 'Guidance' : 'Regulation'}
                        </span>
                      </div>
                    </div>

                    {/* Score section */}
                    <div className="flex-shrink-0 text-right w-28">
                      <div className="text-xl font-bold text-[var(--color-text)]">
                        {row.adjustedBurden?.toFixed(1)}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">adjusted burden</div>
                      <ProportionalBar value={row.adjustedBurden ?? 0} max={80} height={4} className="mt-1" />
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                    <span>Raw: {row.compositeBurden?.toFixed(1)}</span>
                    <span>Max Sev: {row.maxSeverity}</span>
                    <span>{row.issueCount} issue{row.issueCount !== 1 ? 's' : ''}</span>
                    <span>Clusters: {row.structuralClusterCount}/6</span>
                  </div>

                  {/* Structural cluster indicators */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {STRUCTURAL_CATEGORIES.map(cat => {
                      const present = row.categories.includes(cat);
                      return (
                        <span
                          key={cat}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            present
                              ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]'
                              : 'bg-[var(--color-neutral-50)] text-[var(--color-text-muted)] border border-[var(--color-neutral-200)]'
                          }`}
                        >
                          {STRUCTURAL_CATEGORY_SHORT[cat]}
                          <InfoTooltip
                            content={STRUCTURAL_CATEGORY_DESCRIPTIONS[cat] ?? formatCategoryLabel(cat)}
                            size={10}
                          />
                        </span>
                      );
                    })}
                  </div>

                  {/* Why it ranks high */}
                  <p className={`mt-2 text-xs text-[var(--color-text-muted)] italic ${
                    expandedRows.has(row.analysisId) ? '' : 'line-clamp-2'
                  }`}>
                    {buildExplanation(row)}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleRowExpanded(row.analysisId)}
                    className="mt-0.5 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    {expandedRows.has(row.analysisId) ? 'Show less' : 'Show more'}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={params.page}
          totalPages={totalPages}
          total={total}
          pageSize={params.pageSize}
          showItemCount
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
