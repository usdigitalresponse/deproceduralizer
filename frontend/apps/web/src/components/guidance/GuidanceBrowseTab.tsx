'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type ComponentType } from 'react';
import { List, Layers, Bookmark } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { MultiSelect } from '@/components/ui';
import { SearchInput } from '@/components/ui/SearchInput';
import { TieredFilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Badge } from '@/components/ui/Badge';
import { GuidanceTable } from './GuidanceTable';
import { GroupedGuidanceTable } from './GroupedGuidanceTable';
import { getGuidancePaginated, getGuidanceGrouped, getGuidanceOverviewStats } from '@/lib/actions/guidance-documents';
import type { GuidanceOverviewStats } from '@/lib/actions/guidance-documents';
import {
  toggleGuidanceBookmark,
  getGuidanceDocBookmarkMarkersMap,
  assignMarkerToBookmark,
  removeMarkerFromBookmark,
  type BookmarkMarkersMap,
} from '@/lib/actions/bookmarks';
import { getMarkerGroups, getOrCreateCustomMarkerGroup } from '@/lib/actions/marker-groups';
import { useBookmarkName } from '@/hooks/useBookmarkName';
import { guidanceParsers } from '@/lib/url/parsers';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';
import {
  GUIDANCE_STATUS_VALUES,
  GUIDANCE_POLICY_CATEGORY_VALUES,
  GUIDANCE_AUDIENCE_DIRECTION_VALUES,
  GUIDANCE_READABILITY_VALUES,
  GUIDANCE_AUDIENCE_EXPERTISE_VALUES,
  GUIDANCE_TARGET_AUDIENCE_VALUES,
  SECTION_TYPE_VALUES,
} from '@/lib/constants/values';
import { formatLabel } from '@/types/regulation';
import type { JurisdictionCode, MarkerGroup } from '@deproceduralizer/database';
import type { GuidanceDocumentListItem, GuidanceGroupRow } from '@/lib/actions/guidance-documents';
import type { GuidanceBrowseModeValue, GuidanceGroupByValue, GuidanceGroupSortByValue } from '@/lib/url/parsers';

interface GuidanceBrowseTabProps {
  jurisdiction: JurisdictionCode;
  agencies: string[];
  docTypes: string[];
}

const sortOptions = [
  { value: 'title', label: 'Title' },
  { value: 'agency', label: 'Agency' },
  { value: 'year', label: 'Year' },
  { value: 'status', label: 'Status' },
  { value: 'createdAt', label: 'Date Added' },
  { value: 'readability', label: 'Readability' },
];

const browseModeOptions: Array<{ value: GuidanceBrowseModeValue; label: string; icon?: ComponentType<{ className?: string }> }> = [
  { value: 'flat', label: 'Flat', icon: List },
  { value: 'grouped', label: 'Grouped', icon: Layers },
];

const groupByOptions: Array<{ value: GuidanceGroupByValue; label: string }> = [
  { value: 'agency', label: 'Agency' },
  { value: 'docType', label: 'Doc Type' },
  { value: 'policyCategory', label: 'Policy Category' },
];

const statusOptions = GUIDANCE_STATUS_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Statuses' : formatLabel(v),
}));

const policyCategoryOptions = GUIDANCE_POLICY_CATEGORY_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Categories' : formatLabel(v),
}));

const audienceDirectionOptions = GUIDANCE_AUDIENCE_DIRECTION_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Audiences' : formatLabel(v),
}));

const sectionTypeOptions = SECTION_TYPE_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Section Types' : formatLabel(v),
}));

const readabilityOptions = GUIDANCE_READABILITY_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Readability' : formatLabel(v),
}));

const audienceExpertiseBaseOptions = GUIDANCE_AUDIENCE_EXPERTISE_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Expertise' : formatLabel(v),
}));

const targetAudienceBaseOptions = GUIDANCE_TARGET_AUDIENCE_VALUES.map(v => ({
  value: v,
  label: formatLabel(v),
}));

export function GuidanceBrowseTab({ jurisdiction, agencies, docTypes }: GuidanceBrowseTabProps) {
  const [params, setParams] = useQueryStates(guidanceParsers, { shallow: true });

  // Flat mode state
  const [flatData, setFlatData] = useState<GuidanceDocumentListItem[]>([]);
  const [flatTotal, setFlatTotal] = useState(0);

  // Grouped mode state
  const [groupedData, setGroupedData] = useState<GuidanceGroupRow[]>([]);
  const [groupedTotal, setGroupedTotal] = useState(0);
  const [groupedTotalPages, setGroupedTotalPages] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<GuidanceOverviewStats | null>(null);
  const fetchCounterRef = useRef(0);

  // Bookmark + marker state
  const [bookmarkMarkersMap, setBookmarkMarkersMap] = useState<BookmarkMarkersMap>(new Map());
  const [markerGroupsList, setMarkerGroupsList] = useState<MarkerGroup[]>([]);
  const { bookmarkName } = useBookmarkName();

  const bookmarkedDocIds = useMemo(
    () => new Set(Array.from(bookmarkMarkersMap.keys()).map(Number)),
    [bookmarkMarkersMap]
  );

  const isGrouped = params.browseMode === 'grouped';
  const total = isGrouped ? groupedTotal : flatTotal;
  const totalPages = isGrouped ? groupedTotalPages : Math.ceil(flatTotal / params.pageSize);

  const selectedTargetAudiences = useMemo(() => parseCommaSeparated(params.targetAudience), [params.targetAudience]);
  const selectedMarkerIds = useMemo(() => parseCommaSeparated(params.marker), [params.marker]);

  // Fetch overview stats once for MultiSelect counts
  useEffect(() => {
    getGuidanceOverviewStats(jurisdiction).then(result => {
      if (result.success) setStats(result.data);
    });
  }, [jurisdiction]);

  // Fetch bookmark markers map and marker groups
  useEffect(() => {
    let cancelled = false;
    async function fetchBookmarkData() {
      const [markersResult, groupsResult] = await Promise.all([
        getGuidanceDocBookmarkMarkersMap(jurisdiction),
        getMarkerGroups(jurisdiction),
      ]);
      if (cancelled) return;
      if (markersResult.success) setBookmarkMarkersMap(markersResult.data);
      if (groupsResult.success) setMarkerGroupsList(groupsResult.data);
    }
    fetchBookmarkData();
    return () => { cancelled = true; };
  }, [jurisdiction]);

  const targetAudienceOptions = useMemo(() => {
    if (!stats?.byTargetAudience) return targetAudienceBaseOptions;
    const countMap = new Map(stats.byTargetAudience.map(d => [d.audience, d.count]));
    return targetAudienceBaseOptions.map(opt => ({
      ...opt,
      count: countMap.get(opt.value) ?? 0,
    }));
  }, [stats?.byTargetAudience]);

  const audienceExpertiseOptions = useMemo(() => {
    if (!stats?.byAudienceExpertise) return audienceExpertiseBaseOptions;
    const countMap = new Map(stats.byAudienceExpertise.map(d => [d.expertise, d.count]));
    return audienceExpertiseBaseOptions.map(opt => ({
      ...opt,
      label: opt.value === 'all' ? opt.label : `${opt.label} (${countMap.get(opt.value) ?? 0})`,
    }));
  }, [stats?.byAudienceExpertise]);

  const agencyOptions = [
    { value: 'all', label: 'All Agencies' },
    ...agencies.map(a => ({ value: a, label: a })),
  ];

  const docTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...docTypes.map(dt => ({ value: dt, label: dt })),
  ];

  const parsedMarkerGroupIds = useMemo(
    () => selectedMarkerIds.map(Number).filter(n => !isNaN(n)),
    [selectedMarkerIds]
  );

  const activeFilters = {
    agency: params.agency && params.agency !== 'all' ? params.agency : undefined,
    docType: params.docType && params.docType !== 'all' ? params.docType : undefined,
    policyCategory: params.policyCategory !== 'all' ? params.policyCategory : undefined,
    status: params.status !== 'all' ? params.status : undefined,
    yearFrom: params.yearFrom || undefined,
    yearTo: params.yearTo || undefined,
    search: params.search || undefined,
    audienceDirection: params.audienceDirection !== 'all' ? params.audienceDirection : undefined,
    sectionType: params.sectionType !== 'all' ? params.sectionType : undefined,
    hasForm: params.hasForm || undefined,
    hasIbr: params.hasIbr || undefined,
    readability: params.readability !== 'all' ? params.readability : undefined,
    targetAudience: selectedTargetAudiences.length > 0 ? selectedTargetAudiences : undefined,
    audienceExpertise: params.audienceExpertise !== 'all' ? params.audienceExpertise : undefined,
    markerGroupIds: parsedMarkerGroupIds.length > 0 ? parsedMarkerGroupIds : undefined,
    bookmarkedOnly: params.bookmarkedOnly === 'true' ? true : undefined,
  };

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchCounterRef.current;
    setIsLoading(true);
    try {
      if (isGrouped) {
        const result = await getGuidanceGrouped(jurisdiction, {
          groupBy: params.groupBy,
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.groupSortBy,
          sortOrder: params.sortOrder,
          filters: activeFilters,
        });
        if (fetchId !== fetchCounterRef.current) return;
        if (result.success) {
          setGroupedData(result.data.data);
          setGroupedTotal(result.data.total);
          setGroupedTotalPages(result.data.totalPages);
        }
      } else {
        const result = await getGuidancePaginated(jurisdiction, {
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          filters: activeFilters,
        });
        if (fetchId !== fetchCounterRef.current) return;
        if (result.success) {
          setFlatData(result.data.data);
          setFlatTotal(result.data.total);
        }
      }
    } finally {
      if (fetchId === fetchCounterRef.current) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurisdiction, params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = useCallback((key: string, value: string | number | null) => {
    setParams({ [key]: value, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handleMultiFilterChange = useCallback((key: string, values: string[]) => {
    setParams({ [key]: serializeCommaSeparated(values), page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handleBrowseModeChange = useCallback((mode: GuidanceBrowseModeValue) => {
    setParams({ browseMode: mode, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handleGroupByChange = useCallback((value: string) => {
    setParams({ groupBy: value as GuidanceGroupByValue, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handleGroupSort = useCallback((column: GuidanceGroupSortByValue) => {
    const newOrder = params.groupSortBy === column && params.sortOrder === 'desc' ? 'asc' : 'desc';
    setParams({ groupSortBy: column, sortOrder: newOrder, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams, params.groupSortBy, params.sortOrder]);

  // Bookmark toggle handler
  const handleToggleBookmark = useCallback(async (docId: number) => {
    const docKey = String(docId);
    const wasBookmarked = bookmarkMarkersMap.has(docKey);
    const previousEntry = bookmarkMarkersMap.get(docKey);

    // Optimistic update
    setBookmarkMarkersMap(prev => {
      const next = new Map(prev);
      if (wasBookmarked) {
        next.delete(docKey);
      } else {
        next.set(docKey, { bookmarkId: -1, markers: [], notes: null, createdBy: null });
      }
      return next;
    });

    const result = await toggleGuidanceBookmark(docId, jurisdiction, undefined, bookmarkName || undefined);

    if (!result.success) {
      // Revert to previous state on failure (not fake placeholders)
      setBookmarkMarkersMap(prev => {
        const next = new Map(prev);
        if (previousEntry) {
          next.set(docKey, previousEntry);
        } else {
          next.delete(docKey);
        }
        return next;
      });
    } else {
      // Refresh to get correct bookmark ID
      const refreshed = await getGuidanceDocBookmarkMarkersMap(jurisdiction);
      if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
    }
  }, [jurisdiction, bookmarkName, bookmarkMarkersMap]);

  // Marker toggle handler with optimistic update
  const handleMarkerToggle = useCallback(async (bookmarkId: number, markerGroupId: number, assign: boolean) => {
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
      const refreshed = await getGuidanceDocBookmarkMarkersMap(jurisdiction);
      if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
    }
  }, [bookmarkMarkersMap, markerGroupsList, jurisdiction]);

  // Handle creating a custom marker group and auto-assigning to a guidance doc bookmark
  const handleCreateCustomMarker = useCallback(async (bookmarkId: number, docId: number, name: string) => {
    const result = await getOrCreateCustomMarkerGroup(name, jurisdiction);
    if (result.success) {
      setMarkerGroupsList(prev => prev.some(g => g.id === result.data.id) ? prev : [...prev, result.data]);
      const assignResult = await assignMarkerToBookmark(bookmarkId, result.data.id);
      if (assignResult.success) {
        const key = String(docId);
        setBookmarkMarkersMap(prev => {
          const next = new Map(prev);
          const entry = next.get(key);
          if (entry) {
            const already = entry.markers.some(m => m.id === result.data.id);
            if (!already) {
              next.set(key, { ...entry, markers: [...entry.markers, { id: result.data.id, name: result.data.name, color: result.data.color }] });
            }
          }
          return next;
        });
      } else {
        console.warn('[CreateCustomMarker] assign failed, refreshing markers map');
        const refreshed = await getGuidanceDocBookmarkMarkersMap(jurisdiction);
        if (refreshed.success) setBookmarkMarkersMap(refreshed.data);
      }
    }
  }, [jurisdiction]);

  const activeFilterCount = [
    params.agency && params.agency !== 'all',
    params.docType && params.docType !== 'all',
    params.policyCategory && params.policyCategory !== 'all',
    params.status && params.status !== 'all',
    params.yearFrom,
    params.yearTo,
    params.search,
    params.audienceDirection && params.audienceDirection !== 'all',
    params.sectionType && params.sectionType !== 'all',
    params.readability && params.readability !== 'all',
    params.audienceExpertise && params.audienceExpertise !== 'all',
    selectedTargetAudiences.length > 0,
    params.hasForm,
    params.hasIbr,
    selectedMarkerIds.length > 0,
    params.bookmarkedOnly === 'true',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const advancedFilterCount = [
    params.audienceDirection && params.audienceDirection !== 'all',
    params.sectionType && params.sectionType !== 'all',
    params.readability && params.readability !== 'all',
    params.audienceExpertise && params.audienceExpertise !== 'all',
    selectedTargetAudiences.length > 0,
    params.hasForm,
    params.hasIbr,
    selectedMarkerIds.length > 0,
  ].filter(Boolean).length;

  const markerFilterOptions = useMemo(
    () => markerGroupsList.map(g => ({ value: String(g.id), label: g.name })),
    [markerGroupsList]
  );

  const clearFilters = useCallback(() => {
    setParams({
      agency: null,
      docType: null,
      policyCategory: 'all',
      status: 'all',
      yearFrom: null,
      yearTo: null,
      search: null,
      audienceDirection: 'all',
      sectionType: 'all',
      readability: 'all',
      audienceExpertise: 'all',
      targetAudience: null,
      hasForm: null,
      hasIbr: null,
      marker: null,
      bookmarkedOnly: 'all',
      page: 1,
    } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const clearAdvancedFilters = useCallback(() => {
    setParams({
      audienceDirection: 'all',
      sectionType: 'all',
      readability: 'all',
      audienceExpertise: 'all',
      targetAudience: null,
      hasForm: null,
      hasIbr: null,
      marker: null,
      page: 1,
    } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <SegmentedControl
          options={browseModeOptions}
          value={params.browseMode}
          onChange={handleBrowseModeChange}
          variant="filled"
          size="sm"
        />
        {isGrouped && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Group by:</span>
            <Select
              value={params.groupBy}
              onValueChange={handleGroupByChange}
              options={groupByOptions}
              aria-label="Group by dimension"
            />
          </div>
        )}
      </div>

      <TieredFilterBar
        showSortControls={!isGrouped}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        sortOptions={sortOptions}
        onSortByChange={(v) => handleFilterChange('sortBy', v)}
        onSortOrderToggle={() => handleFilterChange('sortOrder', params.sortOrder === 'desc' ? 'asc' : 'desc')}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        advancedLabel="More Filters"
        advancedCount={advancedFilterCount}
        onClearAdvanced={clearAdvancedFilters}
        primaryFilters={
          <>
            <FilterField label="Agency">
              <Select
                value={params.agency || 'all'}
                onValueChange={(v) => handleFilterChange('agency', v === 'all' ? null : v)}
                options={agencyOptions}
                aria-label="Filter by agency"
              />
            </FilterField>
            <FilterField label="Type">
              <Select
                value={params.docType || 'all'}
                onValueChange={(v) => handleFilterChange('docType', v === 'all' ? null : v)}
                options={docTypeOptions}
                aria-label="Filter by document type"
              />
            </FilterField>
            <FilterField label="Category">
              <Select
                value={params.policyCategory || 'all'}
                onValueChange={(v) => handleFilterChange('policyCategory', v)}
                options={policyCategoryOptions}
                aria-label="Filter by policy category"
              />
            </FilterField>
            <FilterField label="Status">
              <Select
                value={params.status || 'all'}
                onValueChange={(v) => handleFilterChange('status', v)}
                options={statusOptions}
                aria-label="Filter by status"
              />
            </FilterField>
            <FilterField label="Search">
              <SearchInput
                value={params.search || ''}
                onSearch={(v) => handleFilterChange('search', v || null)}
                placeholder="Search title, ref, agency..."
                aria-label="Search guidance documents"
                size="sm"
                isLoading={isLoading}
              />
            </FilterField>
          </>
        }
        quickToggles={
          <>
            <button
              type="button"
              onClick={() => setParams({
                bookmarkedOnly: params.bookmarkedOnly === 'true' ? 'all' : 'true',
                marker: params.bookmarkedOnly === 'true' ? null : params.marker,
                page: 1,
              } as Parameters<typeof setParams>[0])}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)]
                text-xs font-medium transition-colors
                ${params.bookmarkedOnly === 'true'
                  ? 'bg-[var(--color-warning)] text-white'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]'
                }
              `}
              aria-pressed={params.bookmarkedOnly === 'true'}
            >
              <Bookmark className="w-3.5 h-3.5" fill={params.bookmarkedOnly === 'true' ? 'currentColor' : 'none'} />
              Saved
            </button>
          </>
        }
        advancedFilters={
          <>
            <FilterField label="Direction">
              <Select
                value={params.audienceDirection || 'all'}
                onValueChange={(v) => handleFilterChange('audienceDirection', v)}
                options={audienceDirectionOptions}
                aria-label="Filter by audience direction"
              />
            </FilterField>
            <FilterField label="Section Type">
              <Select
                value={params.sectionType || 'all'}
                onValueChange={(v) => handleFilterChange('sectionType', v)}
                options={sectionTypeOptions}
                aria-label="Filter by section type"
              />
            </FilterField>
            <FilterField label="Readability">
              <Select
                value={params.readability || 'all'}
                onValueChange={(v) => handleFilterChange('readability', v)}
                options={readabilityOptions}
                aria-label="Filter by readability"
              />
            </FilterField>
            <FilterField label="Expertise">
              <Select
                value={params.audienceExpertise || 'all'}
                onValueChange={(v) => handleFilterChange('audienceExpertise', v)}
                options={audienceExpertiseOptions}
                aria-label="Filter by audience expertise"
              />
            </FilterField>
            <FilterField label="Target Audience">
              <MultiSelect
                label="Target Audience"
                options={targetAudienceOptions}
                value={selectedTargetAudiences}
                onChange={(values) => handleMultiFilterChange('targetAudience', values)}
                placeholder="All audiences"
                searchable
              />
            </FilterField>
            <FilterField label="Has Form">
              <Select
                value={params.hasForm ? 'yes' : 'no'}
                onValueChange={(v) => setParams({ hasForm: v === 'yes' ? true : null, page: 1 } as Parameters<typeof setParams>[0])}
                options={[
                  { value: 'no', label: 'Any' },
                  { value: 'yes', label: 'Has Form' },
                ]}
                aria-label="Filter by has form"
              />
            </FilterField>
            <FilterField label="Has IBR">
              <Select
                value={params.hasIbr ? 'yes' : 'no'}
                onValueChange={(v) => setParams({ hasIbr: v === 'yes' ? true : null, page: 1 } as Parameters<typeof setParams>[0])}
                options={[
                  { value: 'no', label: 'Any' },
                  { value: 'yes', label: 'Has IBR' },
                ]}
                aria-label="Filter by has IBR"
              />
            </FilterField>
            {params.bookmarkedOnly === 'true' && markerGroupsList.length > 0 && (
              <FilterField label="Label">
                <MultiSelect
                  label="Label"
                  options={markerFilterOptions}
                  value={selectedMarkerIds}
                  onChange={(values) => handleMultiFilterChange('marker', values)}
                  placeholder="All labels"
                />
              </FilterField>
            )}
          </>
        }
      />

      <Card padding="none">
        <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
          <div className="px-4 py-3 border-b border-[var(--color-neutral-200)] flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">
              {total} {isGrouped ? 'group' : 'result'}{total !== 1 ? 's' : ''}
            </span>
            {hasActiveFilters && (
              <Badge variant="info">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
                <span aria-hidden="true" className="mx-1">·</span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="underline hover:text-[var(--color-primary-hover)] transition-colors"
                >
                  Clear
                </button>
              </Badge>
            )}
          </div>
          {isGrouped ? (
            <GroupedGuidanceTable
              data={groupedData}
              total={groupedTotal}
              page={params.page}
              pageSize={params.pageSize}
              totalPages={groupedTotalPages}
              sortBy={params.groupSortBy}
              sortOrder={params.sortOrder}
              isLoading={isLoading}
              jurisdiction={jurisdiction}
              groupBy={params.groupBy}
              onPageChange={handlePageChange}
              onSort={handleGroupSort}
              activeFilters={activeFilters}
              bookmarkedDocIds={bookmarkedDocIds}
              onToggleBookmark={handleToggleBookmark}
              bookmarkMarkersMap={bookmarkMarkersMap}
              availableGroups={markerGroupsList}
              onMarkerToggle={handleMarkerToggle}
              onCreateCustomMarker={handleCreateCustomMarker}
            />
          ) : (
            <>
              <div className="p-4">
                <GuidanceTable
                  data={flatData}
                  state={jurisdiction}
                  bookmarkedDocIds={bookmarkedDocIds}
                  onToggleBookmark={handleToggleBookmark}
                  bookmarkMarkersMap={bookmarkMarkersMap}
                  availableGroups={markerGroupsList}
                  onMarkerToggle={handleMarkerToggle}
                  onCreateCustomMarker={handleCreateCustomMarker}
                />
              </div>
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[var(--color-neutral-200)]">
                  <Pagination
                    page={params.page}
                    totalPages={totalPages}
                    total={flatTotal}
                    pageSize={params.pageSize}
                    showItemCount
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
