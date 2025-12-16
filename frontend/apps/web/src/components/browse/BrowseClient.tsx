'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { HierarchyNode, HierarchyFilterOptions, StateCode } from '@deproceduralizer/database';
import { getHierarchyChildren, getHierarchyChildrenFast } from '@/lib/actions/hierarchy';
import { Card } from '@/components/ui/Card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui';
import { useResponsive } from '@/hooks';
import { HierarchyTree } from './HierarchyTree';
import { BrowseFilters } from './BrowseFilters';
import { DetailPanel } from './DetailPanel';

// Parse expanded IDs from URL param
function parseExpandedIds(param: string | null): Set<number> {
  if (!param) return new Set();
  const ids = param.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
  return new Set(ids);
}

interface BrowseClientProps {
  state: StateCode;
  initialRoots: HierarchyNode[];
  initialOrphans: HierarchyNode[];
  stats: {
    level: string;
    count: number;
    analyzedCount: number;
    flaggedCount: number;
  }[];
  filters: HierarchyFilterOptions;
}

export function BrowseClient({
  state,
  initialRoots,
  initialOrphans,
  stats,
  filters,
}: BrowseClientProps) {
  // Responsive state
  const { isMobile } = useResponsive();

  // URL state management
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const initialSelected = searchParams.get('selected');
  const initialExpanded = searchParams.get('expanded');

  // Tree state - initialized from URL params
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => parseExpandedIds(initialExpanded));
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelected ? parseInt(initialSelected, 10) || null : null
  );
  const [loadedChildren, setLoadedChildren] = useState<Map<number, HierarchyNode[]>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [showOrphans, setShowOrphans] = useState(false);

  // Track if we've done initial URL sync to avoid loops
  const isInitialMount = useRef(true);

  // Check if any filters are active (need this before handleToggleExpand)
  const hasActiveFilters = Boolean(
    filters.hasAnalysis !== undefined ||
    filters.hasFlags !== undefined ||
    filters.severity !== undefined ||
    filters.hasDefinitions !== undefined
  );

  // Sync state to URL when selectedId or expandedIds change
  useEffect(() => {
    // Skip the initial mount to avoid unnecessary URL update
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Build new URL params, preserving existing filter params
    const params = new URLSearchParams();

    // Preserve filter params from props (already parsed by server)
    if (filters.hasAnalysis !== undefined) {
      params.set('analyzed', String(filters.hasAnalysis));
    }
    if (filters.hasFlags !== undefined) {
      params.set('hasFlags', String(filters.hasFlags));
    }
    if (filters.severity) {
      params.set('severity', filters.severity);
    }
    if (filters.hasDefinitions !== undefined) {
      params.set('hasDefs', String(filters.hasDefinitions));
    }

    // Add tree state params
    if (selectedId) {
      params.set('selected', String(selectedId));
    }
    if (expandedIds.size > 0) {
      params.set('expanded', Array.from(expandedIds).join(','));
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, expandedIds]); // Only react to tree state changes, not URL changes

  // On mount, load children for any expanded nodes from URL
  useEffect(() => {
    const loadExpandedChildren = async () => {
      for (const id of expandedIds) {
        if (!loadedChildren.has(id)) {
          try {
            const children = hasActiveFilters
              ? await getHierarchyChildren(id, state, filters)
              : await getHierarchyChildrenFast(id);
            setLoadedChildren(prev => new Map(prev).set(id, children));
          } catch (error) {
            console.error('Failed to load children for expanded node:', error);
          }
        }
      }
    };

    if (expandedIds.size > 0) {
      loadExpandedChildren();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Handle node expansion
  const handleToggleExpand = useCallback(async (id: number) => {
    const newExpanded = new Set(expandedIds);

    if (newExpanded.has(id)) {
      // Collapse
      newExpanded.delete(id);
      setExpandedIds(newExpanded);
    } else {
      // Expand - load children if not already loaded
      newExpanded.add(id);
      setExpandedIds(newExpanded);

      if (!loadedChildren.has(id)) {
        // Load children - use fast query when no filters active
        setLoadingIds(prev => new Set(prev).add(id));
        try {
          const children = hasActiveFilters
            ? await getHierarchyChildren(id, state, filters)
            : await getHierarchyChildrenFast(id);
          setLoadedChildren(prev => new Map(prev).set(id, children));
        } catch (error) {
          console.error('Failed to load children:', error);
        } finally {
          setLoadingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }
    }
  }, [expandedIds, loadedChildren, filters, state, hasActiveFilters]);

  // Handle node selection
  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  // Handle closing the detail panel
  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Toggle orphans section
  const handleToggleOrphans = useCallback(() => {
    setShowOrphans(prev => !prev);
  }, []);

  // Serialize filters for dependency comparison
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // Reset tree state when filters change
  useEffect(() => {
    setLoadedChildren(new Map());
    setExpandedIds(new Set());
  }, [filtersKey]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <BrowseFilters
        currentFilters={filters}
        stats={stats}
      />

      {/* Main content: tree + detail panel */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Tree panel - full width on mobile, fixed width on desktop */}
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <Card padding="none" className="h-[50vh] lg:h-[calc(100vh-16rem)] overflow-hidden">
            <HierarchyTree
              roots={initialRoots}
              orphans={initialOrphans}
              expandedIds={expandedIds}
              selectedId={selectedId}
              loadedChildren={loadedChildren}
              loadingIds={loadingIds}
              hasActiveFilters={hasActiveFilters}
              onToggleExpand={handleToggleExpand}
              onSelect={handleSelect}
              showOrphans={showOrphans}
              onToggleOrphans={handleToggleOrphans}
            />
          </Card>
        </div>

        {/* Detail panel - side panel on desktop, drawer on mobile */}
        {isMobile ? (
          <Drawer open={!!selectedId} onOpenChange={(open) => !open && handleCloseDetail()}>
            <DrawerContent side="right" size="full" className="flex flex-col">
              <DrawerHeader>
                <DrawerTitle>Regulation Details</DrawerTitle>
                <DrawerClose />
              </DrawerHeader>
              <DrawerBody className="flex-1 p-0">
                <DetailPanel
                  documentId={selectedId}
                  onClose={handleCloseDetail}
                  onNavigate={handleSelect}
                  fullScreen
                />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        ) : (
          <div className="flex-1 min-w-0">
            <DetailPanel
              documentId={selectedId}
              onClose={handleCloseDetail}
              onNavigate={handleSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowseClient;
