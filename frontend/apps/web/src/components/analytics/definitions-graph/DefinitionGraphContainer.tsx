'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Network, CircleDot, GitBranch, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { DefinitionForceGraph } from './DefinitionForceGraph';
import { DefinitionChordDiagram } from './DefinitionChordDiagram';
import { DefinitionEdgeBundling } from './DefinitionEdgeBundling';
import {
  transformToGraphData,
  transformToChordData,
  type GraphView,
  type ColorMode,
  type DefinitionEdge,
  type ScopeLevelFlow,
  type DefinitionHierarchyNode,
  type DefinitionGraphData,
  type ChordData,
} from './types';

const VIEW_OPTIONS: SegmentedControlOption<GraphView>[] = [
  { value: 'force', label: 'Force Graph', icon: Network },
  { value: 'chord', label: 'Chord', icon: CircleDot },
  { value: 'edge-bundle', label: 'Hierarchy', icon: GitBranch },
];

const COLOR_MODE_OPTIONS: SegmentedControlOption<ColorMode>[] = [
  { value: 'default', label: 'Connectivity' },
  { value: 'edge-type', label: 'Edge Type' },
  { value: 'scope-level', label: 'Scope Level' },
  { value: 'definition-type', label: 'Def Type' },
];

interface DefinitionGraphContainerProps {
  state: string;
  edges: DefinitionEdge[];
  flows: ScopeLevelFlow[];
  hierarchy: DefinitionHierarchyNode;
  isLoading?: boolean;
}

export function DefinitionGraphContainer({
  state,
  edges,
  flows,
  hierarchy,
  isLoading = false,
}: DefinitionGraphContainerProps) {
  const [view, setView] = useState<GraphView>('force');
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height: 500 });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Transform data for each view
  const graphData: DefinitionGraphData = useMemo(() => transformToGraphData(edges), [edges]);
  const chordData: ChordData = useMemo(() => transformToChordData(flows), [flows]);

  // Stats for the header
  const stats = useMemo(() => {
    return {
      nodes: graphData.nodes.length,
      edges: graphData.links.length,
      scopeLevels: chordData.keys.length,
    };
  }, [graphData, chordData]);

  if (isLoading) {
    return (
      <Card padding="none">
        <div className="p-4 border-b border-[var(--color-neutral-200)]">
          <div className="h-6 w-48 bg-[var(--color-neutral-100)] rounded animate-pulse" />
        </div>
        <div className="flex items-center justify-center h-[500px]">
          <RefreshCw className="w-6 h-6 text-[var(--color-text-muted)] animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      {/* Header with controls */}
      <div className="p-4 border-b border-[var(--color-neutral-200)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Definition Relationships</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {stats.nodes} terms &middot; {stats.edges} connections
            </p>
          </div>

          <SegmentedControl
            options={VIEW_OPTIONS}
            value={view}
            onChange={setView}
            size="sm"
          />
        </div>

        {/* Color mode selector for force graph */}
        {view === 'force' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Color by:</span>
            <SegmentedControl
              options={COLOR_MODE_OPTIONS}
              value={colorMode}
              onChange={setColorMode}
              size="sm"
              variant="outlined"
            />
          </div>
        )}
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="relative" style={{ minHeight: 500 }}>
        {view === 'force' && graphData.nodes.length > 0 && (
          <DefinitionForceGraph
            data={graphData}
            width={dimensions.width}
            height={dimensions.height}
            state={state}
            colorMode={colorMode}
          />
        )}

        {view === 'chord' && chordData.keys.length > 0 && (
          <DefinitionChordDiagram
            data={chordData}
            height={dimensions.height}
          />
        )}

        {view === 'edge-bundle' && hierarchy.children && hierarchy.children.length > 0 && (
          <DefinitionEdgeBundling
            data={hierarchy}
            width={dimensions.width}
            height={dimensions.height}
            state={state}
          />
        )}

        {/* Empty states */}
        {view === 'force' && graphData.nodes.length === 0 && (
          <div className="flex items-center justify-center h-[500px] text-[var(--color-text-muted)]">
            No definition relationships found
          </div>
        )}
        {view === 'chord' && chordData.keys.length === 0 && (
          <div className="flex items-center justify-center h-[500px] text-[var(--color-text-muted)]">
            No scope flow data available
          </div>
        )}
        {view === 'edge-bundle' && (!hierarchy.children || hierarchy.children.length === 0) && (
          <div className="flex items-center justify-center h-[500px] text-[var(--color-text-muted)]">
            No hierarchy data available
          </div>
        )}
      </div>

      {/* Legend and explanation based on view */}
      {view === 'force' && graphData.nodes.length > 0 && (
        <div className="p-3 border-t border-[var(--color-neutral-200)] text-xs space-y-2">
          <p className="text-[var(--color-text-secondary)]">
            <strong>Force Graph:</strong> Each node represents a definition term. Connected terms share relationships
            (same term defined in multiple places, shared scope, or appear together in documents).
            Drag nodes to explore clusters. Hover for details.
          </p>
          <div className="flex flex-wrap gap-4 text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-[2px] bg-[#3b82f680]" />
              Same term (defined multiple times)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-[2px] bg-[#22c55e80]" />
              Shared scope (same scope document)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-[2px] bg-[#a855f780]" />
              Co-occurrence (used in same documents)
            </span>
          </div>
        </div>
      )}

      {view === 'chord' && chordData.keys.length > 0 && (
        <div className="p-3 border-t border-[var(--color-neutral-200)] text-xs space-y-2">
          <p className="text-[var(--color-text-secondary)]">
            <strong>Chord Diagram:</strong> Shows how definitions are used across different hierarchy levels.
            Each arc segment represents a scope level (Title, Chapter, Part, Section).
            Ribbons connect levels where definitions from one level are used in documents at another level.
            Thicker ribbons = more definitions flowing between those levels.
          </p>
          <div className="flex flex-wrap gap-3 text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
              Title
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              Chapter
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              Part
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              Section
            </span>
          </div>
        </div>
      )}

      {view === 'edge-bundle' && hierarchy.children && hierarchy.children.length > 0 && (
        <div className="p-3 border-t border-[var(--color-neutral-200)] text-xs">
          <p className="text-[var(--color-text-secondary)]">
            <strong>Hierarchy View:</strong> Shows the regulatory document hierarchy as a radial tree.
            Outer nodes are sections containing definitions. Lines connect sections that share definitions
            or where definitions from one section are used in another. Hover over nodes to highlight connections.
          </p>
        </div>
      )}
    </Card>
  );
}
