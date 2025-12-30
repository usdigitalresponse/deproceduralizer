import type { TitleReferenceEdge, DocumentHub, CircularReference } from '@deproceduralizer/database';

/**
 * Graph node for network visualization
 */
export interface GraphNode {
  id: string;
  label: string;
  titleNumber: string;
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
 * Transform title-level edges into graph data
 */
export function transformToGraphData(edges: TitleReferenceEdge[]): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // Build nodes and links from edges
  for (const edge of edges) {
    // Ensure source node exists
    if (!nodeMap.has(edge.sourceTitle)) {
      nodeMap.set(edge.sourceTitle, {
        id: edge.sourceTitle,
        label: edge.sourceTitleName,
        titleNumber: edge.sourceTitle,
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Ensure target node exists
    if (!nodeMap.has(edge.targetTitle)) {
      nodeMap.set(edge.targetTitle, {
        id: edge.targetTitle,
        label: edge.targetTitleName,
        titleNumber: edge.targetTitle,
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Update degree counts
    const sourceNode = nodeMap.get(edge.sourceTitle)!;
    const targetNode = nodeMap.get(edge.targetTitle)!;
    sourceNode.outDegree += edge.refCount;
    sourceNode.totalDegree += edge.refCount;
    targetNode.inDegree += edge.refCount;
    targetNode.totalDegree += edge.refCount;

    // Add link (skip self-references)
    if (edge.sourceTitle !== edge.targetTitle) {
      links.push({
        source: edge.sourceTitle,
        target: edge.targetTitle,
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
export type { TitleReferenceEdge, DocumentHub, CircularReference };
