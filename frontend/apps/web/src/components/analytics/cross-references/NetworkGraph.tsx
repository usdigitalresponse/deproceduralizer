'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ExternalLink, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { GraphData, GraphNode, GraphLink, ColorMode, GraphLevel } from './types';

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-[var(--color-text-muted)]">Loading graph...</div>
    </div>
  ),
});

interface NodePopupProps {
  node: GraphNode;
  position: { x: number; y: number };
  state: string;
  level: GraphLevel;
  onClose: () => void;
}

function NodePopup({ node, position, state, level, onClose }: NodePopupProps) {
  // Only show link at section level where nodeId is a document ID
  const canLink = level === 'section' && !isNaN(Number(node.nodeId));

  return (
    <div
      className="absolute z-50 bg-white border border-[var(--color-neutral-200)] rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 320),
        top: position.y,
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="pr-6">
        <h4 className="font-medium text-sm truncate">{node.label}</h4>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{node.nodeId}</p>

        {node.sectionType && (
          <span className="inline-block mt-1 text-xs bg-[var(--color-neutral-100)] px-1.5 py-0.5 rounded">
            {node.sectionType}
          </span>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-[#3b82f6]">
            <ArrowUpRight className="w-3 h-3" />
            {node.outDegree} out
          </span>
          <span className="flex items-center gap-1 text-[#22c55e]">
            <ArrowDownLeft className="w-3 h-3" />
            {node.inDegree} in
          </span>
        </div>

        {canLink && (
          <Link
            href={`/${state.toLowerCase()}/regulations/${node.nodeId}`}
            target="_blank"
            className="flex items-center gap-1 mt-3 text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Section
          </Link>
        )}
      </div>
    </div>
  );
}

interface NetworkGraphProps {
  data: GraphData;
  width: number;
  height: number;
  state: string;
  level: GraphLevel;
  selectedNode?: string | null;
  circularRefNodes?: Set<string>;
  colorMode?: ColorMode;
  onNodeClick?: (node: GraphNode) => void;
}

export function NetworkGraph({
  data,
  width,
  height,
  state,
  level,
  selectedNode,
  circularRefNodes,
  colorMode = 'default',
  onNodeClick,
}: NetworkGraphProps) {
  const graphRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [popupNode, setPopupNode] = useState<GraphNode | null>(null);
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
  const getNodeSize = useCallback((node: GraphNode) => {
    const baseSize = 4;
    const scale = Math.sqrt(node.totalDegree) * 0.5;
    return baseSize + Math.min(scale, 20);
  }, []);

  // Get color based on direction ratio (more in = green, more out = blue)
  const getDirectionColor = useCallback((node: GraphNode) => {
    if (node.totalDegree === 0) return 'var(--color-neutral-400)';
    const ratio = node.inDegree / node.totalDegree; // 0 = all out, 1 = all in
    // Blend from blue (out) to green (in)
    if (ratio > 0.6) return '#22c55e'; // More incoming - green
    if (ratio < 0.4) return '#3b82f6'; // More outgoing - blue
    return '#a855f7'; // Balanced - purple
  }, []);

  // Get color based on degree intensity
  const getDegreeColor = useCallback(
    (node: GraphNode) => {
      const intensity = node.totalDegree / maxDegree;
      // Low to high: light gray → orange → red
      if (intensity > 0.7) return '#dc2626'; // High - red
      if (intensity > 0.4) return '#f97316'; // Medium - orange
      if (intensity > 0.15) return '#facc15'; // Low-medium - yellow
      return 'var(--color-neutral-400)'; // Low - gray
    },
    [maxDegree]
  );

  // Get color based on section type
  const getTypeColor = useCallback((node: GraphNode) => {
    const typeColors: Record<string, string> = {
      requirements: '#3b82f6', // blue
      procedures: '#8b5cf6', // purple
      scope: '#06b6d4', // cyan
      standards: '#f97316', // orange
      definitions: '#22c55e', // green
      purpose: '#14b8a6', // teal
      prohibitions: '#ef4444', // red
      eligibility: '#eab308', // yellow
      reserved: '#9ca3af', // gray
      penalties: '#dc2626', // dark red
      exemptions: '#84cc16', // lime
      enforcement: '#f43f5e', // rose
    };
    return typeColors[node.sectionType ?? ''] ?? 'var(--color-neutral-400)';
  }, []);

  // Node color based on state and color mode
  const getNodeColor = useCallback(
    (node: GraphNode) => {
      // Circular reference nodes are always red
      if (circularRefNodes?.has(node.id)) {
        return '#dc2626';
      }
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
        case 'direction':
          return getDirectionColor(node);
        case 'degree':
          return getDegreeColor(node);
        case 'type':
          return getTypeColor(node);
        default:
          return 'var(--color-primary-mid)';
      }
    },
    [selectedNode, hoveredNode, circularRefNodes, colorMode, getDirectionColor, getDegreeColor, getTypeColor]
  );

  // Link width based on weight
  const getLinkWidth = useCallback((link: GraphLink) => {
    return Math.sqrt(link.weight) * 0.3 + 0.5;
  }, []);

  // Link color
  const getLinkColor = useCallback(
    (link: GraphLink) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

      // Highlight links connected to selected node
      if (selectedNode && (sourceId === selectedNode || targetId === selectedNode)) {
        return 'var(--color-primary)';
      }
      // Highlight links connected to hovered node
      if (hoveredNode && (sourceId === hoveredNode || targetId === hoveredNode)) {
        return 'var(--color-info)';
      }
      return 'var(--color-neutral-300)';
    },
    [selectedNode, hoveredNode]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
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

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id ?? null);
  }, []);

  // Create tooltip text
  const getNodeLabel = useCallback((node: GraphNode) => {
    return `${node.label}\n${node.nodeId}\n${node.totalDegree} references (${node.inDegree} in, ${node.outDegree} out)`;
  }, []);

  // Cast callbacks and ref to satisfy react-force-graph-2d's generic type requirements
  // Our GraphNode and GraphLink types extend the base types but the library's types are too loose
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
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
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
        <NodePopup
          node={popupNode}
          position={popupPosition}
          state={state}
          level={level}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}
