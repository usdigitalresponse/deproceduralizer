import { eq, and, sql, desc } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { crossReferences, CrossReference, regulatoryDocuments } from '../schema';
import { StateCode } from '../schema/constants';

/**
 * Cross-reference with target document info for outgoing references.
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
 * Cross-reference with source document info for incoming references.
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
 * Lightweight reference info for inline highlighting.
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
 * Stats for cross-references.
 */
export interface CrossRefStats {
  total: number;
  resolved: number;
  unresolved: number;
  byType: Record<string, number>;
}

export class CrossReferencesRepository extends BaseRepository {
  /**
   * Get all cross-references FROM a document (outgoing).
   */
  async getBySourceDocumentId(documentId: number): Promise<CrossReferenceWithTarget[]> {
    const results = await this.db
      .select({
        crossRef: crossReferences,
        targetDocument: {
          id: regulatoryDocuments.id,
          title: regulatoryDocuments.title,
          shortTitle: regulatoryDocuments.shortTitle,
          citation: regulatoryDocuments.citation,
          hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        },
      })
      .from(crossReferences)
      .leftJoin(
        regulatoryDocuments,
        eq(crossReferences.targetDocumentId, regulatoryDocuments.id)
      )
      .where(eq(crossReferences.sourceDocumentId, documentId))
      .orderBy(crossReferences.startOffset);

    return results.map((row) => ({
      ...row.crossRef,
      targetDocument: row.targetDocument?.id ? row.targetDocument : null,
    }));
  }

  /**
   * Get all cross-references TO a document (incoming - who cites this doc).
   */
  async getByTargetDocumentId(documentId: number): Promise<CrossReferenceWithSource[]> {
    const results = await this.db
      .select({
        crossRef: crossReferences,
        sourceDocument: {
          id: regulatoryDocuments.id,
          title: regulatoryDocuments.title,
          shortTitle: regulatoryDocuments.shortTitle,
          citation: regulatoryDocuments.citation,
          hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        },
      })
      .from(crossReferences)
      .innerJoin(
        regulatoryDocuments,
        eq(crossReferences.sourceDocumentId, regulatoryDocuments.id)
      )
      .where(eq(crossReferences.targetDocumentId, documentId))
      .orderBy(regulatoryDocuments.shortTitle);

    return results.map((row) => ({
      ...row.crossRef,
      sourceDocument: row.sourceDocument,
    }));
  }

  /**
   * Get cross-references for inline highlighting.
   */
  async getForHighlighting(documentId: number): Promise<HighlightRef[]> {
    const results = await this.db
      .select({
        id: crossReferences.id,
        rawText: crossReferences.rawText,
        startOffset: crossReferences.startOffset,
        endOffset: crossReferences.endOffset,
        targetDocumentId: crossReferences.targetDocumentId,
        targetTitle: regulatoryDocuments.shortTitle,
        targetCitation: regulatoryDocuments.citation,
        isResolved: crossReferences.isResolved,
      })
      .from(crossReferences)
      .leftJoin(
        regulatoryDocuments,
        eq(crossReferences.targetDocumentId, regulatoryDocuments.id)
      )
      .where(eq(crossReferences.sourceDocumentId, documentId))
      .orderBy(crossReferences.startOffset);

    return results;
  }

  /**
   * Get stats by state.
   */
  async getStatsByState(state: StateCode): Promise<CrossRefStats> {
    const results = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`sum(case when is_resolved then 1 else 0 end)::int`,
        unresolved: sql<number>`sum(case when not is_resolved then 1 else 0 end)::int`,
      })
      .from(crossReferences)
      .where(eq(crossReferences.state, state));

    const typeResults = await this.db
      .select({
        refType: crossReferences.refType,
        count: sql<number>`count(*)::int`,
      })
      .from(crossReferences)
      .where(eq(crossReferences.state, state))
      .groupBy(crossReferences.refType);

    const byType: Record<string, number> = {};
    for (const row of typeResults) {
      byType[row.refType] = row.count;
    }

    return {
      total: results[0]?.total ?? 0,
      resolved: results[0]?.resolved ?? 0,
      unresolved: results[0]?.unresolved ?? 0,
      byType,
    };
  }

  /**
   * Get count of outgoing cross-references for a document.
   */
  async getCountBySourceDocumentId(documentId: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(crossReferences)
      .where(eq(crossReferences.sourceDocumentId, documentId));
    return result[0]?.count ?? 0;
  }

  /**
   * Get count of incoming cross-references for a document.
   */
  async getCountByTargetDocumentId(documentId: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(crossReferences)
      .where(eq(crossReferences.targetDocumentId, documentId));
    return result[0]?.count ?? 0;
  }
}
