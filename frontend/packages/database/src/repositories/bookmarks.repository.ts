import { eq, and, isNull, isNotNull, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { bookmarks, Bookmark, NewBookmark } from '../schema/bookmarks';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { complianceIssueAnalyses } from '../schema/compliance-issue-analyses';
import { guidanceDocuments } from '../schema/guidance-documents';
import { finesFeesPenalties } from '../schema/fines-fees-penalties';
import { agencies } from '../schema/agencies';
import { normalizeJurisdiction } from '../schema/constants';

export interface CreateBookmarkInput {
  documentId?: number;
  analysisId?: number;
  guidanceDocumentId?: number;
  fineId?: number;
  issueType?: string;
  jurisdiction: string;
  notes?: string;
  createdBy?: string;
}

export interface UpdateBookmarkInput {
  notes?: string;
  createdBy?: string;
}

export interface BookmarkWithDetails extends Bookmark {
  documentTitle: string | null;
  documentCitation: string | null;
  // Analysis fields (null for document-only bookmarks)
  analysisSeverity: number | null;
  analysisFinalSeverity: number | null;
  analysisClassification: string | null;
  analysisTier3Classification: string | null;
  highestTierCompleted: number | null;
  // Key flags
  federalMandateFound: boolean | null;
  easyCleanupCandidate: boolean | null;
  cleanupType: string | null;
  cleanupEffort: string | null;
  tier3TriggerReason: string | null;
  // Guidance fields (null for non-guidance bookmarks)
  guidanceTitle: string | null;
  guidanceCanonicalRef: string | null;
  guidanceAgency: string | null;
  // Fine fields (null for non-fine bookmarks)
  finePenaltyType: string | null;
  fineAmount: string | null;
  fineWhoPays: string | null;
  fineViolationDescription: string | null;
  fineAgencyCanonicalName: string | null;
  fineAgencyLevel: string | null;
  finePerUnit: string | null;
}

export class BookmarksRepository extends BaseRepository {
  /**
   * Create a new bookmark
   */
  async create(input: CreateBookmarkInput): Promise<Bookmark> {
    const [bookmark] = await this.db
      .insert(bookmarks)
      .values({
        documentId: input.documentId ?? null,
        analysisId: input.analysisId ?? null,
        guidanceDocumentId: input.guidanceDocumentId ?? null,
        fineId: input.fineId ?? null,
        issueType: input.issueType ?? null,
        jurisdiction: normalizeJurisdiction(input.jurisdiction),
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    return bookmark;
  }

  /**
   * Get bookmark by ID
   */
  async getById(id: number): Promise<Bookmark | undefined> {
    const [bookmark] = await this.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.id, id))
      .limit(1);

    return bookmark;
  }

  /**
   * Get bookmark by analysis ID
   */
  async getByAnalysisId(analysisId: number): Promise<Bookmark | undefined> {
    const [bookmark] = await this.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.analysisId, analysisId))
      .limit(1);

    return bookmark;
  }

  /**
   * Get bookmark by document ID (document-level bookmark only)
   */
  async getDocumentBookmark(documentId: number): Promise<Bookmark | undefined> {
    const [bookmark] = await this.db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.documentId, documentId),
          isNull(bookmarks.analysisId)
        )
      )
      .limit(1);

    return bookmark;
  }

  /**
   * Check if an analysis is bookmarked
   */
  async isAnalysisBookmarked(analysisId: number): Promise<boolean> {
    const bookmark = await this.getByAnalysisId(analysisId);
    return !!bookmark;
  }

  /**
   * Check if a document is bookmarked (document-level)
   */
  async isDocumentBookmarked(documentId: number): Promise<boolean> {
    const bookmark = await this.getDocumentBookmark(documentId);
    return !!bookmark;
  }

  /**
   * Get bookmark by guidance document ID (guidance-level bookmark only)
   */
  async getGuidanceDocumentBookmark(guidanceDocId: number): Promise<Bookmark | undefined> {
    const [bookmark] = await this.db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.guidanceDocumentId, guidanceDocId),
          isNull(bookmarks.analysisId)
        )
      )
      .limit(1);

    return bookmark;
  }

  /**
   * Check if a guidance document is bookmarked
   */
  async isGuidanceDocumentBookmarked(guidanceDocId: number): Promise<boolean> {
    const bookmark = await this.getGuidanceDocumentBookmark(guidanceDocId);
    return !!bookmark;
  }

  /**
   * Delete guidance document bookmark
   */
  async deleteGuidanceDocumentBookmark(guidanceDocId: number): Promise<boolean> {
    const result = await this.db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.guidanceDocumentId, guidanceDocId),
          isNull(bookmarks.analysisId)
        )
      )
      .returning({ id: bookmarks.id });

    return result.length > 0;
  }

  /**
   * Get bookmark by fine ID
   */
  async getFineBookmark(fineId: number): Promise<Bookmark | undefined> {
    const [bookmark] = await this.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.fineId, fineId))
      .limit(1);

    return bookmark;
  }

  /**
   * Check if a fine is bookmarked
   */
  async isFineBookmarked(fineId: number): Promise<boolean> {
    const bookmark = await this.getFineBookmark(fineId);
    return !!bookmark;
  }

  /**
   * Delete fine bookmark
   */
  async deleteFineBookmark(fineId: number): Promise<boolean> {
    const result = await this.db
      .delete(bookmarks)
      .where(eq(bookmarks.fineId, fineId))
      .returning({ id: bookmarks.id });

    return result.length > 0;
  }

  /**
   * Get all bookmarked fine IDs for a state
   */
  async getBookmarkedFineIds(jurisdiction: string): Promise<number[]> {
    const results = await this.db
      .select({ fineId: bookmarks.fineId })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.jurisdiction, normalizeJurisdiction(jurisdiction)),
          isNotNull(bookmarks.fineId)
        )
      );

    return results
      .map(r => r.fineId)
      .filter((id): id is number => id !== null);
  }

  /**
   * Get all fine bookmarks with notes for a state (for inline notes display)
   */
  async getFineBookmarksWithNotes(jurisdiction: string): Promise<{ fineId: number; id: number; notes: string | null; createdBy: string | null }[]> {
    const results = await this.db
      .select({
        fineId: bookmarks.fineId,
        id: bookmarks.id,
        notes: bookmarks.notes,
        createdBy: bookmarks.createdBy,
      })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.jurisdiction, normalizeJurisdiction(jurisdiction)),
          isNotNull(bookmarks.fineId)
        )
      );

    return results.filter((r): r is { fineId: number; id: number; notes: string | null; createdBy: string | null } => r.fineId !== null);
  }

  /**
   * Get all bookmarked analysis IDs for a state
   */
  async getBookmarkedAnalysisIds(jurisdiction: string): Promise<number[]> {
    const results = await this.db
      .select({ analysisId: bookmarks.analysisId })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.jurisdiction, normalizeJurisdiction(jurisdiction)),
          sql`${bookmarks.analysisId} IS NOT NULL`
        )
      );

    return results
      .map(r => r.analysisId)
      .filter((id): id is number => id !== null);
  }

  /**
   * Get all bookmarks with details for a state
   */
  async getAllWithDetails(
    jurisdiction: string,
    type?: 'analysis' | 'document' | 'guidance' | 'fine'
  ): Promise<BookmarkWithDetails[]> {
    let query = this.db
      .select({
        id: bookmarks.id,
        documentId: bookmarks.documentId,
        analysisId: bookmarks.analysisId,
        guidanceDocumentId: bookmarks.guidanceDocumentId,
        fineId: bookmarks.fineId,
        issueType: bookmarks.issueType,
        jurisdiction: bookmarks.jurisdiction,
        notes: bookmarks.notes,
        createdBy: bookmarks.createdBy,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        documentTitle: regulatoryDocuments.title,
        documentCitation: regulatoryDocuments.citation,
        // Analysis fields
        analysisSeverity: complianceIssueAnalyses.severity,
        analysisFinalSeverity: complianceIssueAnalyses.finalSeverity,
        analysisClassification: complianceIssueAnalyses.tier2Classification,
        analysisTier3Classification: complianceIssueAnalyses.tier3Classification,
        highestTierCompleted: complianceIssueAnalyses.highestTierCompleted,
        // Key flags
        federalMandateFound: complianceIssueAnalyses.federalMandateFound,
        easyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,
        tier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
        // Guidance fields
        guidanceTitle: guidanceDocuments.title,
        guidanceCanonicalRef: guidanceDocuments.canonicalRef,
        guidanceAgency: guidanceDocuments.agency,
        // Fine fields
        finePenaltyType: finesFeesPenalties.penaltyType,
        fineAmount: finesFeesPenalties.amount,
        fineWhoPays: finesFeesPenalties.whoPays,
        fineViolationDescription: finesFeesPenalties.violationDescription,
        fineAgencyCanonicalName: agencies.canonicalName,
        fineAgencyLevel: agencies.level,
        finePerUnit: finesFeesPenalties.perUnit,
      })
      .from(bookmarks)
      .leftJoin(regulatoryDocuments, eq(bookmarks.documentId, regulatoryDocuments.id))
      .leftJoin(complianceIssueAnalyses, eq(bookmarks.analysisId, complianceIssueAnalyses.id))
      .leftJoin(guidanceDocuments, eq(bookmarks.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(finesFeesPenalties, eq(bookmarks.fineId, finesFeesPenalties.id))
      .leftJoin(agencies, eq(finesFeesPenalties.agencyId, agencies.id))
      .where(eq(bookmarks.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .orderBy(desc(bookmarks.createdAt))
      .$dynamic();

    // Add type filter
    if (type === 'analysis') {
      query = query.where(isNotNull(bookmarks.analysisId));
    } else if (type === 'document') {
      query = query.where(and(isNull(bookmarks.analysisId), isNull(bookmarks.guidanceDocumentId), isNull(bookmarks.fineId)));
    } else if (type === 'guidance') {
      query = query.where(and(isNotNull(bookmarks.guidanceDocumentId), isNull(bookmarks.analysisId)));
    } else if (type === 'fine') {
      query = query.where(isNotNull(bookmarks.fineId));
    }

    return query;
  }

  /**
   * Update bookmark notes
   */
  async update(id: number, data: UpdateBookmarkInput): Promise<Bookmark | undefined> {
    const [bookmark] = await this.db
      .update(bookmarks)
      .set({
        notes: data.notes,
        ...(data.createdBy !== undefined && { createdBy: data.createdBy }),
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, id))
      .returning();

    return bookmark;
  }

  /**
   * Delete a bookmark
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(bookmarks)
      .where(eq(bookmarks.id, id))
      .returning({ id: bookmarks.id });

    return result.length > 0;
  }

  /**
   * Delete bookmark by analysis ID
   */
  async deleteByAnalysisId(analysisId: number): Promise<boolean> {
    const result = await this.db
      .delete(bookmarks)
      .where(eq(bookmarks.analysisId, analysisId))
      .returning({ id: bookmarks.id });

    return result.length > 0;
  }

  /**
   * Delete document-level bookmark
   */
  async deleteDocumentBookmark(documentId: number): Promise<boolean> {
    const result = await this.db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.documentId, documentId),
          isNull(bookmarks.analysisId)
        )
      )
      .returning({ id: bookmarks.id });

    return result.length > 0;
  }

  /**
   * Get bookmark count for a state
   */
  async getCount(jurisdiction: string, type?: 'analysis' | 'document' | 'guidance' | 'fine'): Promise<number> {
    const base = eq(bookmarks.jurisdiction, normalizeJurisdiction(jurisdiction));

    const typeConditions = {
      analysis: and(base, isNotNull(bookmarks.analysisId)),
      document: and(base, isNull(bookmarks.analysisId), isNull(bookmarks.guidanceDocumentId), isNull(bookmarks.fineId)),
      guidance: and(base, isNotNull(bookmarks.guidanceDocumentId), isNull(bookmarks.analysisId)),
      fine: and(base, isNotNull(bookmarks.fineId)),
    };

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookmarks)
      .where(type ? typeConditions[type] : base);

    return result?.count ?? 0;
  }
}
