import { eq, and, desc, inArray } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { regulatoryDocuments, RegulatoryDocument } from '../schema/regulatory-documents';
import { analyses } from '../schema/analyses';
import { redFlags } from '../schema/red-flags';

export interface RegulationWithAnalysis extends RegulatoryDocument {
  hasImplementationIssues: boolean | null;
  overallComplexity: string | null;
  summary: string | null;
  requiresTechnicalReview: boolean | null;
  hasReportingRequirement: boolean | null;
  maxSeverity: number | null;
  numFlags: number | null;
  redFlags: Array<{
    id: number;
    category: string;
    explanation: string;
    severity: number;
    complexity: string;
    matchedPhrases: string[] | null;
    implementationApproach: string;
    effortEstimate: string | null;
    textExamples: string[] | null;
    reviewStatus: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewerNotes: string | null;
    priority: number | null;
    impactType: string | null;
  }>;
}

export class RegulatoryDocumentsRepository extends BaseRepository {
  async getAllWithAnalysis(): Promise<RegulationWithAnalysis[]> {
    const results = await this.db
      .select({
        id: regulatoryDocuments.id,
        sourceIndex: regulatoryDocuments.sourceIndex,
        type: regulatoryDocuments.type,
        state: regulatoryDocuments.state,
        title: regulatoryDocuments.title,
        url: regulatoryDocuments.url,
        urlType: regulatoryDocuments.urlType,
        content: regulatoryDocuments.content,
        createdAt: regulatoryDocuments.createdAt,
        parentId: regulatoryDocuments.parentId,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        hierarchyPath: regulatoryDocuments.hierarchyPath,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrSection: regulatoryDocuments.nycrrSection,
        analysisId: analyses.id,
        hasImplementationIssues: analyses.hasImplementationIssues,
        overallComplexity: analyses.overallComplexity,
        summary: analyses.summary,
        requiresTechnicalReview: analyses.requiresTechnicalReview,
        hasReportingRequirement: analyses.hasReportingRequirement,
        maxSeverity: analyses.maxSeverity,
        numFlags: analyses.numFlags,
      })
      .from(regulatoryDocuments)
      .leftJoin(
        analyses,
        and(
          eq(analyses.documentId, regulatoryDocuments.id),
          eq(analyses.isCurrent, true)
        )
      )
      .orderBy(desc(analyses.maxSeverity));

    // Get red flags for documents with analysis
    const analysisIds = results
      .filter(r => r.analysisId !== null)
      .map(r => r.analysisId as number);

    const flags = analysisIds.length > 0
      ? await this.db
          .select()
          .from(redFlags)
          .where(inArray(redFlags.analysisId, analysisIds))
      : [];

    const flagsByAnalysis = flags.reduce((acc, flag) => {
      const analysisId = Number(flag.analysisId);
      if (!acc[analysisId]) acc[analysisId] = [];
      acc[analysisId].push(flag);
      return acc;
    }, {} as Record<number, typeof flags>);

    return results.map(row => ({
      ...row,
      redFlags: row.analysisId
        ? (flagsByAnalysis[Number(row.analysisId)] || []).map(flag => ({
            ...flag,
            id: Number(flag.id),
          }))
        : [],
    }));
  }

  async getById(id: number): Promise<RegulatoryDocument | undefined> {
    const result = await this.db
      .select()
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.id, id))
      .limit(1);

    return result[0];
  }

  async getBySourceIndex(sourceIndex: number): Promise<RegulatoryDocument | undefined> {
    const result = await this.db
      .select()
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.sourceIndex, sourceIndex))
      .limit(1);

    return result[0];
  }
}
