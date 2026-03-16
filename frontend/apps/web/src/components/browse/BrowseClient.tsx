'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { HierarchyNode, HierarchyFilterOptions, JurisdictionCode } from '@deproceduralizer/database';
import { getHierarchyChildren, getHierarchyChildrenFast } from '@/lib/actions/hierarchy';
import { getDocumentReferenceContext } from '@/lib/actions/cross-references';
import { Card } from '@/components/ui/Card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui';
import { ResizableDivider } from '@/components/ui/ResizableDivider';
import { ReferenceHighlightLegend } from './ReferenceHighlightLegend';
import { useResponsive } from '@/hooks';
import { HierarchyTree } from './HierarchyTree';
import { BrowseFilters } from './BrowseFilters';
import { DetailPanel } from './DetailPanel';
import type { HighlightType } from './ReferenceHighlightContext';

const PANEL_WIDTH_KEY = 'browse-panel-width';
const DEFAULT_PANEL_WIDTH = 400;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH_PERCENT = 0.6;

// Parse expanded IDs from URL param
function parseExpandedIds(param: string | null): Set<number> {
  if (!param) return new Set();
  const ids = param.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
  return new Set(ids);
}

interface BrowseClientProps {
  jurisdiction: JurisdictionCode;
  initialRoots: HierarchyNode[];
  initialOrphans: HierarchyNode[];
  stats: {
    level: string;
    count: number;
  }[];
  filters: HierarchyFilterOptions;
  search?: string;
}

export function BrowseClient({
  jurisdiction,
  initialRoots,
  initialOrphans,
  stats,
  filters,
  search = '',
}: BrowseClientProps) {
  // Responsive state
  const { isMobile } = useResponsive();

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load panel width from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_PANEL_WIDTH) {
        setPanelWidth(width);
      }
    }
  }, []);

  // Handle panel resize
  const handlePanelResize = useCallback((delta: number) => {
    setPanelWidth(prev => {
      const container = containerRef.current;
      const maxWidth = container
        ? container.clientWidth * MAX_PANEL_WIDTH_PERCENT
        : 800;
      return Math.min(Math.max(prev + delta, MIN_PANEL_WIDTH), maxWidth);
    });
  }, []);

  // Save to localStorage when resize ends
  const handlePanelResizeEnd = useCallback(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  // Reset panel width to default
  const handlePanelReset = useCallback(() => {
    setPanelWidth(DEFAULT_PANEL_WIDTH);
    localStorage.setItem(PANEL_WIDTH_KEY, String(DEFAULT_PANEL_WIDTH));
  }, []);

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

  // Reference highlight state for cross-reference visualization
  const [referencesIds, setReferencesIds] = useState<Set<number>>(new Set());
  const [referencedByIds, setReferencedByIds] = useState<Set<number>>(new Set());

  // Track if we've done initial URL sync to avoid loops
  const isInitialMount = useRef(true);

  // Check if any filters are active (need this before handleToggleExpand)
  const hasActiveFilters = Boolean(
    search ||
    filters.hasDefinitions !== undefined ||
    filters.hasComplianceIssues !== undefined
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
    if (search) {
      params.set('search', search);
    }
    if (filters.hasDefinitions !== undefined) {
      params.set('hasDefs', String(filters.hasDefinitions));
    }
    if (filters.hasComplianceIssues !== undefined) {
      params.set('hasCompliance', String(filters.hasComplianceIssues));
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
            const result = hasActiveFilters
              ? await getHierarchyChildren(id, jurisdiction, filters)
              : await getHierarchyChildrenFast(id);
            if (result.success) {
              setLoadedChildren(prev => new Map(prev).set(id, result.data));
            } else {
              console.error('Failed to load children for expanded node:', result.error);
            }
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
          const result = hasActiveFilters
            ? await getHierarchyChildren(id, jurisdiction, filters)
            : await getHierarchyChildrenFast(id);
          if (result.success) {
            setLoadedChildren(prev => new Map(prev).set(id, result.data));
          } else {
            console.error('Failed to load children:', result.error);
          }
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
  }, [expandedIds, loadedChildren, filters, jurisdiction, hasActiveFilters]);

  // Handle node selection
  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  // Fetch reference context when selection changes (for tree highlighting)
  useEffect(() => {
    if (!selectedId) {
      setReferencesIds(new Set());
      setReferencedByIds(new Set());
      return;
    }

    const fetchReferenceContext = async () => {
      try {
        const result = await getDocumentReferenceContext(selectedId);
        if (result.success) {
          setReferencesIds(new Set(result.data.outgoingRefs.map((r) => r.targetId)));
          setReferencedByIds(new Set(result.data.incomingRefs.map((r) => r.sourceId)));
        }
      } catch (error) {
        console.error('Failed to fetch reference context:', error);
      }
    };

    fetchReferenceContext();
  }, [selectedId]);

  // Get highlight type for a document based on its relationship to selected document
  const getHighlightType = useCallback(
    (docId: number): HighlightType => {
      if (!selectedId) return null;
      if (referencesIds.has(docId)) return 'references';
      if (referencedByIds.has(docId)) return 'referencedBy';
      return null;
    },
    [selectedId, referencesIds, referencedByIds]
  );

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
      <BrowseFilters stats={stats} />

      {/* Main content: tree + detail panel */}
      <div ref={containerRef} className="flex flex-col lg:flex-row gap-4 lg:gap-0">
        {/* Tree panel - full width on mobile, resizable on desktop */}
        <div
          className="w-full lg:shrink-0"
          style={isMobile ? undefined : { width: panelWidth }}
        >
          <Card padding="none" className="min-h-[300px] h-[40vh] lg:h-[calc(100vh-16rem)] overflow-hidden">
            <HierarchyTree
              roots={initialRoots}
              orphans={initialOrphans}
              expandedIds={expandedIds}
              selectedId={selectedId}
              loadedChildren={loadedChildren}
              loadingIds={loadingIds}
              hasActiveFilters={hasActiveFilters}
              searchTerm={search}
              getHighlightType={getHighlightType}
              onToggleExpand={handleToggleExpand}
              onSelect={handleSelect}
              showOrphans={showOrphans}
              onToggleOrphans={handleToggleOrphans}
            />
          </Card>
        </div>

        {/* Resizable divider - desktop only */}
        {!isMobile && (
          <ResizableDivider
            onResize={handlePanelResize}
            onResizeEnd={handlePanelResizeEnd}
            onReset={handlePanelReset}
            className="mx-2 hidden lg:block"
          />
        )}

        {/* Detail panel - side panel on desktop, drawer on mobile */}
        {isMobile ? (
          <Drawer open={!!selectedId} onOpenChange={(open) => !open && handleCloseDetail()}>
            <DrawerContent side="right" size="full" className="flex flex-col">
              <DrawerHeader>
                <DrawerTitle>Regulation Details</DrawerTitle>
                <DrawerClose />
              </DrawerHeader>
              <DrawerBody className="flex-1 p-0">
                <ReferenceHighlightLegend
                  hasReferences={referencesIds.size > 0}
                  hasReferencedBy={referencedByIds.size > 0}
                />
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
          <div className="flex-1 min-w-0 space-y-2">
            <ReferenceHighlightLegend
              hasReferences={referencesIds.size > 0}
              hasReferencedBy={referencedByIds.size > 0}
            />
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
