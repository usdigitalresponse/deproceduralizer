'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { StatuteHierarchyNode, JurisdictionCode } from '@deproceduralizer/database';
import { getStatuteHierarchyChildren, searchStatutes } from '@/lib/actions/statutes';
import { Card } from '@/components/ui/Card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui';
import { ResizableDivider } from '@/components/ui/ResizableDivider';
import { useResponsive, useDebouncedValue } from '@/hooks';
import { StatuteHierarchyTree } from './StatuteHierarchyTree';
import { StatuteBrowseFilters } from './StatuteBrowseFilters';
import { StatuteDetailPanel } from './StatuteDetailPanel';

const PANEL_WIDTH_KEY = 'statute-browse-panel-width';
const DEFAULT_PANEL_WIDTH = 400;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH_PERCENT = 0.6;

// Parse expanded IDs from URL param
function parseExpandedIds(param: string | null): Set<number> {
  if (!param) return new Set();
  const ids = param.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
  return new Set(ids);
}

interface StatuteBrowseClientProps {
  jurisdiction: JurisdictionCode;
  initialRoots: StatuteHierarchyNode[];
}

export function StatuteBrowseClient({
  jurisdiction,
  initialRoots,
}: StatuteBrowseClientProps) {
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
  const [loadedChildren, setLoadedChildren] = useState<Map<number, StatuteHierarchyNode[]>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  // Search state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<StatuteHierarchyNode[] | null>(null);

  // Track if we've done initial URL sync to avoid loops
  const isInitialMount = useRef(true);

  // Sync state to URL when selectedId or expandedIds change
  useEffect(() => {
    // Skip the initial mount to avoid unnecessary URL update
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Build new URL params, preserving existing filter params
    const params = new URLSearchParams();

    // Preserve filter params
    const search = searchParams.get('search');
    if (search) params.set('search', search);
    const hasLinks = searchParams.get('hasLinks');
    if (hasLinks) params.set('hasLinks', hasLinks);
    const linkType = searchParams.get('linkType');
    if (linkType && linkType !== 'all') params.set('linkType', linkType);

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
  }, [selectedId, expandedIds]); // Only react to tree state changes

  // On mount, load children for any expanded nodes from URL
  useEffect(() => {
    const loadExpandedChildren = async () => {
      for (const id of expandedIds) {
        if (!loadedChildren.has(id)) {
          try {
            const result = await getStatuteHierarchyChildren(id);
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

  // Search effect
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults(null);
      return;
    }

    const performSearch = async () => {
      try {
        const result = await searchStatutes(jurisdiction.toUpperCase(), debouncedSearch, 50);
        if (result.success) {
          setSearchResults(result.data);
        } else {
          console.error('Search failed:', result.error);
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
    };

    performSearch();
  }, [debouncedSearch, jurisdiction]);

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
        setLoadingIds(prev => new Set(prev).add(id));
        try {
          const result = await getStatuteHierarchyChildren(id);
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
  }, [expandedIds, loadedChildren]);

  // Handle node selection
  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  // Handle closing the detail panel
  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Handle search change from filters
  const handleSearchChange = useCallback((search: string) => {
    setSearchTerm(search);
  }, []);

  // Determine which roots to display (search results or initial roots)
  const displayRoots = searchResults !== null ? searchResults : initialRoots;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <StatuteBrowseFilters
        onSearchChange={handleSearchChange}
      />

      {/* Main content: tree + detail panel */}
      <div ref={containerRef} className="flex flex-col lg:flex-row gap-4 lg:gap-0">
        {/* Tree panel - full width on mobile, resizable on desktop */}
        <div
          className="w-full lg:shrink-0"
          style={isMobile ? undefined : { width: panelWidth }}
        >
          <Card padding="none" className="min-h-[300px] h-[40vh] lg:h-[calc(100vh-16rem)] overflow-hidden">
            <StatuteHierarchyTree
              roots={displayRoots}
              expandedIds={expandedIds}
              selectedId={selectedId}
              loadedChildren={loadedChildren}
              loadingIds={loadingIds}
              searchTerm={debouncedSearch || undefined}
              onToggleExpand={handleToggleExpand}
              onSelect={handleSelect}
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
                <DrawerTitle>Statute Details</DrawerTitle>
                <DrawerClose />
              </DrawerHeader>
              <DrawerBody className="flex-1 p-0">
                <StatuteDetailPanel
                  statuteId={selectedId}
                  state={jurisdiction}
                  onNavigate={handleSelect}
                  fullScreen
                />
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        ) : (
          <div className="flex-1 min-w-0">
            <StatuteDetailPanel
              statuteId={selectedId}
              state={jurisdiction}
              onNavigate={handleSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatuteBrowseClient;
