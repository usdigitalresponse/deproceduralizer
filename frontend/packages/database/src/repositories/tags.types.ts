/**
 * Shared types for tag analytics queries and server actions.
 */

import type { JurisdictionCode } from '../schema/constants';

/** A single tag value with its occurrence count */
export interface TagValue {
  domain: string;
  field: string;
  value: string;
  count: number;
  normalizedValue: string;
}

/** Co-occurrence of two specific tag values */
export interface TagCooccurrence {
  valueA: string;
  valueB: string;
  count: number;
}

/** Full co-occurrence matrix between two tag fields */
export interface TagCooccurrenceResult {
  fieldA: string;
  fieldB: string;
  matrix: TagCooccurrence[];
  valuesA: string[];
  valuesB: string[];
}

/** A node in the tag network graph */
export interface TagNode {
  /** Composite id in the form "field:value" */
  id: string;
  field: string;
  value: string;
  domain: string;
  count: number;
}

/** An edge connecting two tag nodes */
export interface TagEdge {
  source: string;
  target: string;
  weight: number;
}

/** Result of a tag network query */
export interface TagNetworkResult {
  nodes: TagNode[];
  edges: TagEdge[];
}

/** Options for building a tag network */
export interface TagNetworkOptions {
  domains?: string[];
  fields?: string[];
  minEdgeWeight?: number;
  maxNodes?: number;
}

/** A link in a Sankey / flow diagram */
export interface TagFlowLink {
  source: string;
  target: string;
  value: number;
}

/** Result of a tag flow query (multi-stage Sankey) */
export interface TagFlowResult {
  stages: string[];
  nodes: string[];
  links: TagFlowLink[];
}

/** Count of tags in a specific domain, with sample documents */
export interface TagDomainCount {
  domain: string;
  count: number;
  samples: Array<{ id: number; title: string; url?: string }>;
}

/** A similar (fuzzy-matched) tag */
export interface SimilarTag {
  value: string;
  count: number;
  similarity: number;
}

/** Detailed view of a single tag value */
export interface TagDetailResult {
  field: string;
  value: string;
  totalCount: number;
  domainCounts: TagDomainCount[];
  relatedTags: TagValue[];
  similarTags: SimilarTag[];
  contextCount?: number;
}

/** A row in a readability cross-cut table */
export interface TagReadabilityRow {
  value: string;
  count: number;
  avgFleschEase: number;
  avgGradeLevel: number;
  avgWordCount: number;
  avgSentenceCount: number;
}

/** Readability metrics grouped by a tag field */
export interface TagReadabilityCrosscuts {
  field: string;
  rows: TagReadabilityRow[];
}

/** Top-level overview stats for the Tags page */
export interface TagOverviewStats {
  totalUniqueValues: number;
  mostCommonTag?: TagValue;
  domainWithMostTags?: string;
  fuzzyClusterCount: number;
  tagsByDomain: TagDomainCount[];
  tagValues: TagValue[];
}

// Re-export JurisdictionCode for convenience in consumers
export type { JurisdictionCode };
