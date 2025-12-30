import type {
  DefinitionEdge,
  DefinitionHub,
  ScopeLevelFlow,
  DefinitionHierarchyNode,
} from '@deproceduralizer/database';

/**
 * Color mode for network graph nodes
 */
export type ColorMode = 'default' | 'edge-type' | 'scope-level' | 'definition-type';

/**
 * View type for the definition graph container
 */
export type GraphView = 'force' | 'chord' | 'edge-bundle';

/**
 * Graph node for force-directed visualization
 */
export interface DefinitionGraphNode {
  id: string;
  term: string;
  documentId: number;
  citation: string | null;
  scopeLevel?: string | null;
  definitionType?: string | null;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

/**
 * Graph link for force-directed visualization
 */
export interface DefinitionGraphLink {
  source: string;
  target: string;
  edgeType: 'same_term' | 'shared_scope' | 'shared_occurrence';
  weight: number;
}

/**
 * Combined graph data for force-directed graph
 */
export interface DefinitionGraphData {
  nodes: DefinitionGraphNode[];
  links: DefinitionGraphLink[];
}

/**
 * Chord diagram data structure (matrix format for @nivo/chord)
 */
export interface ChordData {
  keys: string[];
  matrix: number[][];
}

/**
 * Transform definition edges into graph data for force-directed visualization
 */
export function transformToGraphData(edges: DefinitionEdge[]): DefinitionGraphData {
  const nodeMap = new Map<string, DefinitionGraphNode>();
  const links: DefinitionGraphLink[] = [];

  // Build nodes and links from edges
  for (const edge of edges) {
    // Ensure source node exists
    if (!nodeMap.has(edge.sourceId)) {
      nodeMap.set(edge.sourceId, {
        id: edge.sourceId,
        term: edge.sourceTerm,
        documentId: edge.sourceDocumentId,
        citation: edge.sourceCitation,
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Ensure target node exists
    if (edge.targetDocumentId && !nodeMap.has(edge.targetId)) {
      nodeMap.set(edge.targetId, {
        id: edge.targetId,
        term: edge.targetTerm,
        documentId: edge.targetDocumentId,
        citation: edge.targetCitation,
        inDegree: 0,
        outDegree: 0,
        totalDegree: 0,
      });
    }

    // Update degree counts
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);

    if (sourceNode) {
      sourceNode.outDegree += edge.weight;
      sourceNode.totalDegree += edge.weight;
    }
    if (targetNode) {
      targetNode.inDegree += edge.weight;
      targetNode.totalDegree += edge.weight;
    }

    // Add link (skip if target doesn't exist or self-references)
    if (edge.sourceId !== edge.targetId && edge.targetDocumentId) {
      links.push({
        source: edge.sourceId,
        target: edge.targetId,
        edgeType: edge.edgeType,
        weight: edge.weight,
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

/**
 * Transform scope level flows into chord diagram matrix format
 */
export function transformToChordData(flows: ScopeLevelFlow[]): ChordData {
  // Get unique levels
  const levels = new Set<string>();
  for (const flow of flows) {
    levels.add(flow.fromLevel);
    levels.add(flow.toLevel);
  }
  const keys = Array.from(levels).sort();

  // Create flow matrix
  const matrix: number[][] = keys.map(() => keys.map(() => 0));
  const levelIndex = new Map(keys.map((k, i) => [k, i]));

  for (const flow of flows) {
    const fromIdx = levelIndex.get(flow.fromLevel);
    const toIdx = levelIndex.get(flow.toLevel);
    if (fromIdx !== undefined && toIdx !== undefined) {
      matrix[fromIdx][toIdx] = flow.count;
    }
  }

  return { keys, matrix };
}

// Re-export types from database for convenience
export type { DefinitionEdge, DefinitionHub, ScopeLevelFlow, DefinitionHierarchyNode };
