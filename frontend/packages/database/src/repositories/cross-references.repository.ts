import { eq, and, desc, asc, sql, count, type SQL } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { crossReferences, CrossReference, RefType } from '../schema/cross-references';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { guidanceDocuments } from '../schema/guidance-documents';
import { JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

/**
 * Cross-reference with target document info (for outgoing refs display)
 */
export interface CrossReferenceWithTarget extends CrossReference {
  targetDocument: {
    id: number;
    title: string | null;
    shortTitle: string | null;
    citation: string | null;
    hierarchyLevel: string | null;
    summary: string | null;
  } | null;
}

/**
 * Cross-reference with source document info (for incoming refs display)
 */
export interface CrossReferenceWithSource extends CrossReference {
  sourceDocument: {
    id: number;
    title: string | null;
    shortTitle: string | null;
    citation: string | null;
    hierarchyLevel: string | null;
  };
}

/**
 * Minimal cross-reference data for inline highlighting
 */
export interface HighlightRef {
  id: number;
  rawText: string;
  startOffset: number | null;
  endOffset: number | null;
  targetDocumentId: number | null;
  targetGuidanceId: number | null;
  refType: string;
  targetTitle: string | null;
  targetCitation: string | null;
  isResolved: boolean | null;
}

/**
 * Stats for dashboard display
 */
export interface CrossRefStats {
  total: number;
  resolved: number;
  unresolved: number;
  byRefType: Record<string, number>;
}

/**
 * Hierarchy level for graph aggregation
 */
export type GraphLevel = 'title' | 'chapter' | 'part' | 'section';

/**
 * Reference edge for network graph (aggregated by level)
 */
export interface ReferenceEdge {
  sourceId: string;
  sourceName: string;
  sourceType?: string | null; // section_type (only at section level)
  targetId: string;
  targetName: string;
  targetType?: string | null;
  refCount: number;
}

/**
 * Document hub with degree metrics
 */
export interface DocumentHub {
  documentId: number;
  title: string | null;
  shortTitle: string | null;
  citation: string | null;
  hierarchyLevel: string | null;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

/**
 * Circular reference cycle
 */
export interface CircularReference {
  cycle: number[];
  cycleLength: number;
}

/**
 * Document neighborhood for tree highlighting
 */
export interface DocumentNeighborhood {
  documentId: number;
  outgoingRefs: Array<{
    targetId: number;
    targetTitle: string | null;
    targetCitation: string | null;
  }>;
  incomingRefs: Array<{
    sourceId: number;
    sourceTitle: string | null;
    sourceCitation: string | null;
  }>;
}

/**
 * Guidance document that references a regulation via cross_references
 */
export interface GuidanceReferenceItem {
  id: number;
  title: string;
  agency: string;
  policyCategory: string | null;
  canonicalRef: string | null;
  status: string | null;
  citationText: string;
}

/**
 * Edge for guidance→regulation graph overlay
 */
export interface GuidanceReferenceEdge {
  sourceId: string;
  sourceName: string;
  sourceEntityType: 'guidance' | 'regulation';
  targetId: string;
  targetName: string;
  targetEntityType: 'guidance' | 'regulation';
  refCount: number;
}

export interface CrossRefPaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  isResolved?: boolean;
}

export interface PaginatedCrossRefsResult {
  data: CrossReferenceWithSource[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Row shape for the cross-references table view
 */
export interface CrossRefTableRow {
  id: number;
  refType: string;
  rawText: string;
  normalizedCitation: string;
  isResolved: boolean | null;
  sourceJurisdiction: string;
  sourceDocumentId: number | null;
  sourceDocumentTitle: string | null;
  sourceDocumentCitation: string | null;
  sourceGuidanceId: number | null;
  sourceGuidanceRef: string | null;
  targetDocumentId: number | null;
  targetDocumentTitle: string | null;
  targetDocumentCitation: string | null;
  targetGuidanceId: number | null;
  targetGuidanceRef: string | null;
}

export interface CrossRefTableOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  isResolved?: boolean | 'all';
  refType?: string;
  sourceType?: 'regulation' | 'guidance' | 'all';
  targetType?: 'regulation' | 'guidance' | 'none' | 'all';
  searchQuery?: string;
  sortBy?: 'sourceDocument' | 'refType' | 'normalizedCitation' | 'isResolved';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedCrossRefTableResult {
  data: CrossRefTableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CrossRefDocumentGroup {
  sourceDocumentId: number | null;
  sourceGuidanceId: number | null;
  documentTitle: string | null;
  citation: string | null;
  sourceType: 'regulation' | 'guidance';
  totalRefs: number;
  unresolvedCount: number;
}

export interface CrossRefGroupOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  isResolved?: boolean | 'all';
  refType?: string;
  sourceType?: 'regulation' | 'guidance' | 'all';
  targetType?: 'regulation' | 'guidance' | 'none' | 'all';
  searchQuery?: string;
  sortBy?: 'documentName' | 'totalRefs' | 'unresolvedCount';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedCrossRefGroupResult {
  data: CrossRefDocumentGroup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Filter options for accordion expansion and other filtered queries */
export interface CrossRefActiveFilters {
  isResolved?: boolean | 'all';
  refType?: string;
}

/** Allowlist of valid ref_type values for server-side validation */
const VALID_REF_TYPES = new Set(['nycrr', 'njac', 'ny_short_form', 'same_section', 'guidance', 'form', 'ssl', 'ny_statute']);

export class CrossReferencesRepository extends BaseRepository {
  /**
   * Get a cross-reference by ID
   */
  async getById(id: number): Promise<CrossReference | undefined> {
    const result = await this.db
      .select()
      .from(crossReferences)
      .where(eq(crossReferences.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Get all cross-references FROM a document (outgoing references)
   * Returns refs with target document info for display
   */
  async getBySourceDocumentId(documentId: number): Promise<CrossReferenceWithTarget[]> {
    const targetDoc = regulatoryDocuments;

    const result = await this.db
      .select({
        // Cross-reference fields
        id: crossReferences.id,
        sourceDocumentId: crossReferences.sourceDocumentId,
        refType: crossReferences.refType,
        rawText: crossReferences.rawText,
        normalizedCitation: crossReferences.normalizedCitation,
        startOffset: crossReferences.startOffset,
        endOffset: crossReferences.endOffset,
        contextBefore: crossReferences.contextBefore,
        contextAfter: crossReferences.contextAfter,
        components: crossReferences.components,
        targetDocumentId: crossReferences.targetDocumentId,
        isResolved: crossReferences.isResolved,
        resolutionNotes: crossReferences.resolutionNotes,
        jurisdiction: crossReferences.jurisdiction,
        createdAt: crossReferences.createdAt,
        // Target document fields
        targetDocument: {
          id: targetDoc.id,
          title: targetDoc.title,
          shortTitle: targetDoc.shortTitle,
          citation: targetDoc.citation,
          hierarchyLevel: targetDoc.hierarchyLevel,
          summary: targetDoc.summary,
        },
      })
      .from(crossReferences)
      .leftJoin(targetDoc, eq(crossReferences.targetDocumentId, targetDoc.id))
      .where(eq(crossReferences.sourceDocumentId, documentId))
      .orderBy(asc(crossReferences.startOffset));

    return result as CrossReferenceWithTarget[];
  }

  /**
   * Get all cross-references TO a document (incoming references - who cites this doc)
   * Returns refs with source document info for display
   */
  async getByTargetDocumentId(documentId: number): Promise<CrossReferenceWithSource[]> {
    const sourceDoc = regulatoryDocuments;

    const result = await this.db
      .select({
        // Cross-reference fields
        id: crossReferences.id,
        sourceDocumentId: crossReferences.sourceDocumentId,
        refType: crossReferences.refType,
        rawText: crossReferences.rawText,
        normalizedCitation: crossReferences.normalizedCitation,
        startOffset: crossReferences.startOffset,
        endOffset: crossReferences.endOffset,
        contextBefore: crossReferences.contextBefore,
        contextAfter: crossReferences.contextAfter,
        components: crossReferences.components,
        targetDocumentId: crossReferences.targetDocumentId,
        isResolved: crossReferences.isResolved,
        resolutionNotes: crossReferences.resolutionNotes,
        jurisdiction: crossReferences.jurisdiction,
        createdAt: crossReferences.createdAt,
        // Source document fields
        sourceDocument: {
          id: sourceDoc.id,
          title: sourceDoc.title,
          shortTitle: sourceDoc.shortTitle,
          citation: sourceDoc.citation,
          hierarchyLevel: sourceDoc.hierarchyLevel,
        },
      })
      .from(crossReferences)
      .innerJoin(sourceDoc, eq(crossReferences.sourceDocumentId, sourceDoc.id))
      .where(eq(crossReferences.targetDocumentId, documentId))
      .orderBy(asc(sourceDoc.citation));

    return result as CrossReferenceWithSource[];
  }

  /**
   * Get minimal cross-reference data for inline text highlighting
   * Only returns refs with valid offsets for highlighting
   */
  async getForHighlighting(documentId: number): Promise<HighlightRef[]> {
    const targetDoc = regulatoryDocuments;

    const result = await this.db
      .select({
        id: crossReferences.id,
        rawText: crossReferences.rawText,
        startOffset: crossReferences.startOffset,
        endOffset: crossReferences.endOffset,
        targetDocumentId: crossReferences.targetDocumentId,
        targetGuidanceId: crossReferences.targetGuidanceId,
        refType: crossReferences.refType,
        targetTitle: targetDoc.shortTitle,
        targetCitation: targetDoc.citation,
        isResolved: crossReferences.isResolved,
      })
      .from(crossReferences)
      .leftJoin(targetDoc, eq(crossReferences.targetDocumentId, targetDoc.id))
      .where(eq(crossReferences.sourceDocumentId, documentId))
      .orderBy(asc(crossReferences.startOffset));

    return result;
  }

  /**
   * Get minimal cross-reference data for inline highlighting in guidance documents.
   * Handles both regulation targets (via targetDocumentId) and guidance targets (via targetGuidanceId).
   */
  async getForGuidanceHighlighting(guidanceId: number): Promise<HighlightRef[]> {
    const targetReg = regulatoryDocuments;
    const targetGuidance = guidanceDocuments;

    const result = await this.db
      .select({
        id: crossReferences.id,
        rawText: crossReferences.rawText,
        startOffset: crossReferences.startOffset,
        endOffset: crossReferences.endOffset,
        targetDocumentId: crossReferences.targetDocumentId,
        targetGuidanceId: crossReferences.targetGuidanceId,
        refType: crossReferences.refType,
        targetTitle: sql<string | null>`COALESCE(${targetReg.shortTitle}, ${targetGuidance.title})`,
        targetCitation: sql<string | null>`COALESCE(${targetReg.citation}, ${targetGuidance.canonicalRef})`,
        isResolved: crossReferences.isResolved,
      })
      .from(crossReferences)
      .leftJoin(targetReg, eq(crossReferences.targetDocumentId, targetReg.id))
      .leftJoin(targetGuidance, eq(crossReferences.targetGuidanceId, targetGuidance.id))
      .where(eq(crossReferences.sourceGuidanceId, guidanceId))
      .orderBy(asc(crossReferences.startOffset));

    return result;
  }

  /**
   * Get stats for dashboard display
   */
  async getStatsByState(jurisdiction: JurisdictionCode): Promise<CrossRefStats> {
    // Get total and resolution stats
    const totals = await this.db
      .select({
        isResolved: crossReferences.isResolved,
        count: sql<number>`count(*)::int`,
      })
      .from(crossReferences)
      .where(eq(crossReferences.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .groupBy(crossReferences.isResolved);

    // Get counts by ref type
    const byType = await this.db
      .select({
        refType: crossReferences.refType,
        count: sql<number>`count(*)::int`,
      })
      .from(crossReferences)
      .where(eq(crossReferences.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .groupBy(crossReferences.refType);

    const stats: CrossRefStats = {
      total: 0,
      resolved: 0,
      unresolved: 0,
      byRefType: {},
    };

    for (const row of totals) {
      if (row.isResolved) {
        stats.resolved = row.count;
      } else {
        stats.unresolved = row.count;
      }
      stats.total += row.count;
    }

    for (const row of byType) {
      stats.byRefType[row.refType] = row.count;
    }

    return stats;
  }

  /**
   * Get unresolved cross-references for review queue (paginated)
   */
  async getUnresolvedByState(options: CrossRefPaginationOptions): Promise<PaginatedCrossRefsResult> {
    const { jurisdiction, page, pageSize, isResolved = false } = options;
    const offset = (page - 1) * pageSize;

    const sourceDoc = regulatoryDocuments;

    // Build where condition
    const whereCondition = and(
      eq(crossReferences.jurisdiction, normalizeJurisdiction(jurisdiction)),
      eq(crossReferences.isResolved, isResolved)
    );

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(crossReferences)
      .where(whereCondition);

    const total = countResult[0]?.count ?? 0;

    // Get paginated data
    const data = await this.db
      .select({
        id: crossReferences.id,
        sourceDocumentId: crossReferences.sourceDocumentId,
        refType: crossReferences.refType,
        rawText: crossReferences.rawText,
        normalizedCitation: crossReferences.normalizedCitation,
        startOffset: crossReferences.startOffset,
        endOffset: crossReferences.endOffset,
        contextBefore: crossReferences.contextBefore,
        contextAfter: crossReferences.contextAfter,
        components: crossReferences.components,
        targetDocumentId: crossReferences.targetDocumentId,
        isResolved: crossReferences.isResolved,
        resolutionNotes: crossReferences.resolutionNotes,
        jurisdiction: crossReferences.jurisdiction,
        createdAt: crossReferences.createdAt,
        sourceDocument: {
          id: sourceDoc.id,
          title: sourceDoc.title,
          shortTitle: sourceDoc.shortTitle,
          citation: sourceDoc.citation,
          hierarchyLevel: sourceDoc.hierarchyLevel,
        },
      })
      .from(crossReferences)
      .innerJoin(sourceDoc, eq(crossReferences.sourceDocumentId, sourceDoc.id))
      .where(whereCondition)
      .orderBy(desc(crossReferences.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: data as CrossReferenceWithSource[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get count of cross-references from a document
   */
  async getCountBySourceDocumentId(documentId: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(crossReferences)
      .where(eq(crossReferences.sourceDocumentId, documentId));

    return result[0]?.count ?? 0;
  }

  /**
   * Get count of cross-references to a document (incoming)
   */
  async getCountByTargetDocumentId(documentId: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(crossReferences)
      .where(eq(crossReferences.targetDocumentId, documentId));

    return result[0]?.count ?? 0;
  }

  /**
   * Get reference graph for network visualization
   * Aggregates references by hierarchy level (title, chapter, or part)
   * @param level - 'title' (~50 nodes), 'chapter' (~200), 'part' (~500)
   */
  async getReferenceGraph(jurisdiction: JurisdictionCode, level: GraphLevel = 'title'): Promise<ReferenceEdge[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const VALID_JURISDICTIONS_UPPER = ['NY', 'NJ', 'NYC'] as const;
    if (!VALID_JURISDICTIONS_UPPER.includes(stateUpper as any)) {
      throw new Error(`Invalid jurisdiction: ${stateUpper}`);
    }

    // Build level-specific column expressions
    // NJ uses njac_*, NY uses nycrr_*
    const levelColumns = {
      title: {
        id: `COALESCE(src.nycrr_title::text, src.njac_title)`,
        name: `COALESCE(src.nycrr_title_name, src.njac_title_name, 'Title ' || COALESCE(src.nycrr_title::text, src.njac_title))`,
        tgtId: `COALESCE(tgt.nycrr_title::text, tgt.njac_title)`,
        tgtName: `COALESCE(tgt.nycrr_title_name, tgt.njac_title_name, 'Title ' || COALESCE(tgt.nycrr_title::text, tgt.njac_title))`,
        filter: `(src.nycrr_title IS NOT NULL OR src.njac_title IS NOT NULL) AND (tgt.nycrr_title IS NOT NULL OR tgt.njac_title IS NOT NULL)`,
        minCount: 1,
      },
      chapter: {
        id: `COALESCE(src.nycrr_title::text, src.njac_title) || ':' || COALESCE(src.nycrr_chapter, src.njac_chapter, '')`,
        name: `COALESCE(src.nycrr_chapter_name, src.njac_chapter_name, 'Ch ' || COALESCE(src.nycrr_chapter, src.njac_chapter, ''))`,
        tgtId: `COALESCE(tgt.nycrr_title::text, tgt.njac_title) || ':' || COALESCE(tgt.nycrr_chapter, tgt.njac_chapter, '')`,
        tgtName: `COALESCE(tgt.nycrr_chapter_name, tgt.njac_chapter_name, 'Ch ' || COALESCE(tgt.nycrr_chapter, tgt.njac_chapter, ''))`,
        filter: `(src.nycrr_chapter IS NOT NULL OR src.njac_chapter IS NOT NULL) AND (tgt.nycrr_chapter IS NOT NULL OR tgt.njac_chapter IS NOT NULL)`,
        minCount: 1,
      },
      part: {
        id: `COALESCE(src.nycrr_title::text, src.njac_title) || ':' || COALESCE(src.nycrr_part, src.njac_subchapter, '')`,
        name: `COALESCE(src.nycrr_part_name, src.njac_subchapter_name, 'Part ' || COALESCE(src.nycrr_part, src.njac_subchapter, ''))`,
        tgtId: `COALESCE(tgt.nycrr_title::text, tgt.njac_title) || ':' || COALESCE(tgt.nycrr_part, tgt.njac_subchapter, '')`,
        tgtName: `COALESCE(tgt.nycrr_part_name, tgt.njac_subchapter_name, 'Part ' || COALESCE(tgt.nycrr_part, tgt.njac_subchapter, ''))`,
        filter: `(src.nycrr_part IS NOT NULL OR src.njac_subchapter IS NOT NULL) AND (tgt.nycrr_part IS NOT NULL OR tgt.njac_subchapter IS NOT NULL)`,
        minCount: 1,
      },
      section: {
        id: `src.id::text`,
        name: `COALESCE(src.short_title, src.citation, 'Section ' || src.id)`,
        type: `src.section_type`,
        tgtId: `tgt.id::text`,
        tgtName: `COALESCE(tgt.short_title, tgt.citation, 'Section ' || tgt.id)`,
        tgtType: `tgt.section_type`,
        filter: `true`, // All documents
        minCount: 2, // Only show edges with 2+ refs to reduce noise
      },
    };

    const cols = levelColumns[level];

    // Use raw SQL for efficient aggregation
    // Section level includes type columns
    const isSection = level === 'section';
    const sectionCols = isSection ? levelColumns.section : null;
    const typeSelect = sectionCols ? `, ${sectionCols.type} as source_type, ${sectionCols.tgtType} as target_type` : '';
    const typeGroup = sectionCols ? ', 5, 6' : '';

    const result = await this.db.execute<{
      source_id: string;
      source_name: string;
      source_type?: string | null;
      target_id: string;
      target_name: string;
      target_type?: string | null;
      ref_count: number;
    }>(sql.raw(`
      SELECT
        ${cols.id} as source_id,
        ${cols.name} as source_name,
        ${cols.tgtId} as target_id,
        ${cols.tgtName} as target_name
        ${typeSelect},
        COUNT(*)::int as ref_count
      FROM cross_references cr
      JOIN regulatory_documents src ON cr.source_document_id = src.id
      JOIN regulatory_documents tgt ON cr.target_document_id = tgt.id
      WHERE cr.jurisdiction = '${stateUpper}'
        AND cr.is_resolved = true
        AND ${cols.filter}
      GROUP BY 1, 2, 3, 4 ${typeGroup}
      HAVING COUNT(*) >= ${cols.minCount}
      ORDER BY ref_count DESC
      LIMIT ${isSection ? 500 : 1000}
    `));

    return result.rows.map(row => ({
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceType: row.source_type,
      targetId: row.target_id,
      targetName: row.target_name,
      targetType: row.target_type,
      refCount: row.ref_count,
    }));
  }

  /**
   * @deprecated Use getReferenceGraph instead
   */
  async getTitleLevelReferenceGraph(jurisdiction: JurisdictionCode): Promise<ReferenceEdge[]> {
    return this.getReferenceGraph(jurisdiction, 'title');
  }

  /**
   * Get top hub documents by reference degree
   */
  async getTopHubs(
    jurisdiction: JurisdictionCode,
    limit: number = 20,
    sortBy: 'in' | 'out' | 'total' = 'total'
  ): Promise<DocumentHub[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const orderColumn = sortBy === 'in' ? 'in_degree' : sortBy === 'out' ? 'out_degree' : 'total_degree';

    const result = await this.db.execute<{
      document_id: number;
      title: string | null;
      short_title: string | null;
      citation: string | null;
      hierarchy_level: string | null;
      in_degree: number;
      out_degree: number;
      total_degree: number;
    }>(sql`
      WITH in_degrees AS (
        SELECT target_document_id as doc_id, COUNT(*)::int as in_count
        FROM cross_references
        WHERE jurisdiction = ${stateUpper} AND is_resolved = true
        GROUP BY target_document_id
      ),
      out_degrees AS (
        SELECT source_document_id as doc_id, COUNT(*)::int as out_count
        FROM cross_references
        WHERE jurisdiction = ${stateUpper}
        GROUP BY source_document_id
      )
      SELECT
        rd.id as document_id,
        rd.title,
        rd.short_title,
        rd.citation,
        rd.hierarchy_level,
        COALESCE(i.in_count, 0) as in_degree,
        COALESCE(o.out_count, 0) as out_degree,
        COALESCE(i.in_count, 0) + COALESCE(o.out_count, 0) as total_degree
      FROM regulatory_documents rd
      LEFT JOIN in_degrees i ON rd.id = i.doc_id
      LEFT JOIN out_degrees o ON rd.id = o.doc_id
      WHERE rd.jurisdiction = ${stateUpper}
        AND (i.in_count > 0 OR o.out_count > 0)
      ORDER BY ${sql.raw(orderColumn)} DESC
      LIMIT ${limit}
    `);

    return result.rows.map(row => ({
      documentId: row.document_id,
      title: row.title,
      shortTitle: row.short_title,
      citation: row.citation,
      hierarchyLevel: row.hierarchy_level,
      inDegree: row.in_degree,
      outDegree: row.out_degree,
      totalDegree: row.total_degree,
    }));
  }

  /**
   * Detect circular references using recursive CTE
   * Returns cycles found within maxDepth hops
   */
  async detectCircularReferences(jurisdiction: JurisdictionCode, maxDepth: number = 4): Promise<CircularReference[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    // Use a recursive CTE to find cycles
    // This is more efficient than doing it in application code
    const result = await this.db.execute<{
      cycle_path: number[];
    }>(sql`
      WITH RECURSIVE ref_chain AS (
        -- Base case: start from each document
        SELECT
          source_document_id as start_id,
          target_document_id as current_id,
          ARRAY[source_document_id, target_document_id] as path,
          1 as depth
        FROM cross_references
        WHERE jurisdiction = ${stateUpper} AND is_resolved = true

        UNION ALL

        -- Recursive case: follow references
        SELECT
          rc.start_id,
          cr.target_document_id,
          rc.path || cr.target_document_id,
          rc.depth + 1
        FROM ref_chain rc
        JOIN cross_references cr ON rc.current_id = cr.source_document_id
        WHERE cr.jurisdiction = ${stateUpper}
          AND cr.is_resolved = true
          AND rc.depth < ${maxDepth}
          AND NOT cr.target_document_id = ANY(rc.path[2:])
      )
      SELECT DISTINCT ON (LEAST(path[1], path[array_length(path, 1)]), GREATEST(path[1], path[array_length(path, 1)]))
        path as cycle_path
      FROM ref_chain
      WHERE current_id = start_id
        AND depth >= 2
      ORDER BY LEAST(path[1], path[array_length(path, 1)]), GREATEST(path[1], path[array_length(path, 1)]), array_length(path, 1)
      LIMIT 100
    `);

    return result.rows.map(row => ({
      cycle: row.cycle_path,
      cycleLength: row.cycle_path.length - 1, // -1 because first and last are the same
    }));
  }

  /**
   * Get document neighborhood for tree highlighting
   * Returns both outgoing and incoming reference document IDs
   */
  async getDocumentNeighborhood(documentId: number): Promise<DocumentNeighborhood> {
    // Get outgoing refs (documents this document references)
    const outgoing = await this.db
      .select({
        targetId: crossReferences.targetDocumentId,
        targetTitle: regulatoryDocuments.shortTitle,
        targetCitation: regulatoryDocuments.citation,
      })
      .from(crossReferences)
      .leftJoin(regulatoryDocuments, eq(crossReferences.targetDocumentId, regulatoryDocuments.id))
      .where(and(
        eq(crossReferences.sourceDocumentId, documentId),
        eq(crossReferences.isResolved, true)
      ));

    // Get incoming refs (documents that reference this document)
    const incoming = await this.db
      .select({
        sourceId: crossReferences.sourceDocumentId,
        sourceTitle: regulatoryDocuments.shortTitle,
        sourceCitation: regulatoryDocuments.citation,
      })
      .from(crossReferences)
      .innerJoin(regulatoryDocuments, eq(crossReferences.sourceDocumentId, regulatoryDocuments.id))
      .where(and(
        eq(crossReferences.targetDocumentId, documentId),
        eq(crossReferences.isResolved, true)
      ));

    return {
      documentId,
      outgoingRefs: outgoing
        .filter(r => r.targetId !== null)
        .map(r => ({
          targetId: r.targetId!,
          targetTitle: r.targetTitle,
          targetCitation: r.targetCitation,
        })),
      incomingRefs: incoming.map(r => ({
        sourceId: r.sourceId,
        sourceTitle: r.sourceTitle,
        sourceCitation: r.sourceCitation,
      })),
    };
  }

  /**
   * Get guidance documents that reference a given regulation document.
   * Uses cross_references where source_guidance_id IS NOT NULL and target_document_id matches.
   */
  async getGuidanceReferencingDocument(documentId: number): Promise<GuidanceReferenceItem[]> {
    const result = await this.db
      .select({
        id: guidanceDocuments.id,
        title: guidanceDocuments.title,
        agency: guidanceDocuments.agency,
        policyCategory: guidanceDocuments.policyCategory,
        canonicalRef: guidanceDocuments.canonicalRef,
        status: guidanceDocuments.status,
        citationText: sql<string>`min(${crossReferences.rawText})`,
      })
      .from(crossReferences)
      .innerJoin(guidanceDocuments, eq(crossReferences.sourceGuidanceId, guidanceDocuments.id))
      .where(
        and(
          eq(crossReferences.targetDocumentId, documentId),
          sql`${crossReferences.sourceGuidanceId} IS NOT NULL`
        )
      )
      .groupBy(guidanceDocuments.id, guidanceDocuments.title, guidanceDocuments.agency,
        guidanceDocuments.policyCategory, guidanceDocuments.canonicalRef, guidanceDocuments.status)
      .orderBy(asc(guidanceDocuments.agency), asc(guidanceDocuments.title))
      .limit(100);

    return result;
  }

  /**
   * Get guidance→regulation reference edges for network graph overlay.
   * Aggregates by guidance agency (source) and regulation title (target).
   */
  async getGuidanceReferenceGraph(jurisdiction: JurisdictionCode): Promise<GuidanceReferenceEdge[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const result = await this.db.execute<{
      source_id: string;
      source_name: string;
      target_id: string;
      target_name: string;
      ref_count: number;
    }>(sql`
      SELECT
        'g-agency:' || gd.agency as source_id,
        gd.agency as source_name,
        COALESCE(tgt.nycrr_title::text, tgt.njac_title) as target_id,
        COALESCE(tgt.nycrr_title_name, tgt.njac_title_name, 'Title ' || COALESCE(tgt.nycrr_title::text, tgt.njac_title)) as target_name,
        COUNT(*)::int as ref_count
      FROM cross_references cr
      JOIN guidance_documents gd ON cr.source_guidance_id = gd.id
      JOIN regulatory_documents tgt ON cr.target_document_id = tgt.id
      WHERE cr.jurisdiction = ${stateUpper}
        AND cr.source_guidance_id IS NOT NULL
        AND cr.target_document_id IS NOT NULL
        AND cr.is_resolved = true
        AND (tgt.nycrr_title IS NOT NULL OR tgt.njac_title IS NOT NULL)
      GROUP BY gd.agency, COALESCE(tgt.nycrr_title::text, tgt.njac_title),
        COALESCE(tgt.nycrr_title_name, tgt.njac_title_name, 'Title ' || COALESCE(tgt.nycrr_title::text, tgt.njac_title))
      HAVING COUNT(*) >= 1
      ORDER BY ref_count DESC
      LIMIT 500
    `);

    return result.rows.map(row => ({
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceEntityType: 'guidance' as const,
      targetId: row.target_id,
      targetName: row.target_name,
      targetEntityType: 'regulation' as const,
      refCount: row.ref_count,
    }));
  }

  /**
   * Get paginated cross-references for table view (flat rows).
   * Supports filtering by resolved status, ref type, and source type.
   */
  async getPaginated(options: CrossRefTableOptions): Promise<PaginatedCrossRefTableResult> {
    const {
      jurisdiction,
      page,
      pageSize,
      isResolved = false,
      refType,
      sourceType = 'all',
      targetType = 'all',
      searchQuery,
      sortBy = 'sourceDocument',
      sortOrder = 'asc',
    } = options;
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const offset = (page - 1) * pageSize;

    // Build parameterized WHERE conditions
    const conditions: SQL[] = [sql`cr.source_jurisdiction = ${stateUpper}`];

    if (isResolved !== 'all') {
      conditions.push(sql`cr.is_resolved = ${isResolved}`);
    }
    if (refType && refType !== 'all' && VALID_REF_TYPES.has(refType)) {
      conditions.push(sql`cr.ref_type = ${refType}`);
    }
    if (sourceType === 'regulation') {
      conditions.push(sql`cr.source_guidance_id IS NULL`);
    } else if (sourceType === 'guidance') {
      conditions.push(sql`cr.source_guidance_id IS NOT NULL`);
    }
    if (targetType === 'regulation') {
      conditions.push(sql`cr.target_document_id IS NOT NULL`);
    } else if (targetType === 'guidance') {
      conditions.push(sql`cr.target_guidance_id IS NOT NULL`);
    } else if (targetType === 'none') {
      conditions.push(sql`cr.target_document_id IS NULL AND cr.target_guidance_id IS NULL`);
    }
    if (searchQuery && searchQuery.trim()) {
      conditions.push(sql`cr.normalized_citation ILIKE ${'%' + searchQuery.trim() + '%'}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Sort column allowlist (column names cannot be parameterized)
    const SORT_COLS: Record<string, SQL> = {
      sourceDocument: sql`COALESCE(src_doc.citation, src_guide.title)`,
      refType: sql`cr.ref_type`,
      normalizedCitation: sql`cr.normalized_citation`,
      isResolved: sql`cr.is_resolved`,
    };
    const orderCol = SORT_COLS[sortBy] ?? SORT_COLS.sourceDocument;
    const orderDir = sortOrder === 'desc' ? sql`DESC` : sql`ASC`;

    // Count query
    const countResult = await this.db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM cross_references cr
      WHERE ${whereClause}
    `);
    const total = countResult.rows[0]?.count ?? 0;

    // Data query
    const dataResult = await this.db.execute<{
      id: number;
      ref_type: string;
      raw_text: string;
      normalized_citation: string;
      is_resolved: boolean | null;
      source_jurisdiction: string;
      source_document_id: number | null;
      source_document_title: string | null;
      source_document_citation: string | null;
      source_guidance_id: number | null;
      source_guidance_ref: string | null;
      target_document_id: number | null;
      target_document_title: string | null;
      target_document_citation: string | null;
      target_guidance_id: number | null;
      target_guidance_ref: string | null;
    }>(sql`
      SELECT
        cr.id,
        cr.ref_type,
        cr.raw_text,
        cr.normalized_citation,
        cr.is_resolved,
        cr.source_jurisdiction,
        cr.source_document_id,
        src_doc.short_title as source_document_title,
        src_doc.citation as source_document_citation,
        cr.source_guidance_id,
        src_guide.title as source_guidance_ref,
        cr.target_document_id,
        tgt_doc.short_title as target_document_title,
        tgt_doc.citation as target_document_citation,
        cr.target_guidance_id,
        tgt_guide.title as target_guidance_ref
      FROM cross_references cr
      LEFT JOIN regulatory_documents src_doc ON cr.source_document_id = src_doc.id
      LEFT JOIN guidance_documents src_guide ON cr.source_guidance_id = src_guide.id
      LEFT JOIN regulatory_documents tgt_doc ON cr.target_document_id = tgt_doc.id
      LEFT JOIN guidance_documents tgt_guide ON cr.target_guidance_id = tgt_guide.id
      WHERE ${whereClause}
      ORDER BY ${orderCol} ${orderDir} NULLS LAST
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    return {
      data: dataResult.rows.map(row => ({
        id: row.id,
        refType: row.ref_type,
        rawText: row.raw_text,
        normalizedCitation: row.normalized_citation,
        isResolved: row.is_resolved,
        sourceJurisdiction: row.source_jurisdiction,
        sourceDocumentId: row.source_document_id,
        sourceDocumentTitle: row.source_document_title,
        sourceDocumentCitation: row.source_document_citation,
        sourceGuidanceId: row.source_guidance_id,
        sourceGuidanceRef: row.source_guidance_ref,
        targetDocumentId: row.target_document_id,
        targetDocumentTitle: row.target_document_title,
        targetDocumentCitation: row.target_document_citation,
        targetGuidanceId: row.target_guidance_id,
        targetGuidanceRef: row.target_guidance_ref,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get cross-references grouped by source document for accordion view.
   * Returns document groups with total and unresolved counts.
   */
  async getGroupedByDocument(options: CrossRefGroupOptions): Promise<PaginatedCrossRefGroupResult> {
    const {
      jurisdiction,
      page,
      pageSize,
      isResolved = 'all',
      refType,
      sourceType = 'all',
      targetType = 'all',
      searchQuery,
      sortBy = 'unresolvedCount',
      sortOrder = 'desc',
    } = options;
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const offset = (page - 1) * pageSize;

    // Build parameterized WHERE conditions
    const conditions: SQL[] = [sql`cr.source_jurisdiction = ${stateUpper}`];

    if (isResolved !== 'all') {
      conditions.push(sql`cr.is_resolved = ${isResolved}`);
    }
    if (refType && refType !== 'all' && VALID_REF_TYPES.has(refType)) {
      conditions.push(sql`cr.ref_type = ${refType}`);
    }
    if (sourceType === 'regulation') {
      conditions.push(sql`cr.source_guidance_id IS NULL`);
    } else if (sourceType === 'guidance') {
      conditions.push(sql`cr.source_guidance_id IS NOT NULL`);
    }
    if (targetType === 'regulation') {
      conditions.push(sql`cr.target_document_id IS NOT NULL`);
    } else if (targetType === 'guidance') {
      conditions.push(sql`cr.target_guidance_id IS NOT NULL`);
    } else if (targetType === 'none') {
      conditions.push(sql`cr.target_document_id IS NULL AND cr.target_guidance_id IS NULL`);
    }
    if (searchQuery && searchQuery.trim()) {
      conditions.push(sql`cr.normalized_citation ILIKE ${'%' + searchQuery.trim() + '%'}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Sort column allowlist (column names cannot be parameterized)
    const SORT_COLS: Record<string, SQL> = {
      documentName: sql`document_title`,
      totalRefs: sql`total_refs`,
      unresolvedCount: sql`unresolved_count`,
    };
    const orderCol = SORT_COLS[sortBy] ?? SORT_COLS.unresolvedCount;
    const orderDir = sortOrder === 'desc' ? sql`DESC` : sql`ASC`;

    // Count distinct groups
    const countResult = await this.db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT
          CASE WHEN cr.source_guidance_id IS NOT NULL
            THEN NULL ELSE cr.source_document_id END as doc_id,
          CASE WHEN cr.source_guidance_id IS NOT NULL
            THEN cr.source_guidance_id ELSE NULL END as guide_id
        FROM cross_references cr
        WHERE ${whereClause}
        GROUP BY doc_id, guide_id
      ) sub
    `);
    const total = countResult.rows[0]?.count ?? 0;

    // Data query with grouping
    const dataResult = await this.db.execute<{
      source_document_id: number | null;
      source_guidance_id: number | null;
      document_title: string | null;
      citation: string | null;
      source_type: 'regulation' | 'guidance';
      total_refs: number;
      unresolved_count: number;
    }>(sql`
      SELECT
        CASE WHEN cr.source_guidance_id IS NOT NULL
          THEN NULL ELSE cr.source_document_id END as source_document_id,
        CASE WHEN cr.source_guidance_id IS NOT NULL
          THEN cr.source_guidance_id ELSE NULL END as source_guidance_id,
        CASE WHEN cr.source_guidance_id IS NOT NULL
          THEN gd.title ELSE COALESCE(rd.short_title, rd.citation) END as document_title,
        CASE WHEN cr.source_guidance_id IS NOT NULL
          THEN NULL ELSE rd.citation END as citation,
        CASE WHEN cr.source_guidance_id IS NOT NULL
          THEN 'guidance' ELSE 'regulation' END as source_type,
        COUNT(*)::int as total_refs,
        COUNT(*) FILTER (WHERE cr.is_resolved = false OR cr.is_resolved IS NULL)::int as unresolved_count
      FROM cross_references cr
      LEFT JOIN regulatory_documents rd ON cr.source_document_id = rd.id AND cr.source_guidance_id IS NULL
      LEFT JOIN guidance_documents gd ON cr.source_guidance_id = gd.id
      WHERE ${whereClause}
      GROUP BY
        CASE WHEN cr.source_guidance_id IS NOT NULL THEN NULL ELSE cr.source_document_id END,
        CASE WHEN cr.source_guidance_id IS NOT NULL THEN cr.source_guidance_id ELSE NULL END,
        CASE WHEN cr.source_guidance_id IS NOT NULL THEN gd.title ELSE COALESCE(rd.short_title, rd.citation) END,
        CASE WHEN cr.source_guidance_id IS NOT NULL THEN NULL ELSE rd.citation END,
        CASE WHEN cr.source_guidance_id IS NOT NULL THEN 'guidance' ELSE 'regulation' END
      ORDER BY ${orderCol} ${orderDir} NULLS LAST
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    return {
      data: dataResult.rows.map(row => ({
        sourceDocumentId: row.source_document_id,
        sourceGuidanceId: row.source_guidance_id,
        documentTitle: row.document_title,
        citation: row.citation,
        sourceType: row.source_type,
        totalRefs: row.total_refs,
        unresolvedCount: row.unresolved_count,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get cross-references for a specific source document (for accordion expansion).
   * Returns flat rows filtered to a single source document or guidance doc.
   */
  async getRefsForSource(
    sourceDocumentId: number | null,
    sourceGuidanceId: number | null,
    jurisdiction: JurisdictionCode,
    filters?: CrossRefActiveFilters
  ): Promise<CrossRefTableRow[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const sourceFilter = sourceGuidanceId
      ? sql`cr.source_guidance_id = ${sourceGuidanceId}`
      : sql`cr.source_document_id = ${sourceDocumentId} AND cr.source_guidance_id IS NULL`;

    const conditions: SQL[] = [
      sql`cr.source_jurisdiction = ${stateUpper}`,
      sourceFilter,
    ];
    if (filters?.isResolved !== undefined && filters.isResolved !== 'all') {
      conditions.push(sql`cr.is_resolved = ${filters.isResolved}`);
    }
    if (filters?.refType && filters.refType !== 'all' && VALID_REF_TYPES.has(filters.refType)) {
      conditions.push(sql`cr.ref_type = ${filters.refType}`);
    }
    const whereClause = sql.join(conditions, sql` AND `);

    const result = await this.db.execute<{
      id: number;
      ref_type: string;
      raw_text: string;
      normalized_citation: string;
      is_resolved: boolean | null;
      source_jurisdiction: string;
      source_document_id: number | null;
      source_document_title: string | null;
      source_document_citation: string | null;
      source_guidance_id: number | null;
      source_guidance_ref: string | null;
      target_document_id: number | null;
      target_document_title: string | null;
      target_document_citation: string | null;
      target_guidance_id: number | null;
      target_guidance_ref: string | null;
    }>(sql`
      SELECT
        cr.id,
        cr.ref_type,
        cr.raw_text,
        cr.normalized_citation,
        cr.is_resolved,
        cr.source_jurisdiction,
        cr.source_document_id,
        src_doc.short_title as source_document_title,
        src_doc.citation as source_document_citation,
        cr.source_guidance_id,
        src_guide.title as source_guidance_ref,
        cr.target_document_id,
        tgt_doc.short_title as target_document_title,
        tgt_doc.citation as target_document_citation,
        cr.target_guidance_id,
        tgt_guide.title as target_guidance_ref
      FROM cross_references cr
      LEFT JOIN regulatory_documents src_doc ON cr.source_document_id = src_doc.id
      LEFT JOIN guidance_documents src_guide ON cr.source_guidance_id = src_guide.id
      LEFT JOIN regulatory_documents tgt_doc ON cr.target_document_id = tgt_doc.id
      LEFT JOIN guidance_documents tgt_guide ON cr.target_guidance_id = tgt_guide.id
      WHERE ${whereClause}
      ORDER BY cr.normalized_citation ASC
      LIMIT 500
    `);

    return result.rows.map(row => ({
      id: row.id,
      refType: row.ref_type,
      rawText: row.raw_text,
      normalizedCitation: row.normalized_citation,
      isResolved: row.is_resolved,
      sourceJurisdiction: row.source_jurisdiction,
      sourceDocumentId: row.source_document_id,
      sourceDocumentTitle: row.source_document_title,
      sourceDocumentCitation: row.source_document_citation,
      sourceGuidanceId: row.source_guidance_id,
      sourceGuidanceRef: row.source_guidance_ref,
      targetDocumentId: row.target_document_id,
      targetDocumentTitle: row.target_document_title,
      targetDocumentCitation: row.target_document_citation,
      targetGuidanceId: row.target_guidance_id,
      targetGuidanceRef: row.target_guidance_ref,
    }));
  }
}
