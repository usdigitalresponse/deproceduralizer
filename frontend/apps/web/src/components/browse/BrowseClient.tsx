'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { HierarchyNode, HierarchyFilterOptions } from '@deproceduralizer/database';
import { getHierarchyChildren } from '@/lib/actions/hierarchy';
import { Card } from '@/components/ui/Card';
import { HierarchyTree } from './HierarchyTree';
import { BrowseFilters } from './BrowseFilters';
import { DetailPanel } from './DetailPanel';

interface BrowseClientProps {
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
  initialRoots,
  initialOrphans,
  stats,
  filters,
}: BrowseClientProps) {
  // Tree state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadedChildren, setLoadedChildren] = useState<Map<number, HierarchyNode[]>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [showOrphans, setShowOrphans] = useState(false);

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
        // Load children
        setLoadingIds(prev => new Set(prev).add(id));
        try {
          const children = await getHierarchyChildren(id, filters);
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
  }, [expandedIds, loadedChildren, filters]);

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

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    filters.hasAnalysis !== undefined ||
    filters.hasFlags !== undefined ||
    filters.severity !== undefined ||
    filters.hasDefinitions !== undefined
  );

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
      <div className="flex gap-6">
        {/* Tree panel */}
        <div className="w-[400px] shrink-0">
          <Card padding="none" className="h-[calc(100vh-16rem)] overflow-hidden">
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

        {/* Detail panel */}
        <div className="flex-1 min-w-0">
          <DetailPanel
            documentId={selectedId}
            onClose={handleCloseDetail}
          />
        </div>
      </div>
    </div>
  );
}

export default BrowseClient;
