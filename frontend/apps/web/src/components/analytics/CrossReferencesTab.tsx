'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, SegmentedControl, Button } from '@/components/ui';
import { NetworkGraph, HubsPanel, CircularRefsPanel, transformToGraphData, mergeGuidanceEdges } from './cross-references';
import type {
  GraphData,
  GraphNode,
  ReferenceEdge,
  DocumentHub,
  CircularReference,
  GraphLevel,
  ColorMode,
  GuidanceReferenceEdge,
} from './cross-references';
import type { JurisdictionCode } from '@/types/state';
import {
  getReferenceGraph,
  getTopCitedDocuments,
  getCircularReferences,
  getGuidanceReferenceGraph,
} from '@/lib/actions/cross-references';

interface CrossReferencesTabProps {
  jurisdiction: JurisdictionCode;
}

const LEVEL_OPTIONS = [
  { value: 'title' as const, label: 'Title' },
  { value: 'chapter' as const, label: 'Chapter' },
  { value: 'part' as const, label: 'Part' },
  { value: 'section' as const, label: 'Section' },
];

const COLOR_OPTIONS = [
  { value: 'default' as const, label: 'Default' },
  { value: 'direction' as const, label: 'Direction' },
  { value: 'degree' as const, label: 'Degree' },
  { value: 'type' as const, label: 'Type' },
];

const TYPE_COLORS: Record<string, { color: string; label: string }> = {
  requirements: { color: '#3b82f6', label: 'Requirements' },
  procedures: { color: '#8b5cf6', label: 'Procedures' },
  scope: { color: '#06b6d4', label: 'Scope' },
  standards: { color: '#f97316', label: 'Standards' },
  definitions: { color: '#22c55e', label: 'Definitions' },
  purpose: { color: '#14b8a6', label: 'Purpose' },
  prohibitions: { color: '#ef4444', label: 'Prohibitions' },
  eligibility: { color: '#eab308', label: 'Eligibility' },
  reserved: { color: '#9ca3af', label: 'Reserved' },
  penalties: { color: '#dc2626', label: 'Penalties' },
  exemptions: { color: '#84cc16', label: 'Exemptions' },
  enforcement: { color: '#f43f5e', label: 'Enforcement' },
};

export function CrossReferencesTab({ jurisdiction }: CrossReferencesTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Control states
  const [level, setLevel] = useState<GraphLevel>('title');
  const [colorMode, setColorMode] = useState<ColorMode>('direction');

  // Data states
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [hubs, setHubs] = useState<DocumentHub[]>([]);
  const [cycles, setCycles] = useState<CircularReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCyclesLoading, setIsCyclesLoading] = useState(false);
  const [cyclesLoaded, setCyclesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guidance overlay states
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidanceEdges, setGuidanceEdges] = useState<GuidanceReferenceEdge[] | null>(null);
  const [isGuidanceLoading, setIsGuidanceLoading] = useState(false);

  // UI states
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<number[] | null>(null);
  const [hubSortBy, setHubSortBy] = useState<'in' | 'out' | 'total'>('total');

  // Compute circular ref nodes for highlighting
  const circularRefNodes = new Set<string>();
  if (selectedCycle) {
    // We'd need to map document IDs to title IDs here
    // For now, this is a placeholder
  }

  // Load graph and hubs on mount or level change
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [graphResult, hubsResult] = await Promise.all([
          getReferenceGraph(jurisdiction, level),
          getTopCitedDocuments(jurisdiction, 20, hubSortBy),
        ]);

        if (graphResult.success) {
          setGraphData(transformToGraphData(graphResult.data));
        } else {
          setError(graphResult.error);
        }

        if (hubsResult.success) {
          setHubs(hubsResult.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [jurisdiction, level, hubSortBy]);

  // Load circular refs on demand (expensive query)
  const loadCircularRefs = useCallback(async () => {
    setIsCyclesLoading(true);
    try {
      const result = await getCircularReferences(jurisdiction, 3); // Use depth 3 to be faster
      if (result.success) {
        setCycles(result.data);
        setCyclesLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load circular refs:', err);
    } finally {
      setIsCyclesLoading(false);
    }
  }, [jurisdiction]);

  // Load guidance overlay on toggle
  const handleGuidanceToggle = useCallback(async () => {
    const next = !showGuidance;
    setShowGuidance(next);
    if (next && guidanceEdges === null) {
      setIsGuidanceLoading(true);
      try {
        const result = await getGuidanceReferenceGraph(jurisdiction);
        if (result.success) {
          setGuidanceEdges(result.data);
        }
      } catch (err) {
        console.error('Failed to load guidance references:', err);
      } finally {
        setIsGuidanceLoading(false);
      }
    }
  }, [showGuidance, guidanceEdges, jurisdiction]);

  // Compute merged graph data (with guidance overlay when toggled)
  const displayGraphData = useMemo(() => {
    if (!graphData) return null;
    if (showGuidance && guidanceEdges && guidanceEdges.length > 0) {
      return mergeGuidanceEdges(graphData, guidanceEdges);
    }
    return graphData;
  }, [graphData, showGuidance, guidanceEdges]);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, entry.contentRect.height),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handleCycleClick = useCallback((cycle: CircularReference) => {
    setSelectedCycle((prev) =>
      prev && prev.length === cycle.cycle.length && prev.every((id, i) => id === cycle.cycle[i])
        ? null
        : cycle.cycle
    );
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card padding="lg" className="min-h-[500px] flex items-center justify-center">
          <div className="text-center text-[var(--color-text-muted)]">
            <div className="animate-pulse">Loading cross-reference graph...</div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card padding="lg" className="min-h-[200px] flex items-center justify-center">
          <div className="text-center text-[var(--color-danger)]">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Level:</span>
          <SegmentedControl
            options={LEVEL_OPTIONS}
            value={level}
            onChange={setLevel}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Color:</span>
          <SegmentedControl
            options={COLOR_OPTIONS}
            value={colorMode}
            onChange={setColorMode}
            size="sm"
          />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showGuidance}
            onChange={handleGuidanceToggle}
            disabled={isGuidanceLoading}
            className="rounded border-[var(--color-neutral-300)] text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-[var(--color-text-muted)]">
            {isGuidanceLoading ? 'Loading...' : 'Show Guidance'}
          </span>
        </label>
        <div className="flex-1" />
        <div className="text-sm text-[var(--color-text-muted)]">
          {displayGraphData?.nodes.length ?? 0} nodes, {displayGraphData?.links.length ?? 0} edges
        </div>
      </div>

      {/* Color legend */}
      {(colorMode !== 'default' || showGuidance) && (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {showGuidance && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#0d9488]" />
              Guidance (by agency)
            </span>
          )}
        </div>
      )}
      {colorMode !== 'default' && (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {colorMode === 'direction' && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                More outgoing
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#a855f7]" />
                Balanced
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
                More incoming (hubs)
              </span>
            </>
          )}
          {colorMode === 'degree' && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[var(--color-neutral-400)]" />
                Low
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#facc15]" />
                Medium
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#f97316]" />
                High
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#dc2626]" />
                Very high
              </span>
            </>
          )}
          {colorMode === 'type' && (
            <>
              {level !== 'section' && (
                <span className="text-[var(--color-warning)]">
                  Type coloring only available at Section level
                </span>
              )}
              {level === 'section' &&
                Object.entries(TYPE_COLORS).map(([key, { color, label }]) => (
                  <span key={key} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
            </>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-[var(--color-neutral-200)]">
              <h3 className="font-semibold">
                {level.charAt(0).toUpperCase() + level.slice(1)}-Level Reference Network
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Each node is a regulatory {level}. Edges show cross-references.
                Larger nodes have more references.
              </p>
            </div>
            <div ref={containerRef} className="min-h-[500px]">
              {displayGraphData && (
                <NetworkGraph
                  data={displayGraphData}
                  width={dimensions.width}
                  height={dimensions.height}
                  state={jurisdiction}
                  level={level}
                  selectedNode={selectedNode}
                  circularRefNodes={circularRefNodes}
                  colorMode={colorMode}
                  onNodeClick={handleNodeClick}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Side panels */}
        <div className="space-y-6">
          <HubsPanel
            hubs={hubs}
            state={jurisdiction}
            sortBy={hubSortBy}
            onSortChange={setHubSortBy}
          />

          {/* Circular refs - lazy loaded */}
          {cyclesLoaded ? (
            <CircularRefsPanel
              cycles={cycles}
              selectedCycle={selectedCycle}
              onCycleClick={handleCycleClick}
            />
          ) : (
            <Card padding="md">
              <h3 className="font-semibold text-sm mb-2">Circular References</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                Detect reference cycles in the corpus. This query may take a few seconds.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadCircularRefs}
                disabled={isCyclesLoading}
                className="w-full"
              >
                {isCyclesLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  'Detect Circular Refs'
                )}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
