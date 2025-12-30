'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { DefinitionGraphData, DefinitionGraphNode, DefinitionGraphLink, ColorMode } from './types';
import { DefinitionNodePopup } from './DefinitionNodePopup';

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-[var(--color-text-muted)]">Loading graph...</div>
    </div>
  ),
});

interface DefinitionForceGraphProps {
  data: DefinitionGraphData;
  width: number;
  height: number;
  state: string;
  selectedNode?: string | null;
  colorMode?: ColorMode;
  onNodeClick?: (node: DefinitionGraphNode) => void;
}

export function DefinitionForceGraph({
  data,
  width,
  height,
  state,
  selectedNode,
  colorMode = 'default',
  onNodeClick,
}: DefinitionForceGraphProps) {
  const graphRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [popupNode, setPopupNode] = useState<DefinitionGraphNode | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  // Calculate max degree for scaling
  const maxDegree = useMemo(() => {
    return Math.max(...data.nodes.map((n) => n.totalDegree), 1);
  }, [data.nodes]);

  // Center graph on mount
  useEffect(() => {
    const graph = graphRef.current as { zoomToFit?: (ms: number, padding: number) => void } | null;
    if (graph?.zoomToFit) {
      setTimeout(() => {
        graph?.zoomToFit?.(400, 50);
      }, 500);
    }
  }, [data]);

  // Node size based on total degree (scaled)
  const getNodeSize = useCallback((node: DefinitionGraphNode) => {
    const baseSize = 4;
    const scale = Math.sqrt(node.totalDegree) * 0.5;
    return baseSize + Math.min(scale, 20);
  }, []);

  // Get color based on edge type (most common relationship for this node)
  const getEdgeTypeColor = useCallback(
    (node: DefinitionGraphNode) => {
      // Find the most common edge type for this node
      const edgeCounts = { same_term: 0, shared_scope: 0, shared_occurrence: 0 };
      for (const link of data.links) {
        if (link.source === node.id || link.target === node.id) {
          edgeCounts[link.edgeType] += link.weight;
        }
      }

      const max = Math.max(edgeCounts.same_term, edgeCounts.shared_scope, edgeCounts.shared_occurrence);
      if (max === 0) return 'var(--color-neutral-400)';
      if (edgeCounts.same_term === max) return '#3b82f6'; // Blue - same term
      if (edgeCounts.shared_scope === max) return '#22c55e'; // Green - shared scope
      return '#a855f7'; // Purple - shared occurrence
    },
    [data.links]
  );

  // Get color based on scope level
  const getScopeLevelColor = useCallback((node: DefinitionGraphNode) => {
    const levelColors: Record<string, string> = {
      section: '#3b82f6', // Blue
      part: '#22c55e', // Green
      chapter: '#f97316', // Orange
      title: '#dc2626', // Red
    };
    return levelColors[node.scopeLevel ?? ''] ?? 'var(--color-neutral-400)';
  }, []);

  // Get color based on definition type
  const getDefinitionTypeColor = useCallback((node: DefinitionGraphNode) => {
    const typeColors: Record<string, string> = {
      formal: '#3b82f6', // Blue
      abbreviation: '#a855f7', // Purple
    };
    return typeColors[node.definitionType ?? ''] ?? 'var(--color-neutral-400)';
  }, []);

  // Get color based on connectivity (degree)
  const getDegreeColor = useCallback(
    (node: DefinitionGraphNode) => {
      const intensity = node.totalDegree / maxDegree;
      if (intensity > 0.7) return '#dc2626'; // High - red
      if (intensity > 0.4) return '#f97316'; // Medium - orange
      if (intensity > 0.15) return '#facc15'; // Low-medium - yellow
      return 'var(--color-neutral-400)'; // Low - gray
    },
    [maxDegree]
  );

  // Node color based on state and color mode
  const getNodeColor = useCallback(
    (node: DefinitionGraphNode) => {
      // Selected node
      if (node.id === selectedNode) {
        return 'var(--color-primary)';
      }
      // Hovered node
      if (node.id === hoveredNode) {
        return 'var(--color-info)';
      }

      // Apply color mode
      switch (colorMode) {
        case 'edge-type':
          return getEdgeTypeColor(node);
        case 'scope-level':
          return getScopeLevelColor(node);
        case 'definition-type':
          return getDefinitionTypeColor(node);
        default:
          return getDegreeColor(node);
      }
    },
    [selectedNode, hoveredNode, colorMode, getEdgeTypeColor, getScopeLevelColor, getDefinitionTypeColor, getDegreeColor]
  );

  // Link width based on weight
  const getLinkWidth = useCallback((link: DefinitionGraphLink) => {
    return Math.sqrt(link.weight) * 0.3 + 0.5;
  }, []);

  // Link color based on edge type
  const getLinkColor = useCallback(
    (link: DefinitionGraphLink) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as DefinitionGraphNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as DefinitionGraphNode).id;

      // Highlight links connected to selected node
      if (selectedNode && (sourceId === selectedNode || targetId === selectedNode)) {
        return 'var(--color-primary)';
      }
      // Highlight links connected to hovered node
      if (hoveredNode && (sourceId === hoveredNode || targetId === hoveredNode)) {
        return 'var(--color-info)';
      }

      // Color by edge type
      const typeColors: Record<string, string> = {
        same_term: '#3b82f680', // Blue with transparency
        shared_scope: '#22c55e80', // Green with transparency
        shared_occurrence: '#a855f780', // Purple with transparency
      };
      return typeColors[link.edgeType] ?? 'var(--color-neutral-300)';
    },
    [selectedNode, hoveredNode]
  );

  const handleNodeClick = useCallback(
    (node: DefinitionGraphNode, event: MouseEvent) => {
      // Show popup at click position
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setPopupPosition({
          x: event.clientX - containerRect.left + 10,
          y: event.clientY - containerRect.top + 10,
        });
      }
      setPopupNode(node);
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  const handleClosePopup = useCallback(() => {
    setPopupNode(null);
  }, []);

  const handleNodeHover = useCallback((node: DefinitionGraphNode | null) => {
    setHoveredNode(node?.id ?? null);
  }, []);

  // Create tooltip text
  const getNodeLabel = useCallback((node: DefinitionGraphNode) => {
    const parts = [node.term];
    if (node.citation) parts.push(node.citation);
    parts.push(`${node.totalDegree} connections (${node.inDegree} in, ${node.outDegree} out)`);
    return parts.join('\n');
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <ForceGraph2D
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={graphRef as any}
        graphData={data}
        width={width}
        height={height}
        nodeVal={getNodeSize as (node: object) => number}
        nodeColor={getNodeColor as (node: object) => string}
        nodeLabel={getNodeLabel as (node: object) => string}
        linkWidth={getLinkWidth as (link: object) => number}
        linkColor={getLinkColor as (link: object) => string}
        linkDirectionalArrowLength={0}
        onNodeClick={handleNodeClick as (node: object, event: MouseEvent) => void}
        onNodeHover={handleNodeHover as (node: object | null) => void}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {popupNode && (
        <DefinitionNodePopup
          node={popupNode}
          position={popupPosition}
          state={state}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}
