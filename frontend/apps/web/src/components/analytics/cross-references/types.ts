import type { ReferenceEdge, DocumentHub, CircularReference, GraphLevel, GuidanceReferenceEdge } from '@deproceduralizer/database';

/**
 * Color mode for network graph nodes
 */
export type ColorMode = 'default' | 'direction' | 'degree' | 'type';

/**
 * Graph node for network visualization
 */
export interface GraphNode {
  id: string;
  label: string;
  nodeId: string;
  sectionType?: string | null; // Only populated at section level
  entityType?: 'regulation' | 'guidance'; // For guidance overlay
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

/**
 * Graph link for network visualization
 */
export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

/**
 * Combined graph data for force-directed graph
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Transform reference edges into graph data
 */
export function transformToGraphData(edges: ReferenceEdge[]): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // Build nodes and links from edges
  for (const edge of edges) {
    // Ensure source node exists
    if (!nodeMap.has(edge.sourceId)) {
      nodeMap.set(edge.sourceId, {
        id: edge.sourceId,
        label: edge.sourceName,
        nodeId: edge.sourceId,
        sectionType: edge.sourceType,
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Ensure target node exists
    if (!nodeMap.has(edge.targetId)) {
      nodeMap.set(edge.targetId, {
        id: edge.targetId,
        label: edge.targetName,
        nodeId: edge.targetId,
        sectionType: edge.targetType,
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Update degree counts
    const sourceNode = nodeMap.get(edge.sourceId)!;
    const targetNode = nodeMap.get(edge.targetId)!;
    sourceNode.outDegree += edge.refCount;
    sourceNode.totalDegree += edge.refCount;
    targetNode.inDegree += edge.refCount;
    targetNode.totalDegree += edge.refCount;

    // Add link (skip self-references)
    if (edge.sourceId !== edge.targetId) {
      links.push({
        source: edge.sourceId,
        target: edge.targetId,
        weight: edge.refCount,
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

/**
 * Merge guidance reference edges into existing graph data.
 * Adds guidance agency nodes (entityType: 'guidance') and their edges.
 * Reuses existing regulation nodes when target IDs match.
 */
export function mergeGuidanceEdges(existing: GraphData, guidanceEdges: GuidanceReferenceEdge[]): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const links = [...existing.links];

  // Index existing nodes
  for (const node of existing.nodes) {
    nodeMap.set(node.id, { ...node, entityType: node.entityType ?? 'regulation' });
  }

  for (const edge of guidanceEdges) {
    // Ensure guidance agency node
    if (!nodeMap.has(edge.sourceId)) {
      nodeMap.set(edge.sourceId, {
        id: edge.sourceId,
        label: edge.sourceName,
        nodeId: edge.sourceId,
        entityType: 'guidance',
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Ensure regulation target node (may already exist from regulation graph)
    if (!nodeMap.has(edge.targetId)) {
      nodeMap.set(edge.targetId, {
        id: edge.targetId,
        label: edge.targetName,
        nodeId: edge.targetId,
        entityType: 'regulation',
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Update degrees
    const sourceNode = nodeMap.get(edge.sourceId)!;
    const targetNode = nodeMap.get(edge.targetId)!;
    sourceNode.outDegree += edge.refCount;
    sourceNode.totalDegree += edge.refCount;
    targetNode.inDegree += edge.refCount;
    targetNode.totalDegree += edge.refCount;

    // Add edge
    if (edge.sourceId !== edge.targetId) {
      links.push({
        source: edge.sourceId,
        target: edge.targetId,
        weight: edge.refCount,
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

// Re-export types from database for convenience
export type { ReferenceEdge, DocumentHub, CircularReference, GraphLevel, GuidanceReferenceEdge };
