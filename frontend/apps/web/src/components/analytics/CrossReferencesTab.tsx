'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui';
import { NetworkGraph, HubsPanel, CircularRefsPanel, transformToGraphData } from './cross-references';
import type { GraphData, GraphNode, TitleReferenceEdge, DocumentHub, CircularReference } from './cross-references';
import type { StateCode } from '@deproceduralizer/database';
import {
  getTitleLevelReferenceGraph,
  getTopCitedDocuments,
  getCircularReferences,
} from '@/lib/actions/cross-references';

interface CrossReferencesTabProps {
  state: StateCode;
}

export function CrossReferencesTab({ state }: CrossReferencesTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Data states
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [hubs, setHubs] = useState<DocumentHub[]>([]);
  const [cycles, setCycles] = useState<CircularReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [graphResult, hubsResult, cyclesResult] = await Promise.all([
          getTitleLevelReferenceGraph(state),
          getTopCitedDocuments(state, 20, hubSortBy),
          getCircularReferences(state, 4),
        ]);

        if (graphResult.success) {
          setGraphData(transformToGraphData(graphResult.data));
        } else {
          setError(graphResult.error);
        }

        if (hubsResult.success) {
          setHubs(hubsResult.data);
        }

        if (cyclesResult.success) {
          setCycles(cyclesResult.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [state, hubSortBy]);

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
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="md">
          <div className="text-sm text-[var(--color-text-muted)]">Titles</div>
          <div className="text-2xl font-semibold">{graphData?.nodes.length ?? 0}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-[var(--color-text-muted)]">Connections</div>
          <div className="text-2xl font-semibold">{graphData?.links.length ?? 0}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-[var(--color-text-muted)]">Circular Refs</div>
          <div className="text-2xl font-semibold">{cycles.length}</div>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-[var(--color-neutral-200)]">
              <h3 className="font-semibold">Title-Level Reference Network</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Each node is a regulatory title. Edges show cross-references between titles.
                Larger nodes have more references.
              </p>
            </div>
            <div ref={containerRef} className="min-h-[500px]">
              {graphData && (
                <NetworkGraph
                  data={graphData}
                  width={dimensions.width}
                  height={dimensions.height}
                  selectedNode={selectedNode}
                  circularRefNodes={circularRefNodes}
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
            state={state}
            sortBy={hubSortBy}
            onSortChange={setHubSortBy}
          />
          <CircularRefsPanel
            cycles={cycles}
            selectedCycle={selectedCycle}
            onCycleClick={handleCycleClick}
          />
        </div>
      </div>
    </div>
  );
}
