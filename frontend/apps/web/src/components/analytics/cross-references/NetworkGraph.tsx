'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { GraphData, GraphNode, GraphLink } from './types';

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-[var(--color-text-muted)]">Loading graph...</div>
    </div>
  ),
});

interface NetworkGraphProps {
  data: GraphData;
  width: number;
  height: number;
  selectedNode?: string | null;
  circularRefNodes?: Set<string>;
  onNodeClick?: (node: GraphNode) => void;
}

export function NetworkGraph({
  data,
  width,
  height,
  selectedNode,
  circularRefNodes,
  onNodeClick,
}: NetworkGraphProps) {
  const graphRef = useRef<unknown>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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

  // Node color based on state
  const getNodeColor = useCallback(
    (node: GraphNode) => {
      // Circular reference nodes are red
      if (circularRefNodes?.has(node.id)) {
        return 'var(--color-danger)';
      }
      // Selected node is primary
      if (node.id === selectedNode) {
        return 'var(--color-primary)';
      }
      // Hovered node is slightly highlighted
      if (node.id === hoveredNode) {
        return 'var(--color-info)';
      }
      // Default color based on degree
      return 'var(--color-primary-mid)';
    },
    [selectedNode, hoveredNode, circularRefNodes]
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
    (node: GraphNode) => {
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id ?? null);
  }, []);

  // Create tooltip text
  const getNodeLabel = useCallback((node: GraphNode) => {
    return `${node.label}\nTitle ${node.titleNumber}\n${node.totalDegree} references (${node.inDegree} in, ${node.outDegree} out)`;
  }, []);

  // Cast callbacks and ref to satisfy react-force-graph-2d's generic type requirements
  // Our GraphNode and GraphLink types extend the base types but the library's types are too loose
  return (
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
      onNodeClick={handleNodeClick as (node: object) => void}
      onNodeHover={handleNodeHover as (node: object | null) => void}
      enableNodeDrag={true}
      enableZoomInteraction={true}
      enablePanInteraction={true}
      cooldownTicks={100}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
    />
  );
}
