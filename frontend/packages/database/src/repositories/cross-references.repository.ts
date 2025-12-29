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
}
