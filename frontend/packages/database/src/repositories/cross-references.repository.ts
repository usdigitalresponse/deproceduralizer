import { eq, and, desc, asc, sql, count } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { crossReferences, CrossReference, RefType } from '../schema/cross-references';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { StateCode } from '../schema/constants';

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
 * Title-level reference edge for network graph
 */
export interface TitleReferenceEdge {
  sourceTitle: string;
  sourceTitleName: string;
  targetTitle: string;
  targetTitleName: string;
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

export interface CrossRefPaginationOptions {
  state: StateCode;
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
        state: crossReferences.state,
        createdAt: crossReferences.createdAt,
        // Target document fields
        targetDocument: {
          id: targetDoc.id,
          title: targetDoc.title,
          shortTitle: targetDoc.shortTitle,
          citation: targetDoc.citation,
          hierarchyLevel: targetDoc.hierarchyLevel,
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
        state: crossReferences.state,
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
   * Get stats for dashboard display
   */
  async getStatsByState(state: StateCode): Promise<CrossRefStats> {
    // Get total and resolution stats
    const totals = await this.db
      .select({
        isResolved: crossReferences.isResolved,
        count: sql<number>`count(*)::int`,
      })
      .from(crossReferences)
      .where(eq(crossReferences.state, state.toUpperCase()))
      .groupBy(crossReferences.isResolved);

    // Get counts by ref type
    const byType = await this.db
      .select({
        refType: crossReferences.refType,
        count: sql<number>`count(*)::int`,
      })
      .from(crossReferences)
      .where(eq(crossReferences.state, state.toUpperCase()))
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
    const { state, page, pageSize, isResolved = false } = options;
    const offset = (page - 1) * pageSize;

    const sourceDoc = regulatoryDocuments;

    // Build where condition
    const whereCondition = and(
      eq(crossReferences.state, state.toUpperCase()),
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
        state: crossReferences.state,
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
   * Get title-level reference graph for network visualization
   * Aggregates references by source/target title for overview
   */
  async getTitleLevelReferenceGraph(state: StateCode): Promise<TitleReferenceEdge[]> {
    const stateUpper = state.toUpperCase();

    // Use raw SQL for efficient aggregation
    const result = await this.db.execute<{
      source_title: string;
      source_title_name: string;
      target_title: string;
      target_title_name: string;
      ref_count: number;
    }>(sql`
      SELECT
        COALESCE(src.nycrr_title::text, src.njac_title) as source_title,
        COALESCE(src.nycrr_title_name, src.njac_title_name, 'Title ' || COALESCE(src.nycrr_title::text, src.njac_title)) as source_title_name,
        COALESCE(tgt.nycrr_title::text, tgt.njac_title) as target_title,
        COALESCE(tgt.nycrr_title_name, tgt.njac_title_name, 'Title ' || COALESCE(tgt.nycrr_title::text, tgt.njac_title)) as target_title_name,
        COUNT(*)::int as ref_count
      FROM cross_references cr
      JOIN regulatory_documents src ON cr.source_document_id = src.id
      JOIN regulatory_documents tgt ON cr.target_document_id = tgt.id
      WHERE cr.state = ${stateUpper}
        AND cr.is_resolved = true
        AND (src.nycrr_title IS NOT NULL OR src.njac_title IS NOT NULL)
        AND (tgt.nycrr_title IS NOT NULL OR tgt.njac_title IS NOT NULL)
      GROUP BY 1, 2, 3, 4
      HAVING COUNT(*) >= 1
      ORDER BY ref_count DESC
    `);

    return result.rows.map(row => ({
      sourceTitle: row.source_title,
      sourceTitleName: row.source_title_name,
      targetTitle: row.target_title,
      targetTitleName: row.target_title_name,
      refCount: row.ref_count,
    }));
  }

  /**
   * Get top hub documents by reference degree
   */
  async getTopHubs(
    state: StateCode,
    limit: number = 20,
    sortBy: 'in' | 'out' | 'total' = 'total'
  ): Promise<DocumentHub[]> {
    const stateUpper = state.toUpperCase();

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
        WHERE state = ${stateUpper} AND is_resolved = true
        GROUP BY target_document_id
      ),
      out_degrees AS (
        SELECT source_document_id as doc_id, COUNT(*)::int as out_count
        FROM cross_references
        WHERE state = ${stateUpper}
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
      WHERE rd.state = ${stateUpper}
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
  async detectCircularReferences(state: StateCode, maxDepth: number = 4): Promise<CircularReference[]> {
    const stateUpper = state.toUpperCase();

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
        WHERE state = ${stateUpper} AND is_resolved = true

        UNION ALL

        -- Recursive case: follow references
        SELECT
          rc.start_id,
          cr.target_document_id,
          rc.path || cr.target_document_id,
          rc.depth + 1
        FROM ref_chain rc
        JOIN cross_references cr ON rc.current_id = cr.source_document_id
        WHERE cr.state = ${stateUpper}
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
}
