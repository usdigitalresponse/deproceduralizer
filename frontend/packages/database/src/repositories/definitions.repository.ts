import { eq, and, asc, desc, sql, count, like, ilike, gte, lt, inArray, ne, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { BaseRepository } from './base.repository';
import { definitions, Definition, DeveloperStatus, ResolutionType, Developer } from '../schema/definitions';
import { definitionDocumentOccurrences } from '../schema/definition-document-occurrences';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

export interface DefinitionWithContext extends Definition {
  regulation?: {
    id: number;
    title: string | null;
    url: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
    jurisdiction: string | null;
    content?: string | null;
    parentId?: number | null;
    parentTitle?: string | null;
    parentHierarchyLevel?: string | null;
    // Summary metadata
    summary?: string | null;
    sectionType?: string | null;
    hasForm?: boolean | null;
    hasIbr?: boolean | null;
  };
  /** Whether the scope document is an ancestor of the source document */
  scopeIsAncestor?: boolean | null;
}

/**
 * Extended definition with scope document info for applicable definitions display
 */
export interface ApplicableDefinition extends DefinitionWithContext {
  scopeDocTitle?: string | null;
  scopeDocLevel?: string | null;
}

/**
 * Split result for applicable definitions - separates current document's definitions
 * from inherited ancestor definitions to avoid redundant fetching
 */
export interface SplitApplicableDefinitions {
  /** Definitions scoped to the current document itself */
  currentDocument: ApplicableDefinition[];
  /** Definitions inherited from ancestor documents via scope percolation */
  ancestors: ApplicableDefinition[];
}

/**
 * NOTE on "definedHere" vs "inherited" terminology:
 * - "definedHere" = definition's SOURCE document (documentId) matches the current document
 *   (i.e., the definition text is written in this document)
 * - "inherited" = definition comes from a different document
 *
 * This is distinct from scope:
 * - scopeDocumentId = where the definition APPLIES (may be an ancestor for broader scope)
 * - documentId = where the definition is WRITTEN (the source)
 */

/**
 * Definitions with full context - separates definitions that appear in text
 * from those that are merely in scope
 */
export interface DefinitionsWithContext {
  /** Definitions where the term actually appears in this document's text */
  usedInText: {
    /** Definitions whose SOURCE document (documentId) is this document */
    definedHere: ApplicableDefinition[];
    /** Definitions whose SOURCE document is a different document */
    inherited: ApplicableDefinition[];
  };
  /** Definitions in scope but the term doesn't appear in this document's text */
  availableButNotUsed: ApplicableDefinition[];
}

export interface DefinitionPaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  search?: string;
  letter?: string; // A-Z filter
  scope?: string;
  sortBy?: 'term' | 'extractedAt' | 'overlap';
  sortOrder?: 'asc' | 'desc';
  // Phase 4.1 filters
  scopeLevel?: 'section' | 'part' | 'chapter' | 'title';
  definitionType?: 'formal' | 'abbreviation';
  quality?: 'high' | 'medium' | 'low';
}

export interface PaginatedDefinitionsResult {
  data: DefinitionWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DefinitionStats {
  total: number;
  uniqueTerms: number;
  byScope: Record<string, number>;
  averageOverlap: number;
}

export interface AlphabeticalIndex {
  letter: string;
  count: number;
}

export interface AggregatedTerm {
  normalizedTerm: string;
  displayTerm: string;
  variantCount: number;
  previewDefinition: string | null;
  scopeLevels: (string | null)[];
  // Source info for single-variant terms (or preview source for multi-variant)
  previewDocumentId: number | null;
  previewCitation: string | null;  // e.g., "11 NYCRR § 310.3"
}

export interface PaginatedAggregatedResult {
  data: AggregatedTerm[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DefinitionDeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

export interface UpdateDefinitionDeveloperStatusInput {
  developerStatus: DeveloperStatus;
  developerAssigned: Developer;
  developerNotes?: string;
  resolutionType?: ResolutionType;
  resolutionComments?: string;
  developerQuestion?: string;
}

// =============================================================================
// Graph/Analytics Types
// =============================================================================

/**
 * Edge for definition network graph visualization.
 * Represents relationships between definitions based on shared scope or co-occurrence.
 */
export interface DefinitionEdge {
  sourceId: string;
  sourceTerm: string;
  sourceDocumentId: number;
  sourceCitation: string | null;
  targetId: string;
  targetTerm: string;
  targetDocumentId: number | null;
  targetCitation: string | null;
  edgeType: 'same_term' | 'shared_scope' | 'shared_occurrence';
  weight: number;
}

/**
 * Hub definition with high connectivity (most occurrences/references).
 */
export interface DefinitionHub {
  definitionId: number;
  term: string;
  normalizedTerm: string;
  documentId: number;
  citation: string | null;
  documentTitle: string | null;
  occurrenceCount: number;
  scopeLevel: string | null;
  definitionType: string | null;
  /** Snippet of the definition text (truncated) */
  definitionSnippet: string | null;
  /** Title number for filtering (nycrrTitle or njacTitle) */
  titleNumber: string | null;
}

/**
 * Scope-level matrix for chord diagram visualization.
 * Shows flow of definitions between scope levels.
 */
export interface ScopeLevelFlow {
  fromLevel: string;
  toLevel: string;
  count: number;
}

/**
 * Hierarchy node for edge bundling visualization.
 */
export interface DefinitionHierarchyNode {
  id: string;
  name: string;
  level: 'root' | 'title' | 'chapter' | 'part' | 'section';
  documentId?: number;
  children?: DefinitionHierarchyNode[];
  definitions?: { term: string; definitionId: number; documentId: number }[];
}

export class DefinitionsRepository extends BaseRepository {
  /**
   * Get a definition by ID
   */
  async getById(id: number): Promise<Definition | undefined> {
    const result = await this.db
      .select()
      .from(definitions)
      .where(eq(definitions.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Get definitions by document ID (when document_id is populated)
   */
  async getByDocumentId(documentId: number): Promise<Definition[]> {
    return this.db
      .select()
      .from(definitions)
      .where(eq(definitions.documentId, documentId))
      .orderBy(asc(definitions.term));
  }

  /**
   * Get definitions by URL (for URL-based lookups when document_id is NULL)
   * This is the primary method until document_id is backfilled
   */
  async getByUrl(url: string): Promise<Definition[]> {
    return this.db
      .select()
      .from(definitions)
      .where(eq(definitions.url, url))
      .orderBy(asc(definitions.term));
  }

  /**
   * Get definitions for a document, trying document_id first, then falling back to URL
   */
  async getForDocument(documentId: number): Promise<DefinitionWithContext[]> {
    // First try by document_id
    const byDocId = await this.db
      .select()
      .from(definitions)
      .where(eq(definitions.documentId, documentId))
      .orderBy(asc(definitions.term));

    if (byDocId.length > 0) {
      return byDocId.map(d => ({ ...d }));
    }

    // Fall back to URL-based lookup
    const [doc] = await this.db
      .select({ url: regulatoryDocuments.url })
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.id, documentId))
      .limit(1);

    if (!doc?.url) {
      return [];
    }

    const byUrl = await this.db
      .select()
      .from(definitions)
      .where(eq(definitions.url, doc.url))
      .orderBy(asc(definitions.term));

    return byUrl.map(d => ({ ...d }));
  }

  /**
   * Get all definitions that apply to a document via scope percolation.
   * Walks up ancestor chain and finds definitions whose scope_document_id
   * is in that chain (including the document itself).
   */
  async getApplicableDefinitions(documentId: number): Promise<ApplicableDefinition[]> {
    const results = await this.db.execute(sql`
      WITH RECURSIVE ancestors AS (
        -- Start with the current document
        SELECT id, parent_id, hierarchy_level, 0 as depth
        FROM regulatory_documents
        WHERE id = ${documentId}

        UNION ALL

        -- Walk up parent chain
        SELECT rd.id, rd.parent_id, rd.hierarchy_level, a.depth + 1
        FROM regulatory_documents rd
        INNER JOIN ancestors a ON rd.id = a.parent_id
        WHERE a.depth < 20
      )
      SELECT
        d.id,
        d.document_id as "documentId",
        d.url,
        d.term,
        d.verbatim_text as "verbatimText",
        d.is_verbatim_text_complete as "isVerbatimTextComplete",
        d.reference_completeness as "referenceCompleteness",
        d.reference_target as "referenceTarget",
        d.rephrased_definition as "rephrasedDefinition",
        d.scope,
        d.source_location as "sourceLocation",
        d.definition_overlap as "definitionOverlap",
        d.model_version as "modelVersion",
        d.extracted_at as "extractedAt",
        d.notes,
        d.scope_level as "scopeLevel",
        d.scope_document_id as "scopeDocumentId",
        d.definition_type as "definitionType",
        d.normalized_term as "normalizedTerm",
        d.is_cross_reference as "isCrossReference",
        -- Review workflow fields
        d.review_status as "reviewStatus",
        d.reviewed_at as "reviewedAt",
        d.reviewer_name as "reviewerName",
        d.justification_notes as "justificationNotes",
        d.team_notes as "teamNotes",
        d.original_values as "originalValues",
        -- Developer tracking fields
        d.developer_status as "developerStatus",
        d.developer_assigned as "developerAssigned",
        d.developer_notes as "developerNotes",
        d.resolution_type as "resolutionType",
        d.resolution_comments as "resolutionComments",
        d.developer_question as "developerQuestion",
        d.developer_checked_at as "developerCheckedAt",
        -- Regulation context (where definition is defined)
        rd.id as "regId",
        rd.title as "regTitle",
        rd.url as "regulationUrl",
        rd.nycrr_title as "nycrrTitle",
        rd.nycrr_part as "nycrrPart",
        rd.nycrr_section as "nycrrSection",
        rd.njac_title as "njacTitle",
        rd.njac_chapter as "njacChapter",
        rd.njac_subchapter as "njacSubchapter",
        rd.jurisdiction as "regJurisdiction",
        -- Scope document for display
        scope_doc.title as "scopeDocTitle",
        scope_doc.hierarchy_level as "scopeDocLevel"
      FROM definitions d
      JOIN ancestors a ON d.scope_document_id = a.id
      LEFT JOIN regulatory_documents rd ON d.document_id = rd.id
      LEFT JOIN regulatory_documents scope_doc ON d.scope_document_id = scope_doc.id
      ORDER BY
        CASE d.scope_level
          WHEN 'title' THEN 1
          WHEN 'subtitle' THEN 2
          WHEN 'chapter' THEN 3
          WHEN 'subchapter' THEN 4
          WHEN 'article' THEN 5
          WHEN 'part' THEN 6
          WHEN 'subpart' THEN 7
          WHEN 'section' THEN 8
          ELSE 9
        END,
        d.term
    `);

    // Map results to ApplicableDefinition
    return (results.rows as any[]).map((row): ApplicableDefinition => ({
      id: Number(row.id),
      documentId: row.documentId ? Number(row.documentId) : null,
      url: row.url,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
      rephrasedDefinition: row.rephrasedDefinition,
      scope: row.scope,
      sourceLocation: row.sourceLocation,
      definitionOverlap: row.definitionOverlap,
      modelVersion: row.modelVersion,
      extractedAt: row.extractedAt,
      notes: row.notes,
      scopeLevel: row.scopeLevel,
      scopeDocumentId: row.scopeDocumentId ? Number(row.scopeDocumentId) : null,
      definitionType: row.definitionType,
      normalizedTerm: row.normalizedTerm,
      isCrossReference: row.isCrossReference,
      // Review workflow fields
      reviewStatus: row.reviewStatus,
      reviewedAt: row.reviewedAt,
      reviewerName: row.reviewerName,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalValues: row.originalValues,
      // Developer tracking fields
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: row.regId ? {
        id: Number(row.regId),
        title: row.regTitle,
        url: row.regulationUrl,
        nycrrTitle: row.nycrrTitle ? Number(row.nycrrTitle) : null,
        nycrrPart: row.nycrrPart,
        nycrrSection: row.nycrrSection,
        njacTitle: row.njacTitle,
        njacChapter: row.njacChapter,
        njacSubchapter: row.njacSubchapter,
        jurisdiction: row.regJurisdiction,
      } : undefined,
      // Scope document info for display
      scopeDocTitle: row.scopeDocTitle,
      scopeDocLevel: row.scopeDocLevel,
    }));
  }

  /**
   * Get applicable definitions split into current document vs ancestors.
   * This avoids the need for a separate getForDocument call by splitting
   * the results of getApplicableDefinitions.
   */
  async getApplicableDefinitionsSplit(documentId: number): Promise<SplitApplicableDefinitions> {
    const allDefinitions = await this.getApplicableDefinitions(documentId);

    // Split by whether the definition is scoped to the current document or an ancestor
    const currentDocument: ApplicableDefinition[] = [];
    const ancestors: ApplicableDefinition[] = [];

    for (const def of allDefinitions) {
      if (def.scopeDocumentId === documentId) {
        currentDocument.push(def);
      } else {
        ancestors.push(def);
      }
    }

    return { currentDocument, ancestors };
  }

  /**
   * Get definitions with full context for a document.
   *
   * This distinguishes between:
   * 1. Definitions where the term appears in the document's text (from definition_document_occurrences)
   * 2. Definitions that are in scope but the term doesn't appear
   *
   * And within "used in text", separates:
   * - definedHere: definition's SOURCE document (documentId) matches the current document
   * - inherited: definition's SOURCE document is a different document
   *
   * Note: This is distinct from scope (scopeDocumentId), which determines where
   * a definition applies, not where it is written.
   */
  async getDefinitionsWithContext(documentId: number): Promise<DefinitionsWithContext> {
    // 1. Get definitions that appear in the document text (via occurrence links)
    const usedDefinitions = await this.getDefinitionsAppearingInDocument(documentId);

    // 2. Get all scope-applicable definitions
    const scopeDefinitions = await this.getApplicableDefinitions(documentId);

    // 3. Create a set of used definition IDs for quick lookup
    const usedIds = new Set(usedDefinitions.map(d => d.id));

    // 4. Split "used" into definedHere vs inherited based on SOURCE document (not scope)
    // A definition is "defined here" if its source document matches the current document
    const definedHere = usedDefinitions.filter(d => d.documentId === documentId);
    const inherited = usedDefinitions.filter(d => d.documentId !== documentId);

    // 5. "Available but not used" = scope definitions NOT in usedIds
    const availableButNotUsed = scopeDefinitions.filter(d => !usedIds.has(d.id));

    return {
      usedInText: { definedHere, inherited },
      availableButNotUsed
    };
  }

  /**
   * Get paginated definitions with regulation context for glossary page
   */
  async getAllPaginated(
    options: DefinitionPaginationOptions
  ): Promise<PaginatedDefinitionsResult> {
    const { jurisdiction, page, pageSize, search, letter, scope, sortBy = 'term', sortOrder = 'asc', scopeLevel, definitionType, quality } = options;
    const offset = (page - 1) * pageSize;

    // Build base conditions - join via URL to get state
    // Since document_id is NULL, we need to join on URL
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const conditions: ReturnType<typeof eq>[] = [];

    // Search filter
    if (search) {
      conditions.push(
        ilike(definitions.term, `%${search}%`)
      );
    }

    // Letter filter (first character of term)
    if (letter && letter.length === 1) {
      conditions.push(
        ilike(definitions.term, `${letter}%`)
      );
    }

    // Scope filter
    if (scope) {
      conditions.push(eq(definitions.scope, scope));
    }

    // Scope level filter (Phase 4.1)
    if (scopeLevel) {
      conditions.push(eq(definitions.scopeLevel, scopeLevel));
    }

    // Definition type filter (Phase 4.1)
    if (definitionType) {
      conditions.push(eq(definitions.definitionType, definitionType));
    }

    // Quality filter based on definition_overlap (Phase 4.1)
    if (quality === 'high') {
      conditions.push(eq(definitions.definitionOverlap, 1.0));
    } else if (quality === 'medium') {
      conditions.push(gte(definitions.definitionOverlap, 0.3));
      conditions.push(lt(definitions.definitionOverlap, 1.0));
    } else if (quality === 'low') {
      conditions.push(lt(definitions.definitionOverlap, 0.3));
    }

    // State filter via URL pattern
    conditions.push(like(definitions.url, jurisdictionPattern));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(whereClause);

    // Build sort column
    const sortColumn = {
      term: definitions.term,
      extractedAt: definitions.extractedAt,
      overlap: definitions.definitionOverlap,
    }[sortBy];

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(definitions.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context via URL join
    const results = await this.db
      .select({
        // Definition fields
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        // Phase 1 schema additions
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        // Review workflow fields
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        // Developer tracking fields
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.url, regulatoryDocuments.url))
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform to DefinitionWithContext
    const data: DefinitionWithContext[] = results.map(row => ({
      id: row.id,
      documentId: row.documentId,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
      rephrasedDefinition: row.rephrasedDefinition,
      scope: row.scope,
      definitionOverlap: row.definitionOverlap,
      sourceLocation: row.sourceLocation,
      url: row.url,
      modelVersion: row.modelVersion,
      extractedAt: row.extractedAt,
      notes: row.notes,
      // Phase 1 schema additions
      scopeLevel: row.scopeLevel,
      scopeDocumentId: row.scopeDocumentId,
      definitionType: row.definitionType,
      normalizedTerm: row.normalizedTerm,
      isCrossReference: row.isCrossReference,
      // Review workflow fields
      reviewStatus: row.reviewStatus,
      reviewedAt: row.reviewedAt,
      reviewerName: row.reviewerName,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalValues: row.originalValues,
      // Developer tracking fields
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: row.regulationId ? {
        id: row.regulationId,
        title: row.regulationTitle,
        url: row.regulationUrl,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        jurisdiction: row.regulationJurisdiction,
      } : undefined,
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get stats for the glossary header
   */
  async getStats(jurisdiction: JurisdictionCode): Promise<DefinitionStats> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const jurisdictionCondition = like(definitions.url, jurisdictionPattern);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(jurisdictionCondition);

    // Get unique terms count
    const [{ count: uniqueTerms }] = await this.db
      .select({ count: sql<number>`count(distinct ${definitions.term})` })
      .from(definitions)
      .where(jurisdictionCondition);

    // Get counts by scope
    const scopeResults = await this.db
      .select({
        scope: definitions.scope,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(jurisdictionCondition)
      .groupBy(definitions.scope);

    const byScope: Record<string, number> = {};
    for (const row of scopeResults) {
      byScope[row.scope ?? '(no scope)'] = row.count;
    }

    // Get average overlap
    const [{ avg }] = await this.db
      .select({ avg: sql<number>`avg(${definitions.definitionOverlap})` })
      .from(definitions)
      .where(jurisdictionCondition);

    return {
      total,
      uniqueTerms,
      byScope,
      averageOverlap: avg ?? 0,
    };
  }

  /**
   * Search definitions by term
   */
  async searchByTerm(jurisdiction: JurisdictionCode, term: string): Promise<DefinitionWithContext[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        // Phase 1 schema additions
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        // Review workflow fields
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        // Developer tracking fields
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.url, regulatoryDocuments.url))
      .where(and(
        like(definitions.url, jurisdictionPattern),
        ilike(definitions.term, `%${term}%`)
      ))
      .orderBy(asc(definitions.term))
      .limit(50);

    return results.map(row => ({
      id: row.id,
      documentId: row.documentId,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
      rephrasedDefinition: row.rephrasedDefinition,
      scope: row.scope,
      definitionOverlap: row.definitionOverlap,
      sourceLocation: row.sourceLocation,
      url: row.url,
      modelVersion: row.modelVersion,
      extractedAt: row.extractedAt,
      notes: row.notes,
      // Phase 1 schema additions
      scopeLevel: row.scopeLevel,
      scopeDocumentId: row.scopeDocumentId,
      definitionType: row.definitionType,
      normalizedTerm: row.normalizedTerm,
      isCrossReference: row.isCrossReference,
      // Review workflow fields
      reviewStatus: row.reviewStatus,
      reviewedAt: row.reviewedAt,
      reviewerName: row.reviewerName,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalValues: row.originalValues,
      // Developer tracking fields
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: row.regulationId ? {
        id: row.regulationId,
        title: row.regulationTitle,
        url: row.regulationUrl,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        jurisdiction: row.regulationJurisdiction,
      } : undefined,
    }));
  }

  /**
   * Get alphabetical index with counts for A-Z navigation
   */
  async getAlphabeticalIndex(jurisdiction: JurisdictionCode): Promise<AlphabeticalIndex[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        letter: sql<string>`upper(left(${definitions.term}, 1))`,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(like(definitions.url, jurisdictionPattern))
      .groupBy(sql`upper(left(${definitions.term}, 1))`)
      .orderBy(sql`upper(left(${definitions.term}, 1))`);

    return results.map(row => ({
      letter: row.letter,
      count: row.count,
    }));
  }

  /**
   * Get all unique scopes for filter dropdown
   */
  async getScopes(jurisdiction: JurisdictionCode): Promise<string[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .selectDistinct({ scope: definitions.scope })
      .from(definitions)
      .where(and(
        like(definitions.url, jurisdictionPattern),
        sql`${definitions.scope} is not null`
      ))
      .orderBy(asc(definitions.scope));

    return results.map(r => r.scope!).filter(Boolean);
  }

  /**
   * Get aggregated terms for glossary (grouped by normalized_term)
   */
  async getAggregatedTerms(options: {
    jurisdiction: JurisdictionCode;
    search?: string;
    letter?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedAggregatedResult> {
    const { jurisdiction, search, letter, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const conditions: ReturnType<typeof eq>[] = [like(definitions.url, jurisdictionPattern)];

    if (search) {
      conditions.push(ilike(definitions.normalizedTerm, `%${search.toLowerCase()}%`));
    }
    if (letter && letter.length === 1) {
      conditions.push(ilike(definitions.normalizedTerm, `${letter.toLowerCase()}%`));
    }

    const whereClause = and(...conditions);

    // Get total unique terms count
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(distinct ${definitions.normalizedTerm})` })
      .from(definitions)
      .where(whereClause);

    // Get aggregated terms with source info
    // For the preview, we pick the definition with overlap = 1.0 (high quality)
    // We also get its document_id to construct the citation
    const results = await this.db
      .select({
        normalizedTerm: definitions.normalizedTerm,
        displayTerm: sql<string>`max(${definitions.term})`,
        variantCount: sql<number>`count(*)::int`,
        previewDefinition: sql<string | null>`max(${definitions.verbatimText}) filter (where ${definitions.definitionOverlap} = 1.0)`,
        scopeLevels: sql<(string | null)[]>`array_agg(distinct ${definitions.scopeLevel})`,
        // Get document_id for preview (for building citation)
        previewDocumentId: sql<number | null>`max(${definitions.documentId}) filter (where ${definitions.definitionOverlap} = 1.0)`,
      })
      .from(definitions)
      .where(whereClause)
      .groupBy(definitions.normalizedTerm)
      .orderBy(asc(definitions.normalizedTerm))
      .limit(pageSize)
      .offset(offset);

    // Fetch regulation info for documents that have previewDocumentId
    // Note: SQL aggregation returns strings, so we need to convert to numbers
    const documentIds = results
      .filter(r => r.previewDocumentId !== null)
      .map(r => Number(r.previewDocumentId));

    let citationMap: Map<number, string> = new Map();
    if (documentIds.length > 0) {
      const regInfo = await this.db
        .select({
          id: regulatoryDocuments.id,
          nycrrTitle: regulatoryDocuments.nycrrTitle,
          nycrrPart: regulatoryDocuments.nycrrPart,
          nycrrSection: regulatoryDocuments.nycrrSection,
          njacTitle: regulatoryDocuments.njacTitle,
          njacChapter: regulatoryDocuments.njacChapter,
          njacSubchapter: regulatoryDocuments.njacSubchapter,
        })
        .from(regulatoryDocuments)
        .where(inArray(regulatoryDocuments.id, documentIds));

      for (const reg of regInfo) {
        let citation: string | null = null;
        if (reg.nycrrTitle) {
          const parts = [reg.nycrrTitle.toString(), 'NYCRR'];
          if (reg.nycrrPart) parts.push(reg.nycrrPart);
          if (reg.nycrrSection) parts.push(`§ ${reg.nycrrSection}`);
          citation = parts.join(' ');
        } else if (reg.njacTitle) {
          const parts = ['N.J.A.C.', reg.njacTitle];
          if (reg.njacChapter) parts.push(reg.njacChapter);
          if (reg.njacSubchapter) parts.push(reg.njacSubchapter);
          citation = parts.join(':');
        }
        if (citation) {
          citationMap.set(reg.id, citation);
        }
      }
    }

    return {
      data: results.map(r => ({
        normalizedTerm: r.normalizedTerm ?? '',
        displayTerm: r.displayTerm,
        variantCount: r.variantCount,
        previewDefinition: r.previewDefinition,
        scopeLevels: r.scopeLevels?.filter(Boolean) ?? [],
        previewDocumentId: r.previewDocumentId ? Number(r.previewDocumentId) : null,
        previewCitation: r.previewDocumentId ? (citationMap.get(Number(r.previewDocumentId)) ?? null) : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get all definitions for a specific normalized term
   */
  async getDefinitionsForTerm(
    normalizedTerm: string,
    jurisdiction: JurisdictionCode
  ): Promise<DefinitionWithContext[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        // Review workflow fields
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        // Developer tracking fields
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.url, regulatoryDocuments.url))
      .where(and(
        like(definitions.url, jurisdictionPattern),
        eq(definitions.normalizedTerm, normalizedTerm)
      ))
      .orderBy(desc(definitions.definitionOverlap), asc(definitions.term));

    return results.map(row => ({
      id: row.id,
      documentId: row.documentId,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
      rephrasedDefinition: row.rephrasedDefinition,
      scope: row.scope,
      definitionOverlap: row.definitionOverlap,
      sourceLocation: row.sourceLocation,
      url: row.url,
      modelVersion: row.modelVersion,
      extractedAt: row.extractedAt,
      notes: row.notes,
      scopeLevel: row.scopeLevel,
      scopeDocumentId: row.scopeDocumentId,
      definitionType: row.definitionType,
      normalizedTerm: row.normalizedTerm,
      isCrossReference: row.isCrossReference,
      // Review workflow fields
      reviewStatus: row.reviewStatus,
      reviewedAt: row.reviewedAt,
      reviewerName: row.reviewerName,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      originalValues: row.originalValues,
      // Developer tracking fields
      developerStatus: row.developerStatus,
      developerAssigned: row.developerAssigned,
      developerNotes: row.developerNotes,
      resolutionType: row.resolutionType,
      resolutionComments: row.resolutionComments,
      developerQuestion: row.developerQuestion,
      developerCheckedAt: row.developerCheckedAt,
      regulation: row.regulationId ? {
        id: row.regulationId,
        title: row.regulationTitle,
        url: row.regulationUrl,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        jurisdiction: row.regulationJurisdiction,
      } : undefined,
    }));
  }

  // ============================================================================
  // Term Occurrence Methods (definition_document_occurrences table)
  // ============================================================================

  /**
   * Get all documents where a definition's term actually appears in the text.
   *
   * This is different from scope-based applicability (getApplicableDefinitions):
   * - Scope: where a definition APPLIES based on hierarchy
   * - Occurrences: where a term ACTUALLY APPEARS in document text
   */
  async getDocumentsWithTerm(definitionId: number): Promise<{
    id: number;
    title: string | null;
    hierarchyLevel: string | null;
    jurisdiction: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
  }[]> {
    const results = await this.db
      .select({
        id: regulatoryDocuments.id,
        title: regulatoryDocuments.title,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        jurisdiction: regulatoryDocuments.jurisdiction,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        nycrrSection: regulatoryDocuments.nycrrSection,
        njacTitle: regulatoryDocuments.njacTitle,
        njacChapter: regulatoryDocuments.njacChapter,
        njacSubchapter: regulatoryDocuments.njacSubchapter,
      })
      .from(definitionDocumentOccurrences)
      .innerJoin(
        regulatoryDocuments,
        eq(definitionDocumentOccurrences.documentId, regulatoryDocuments.id)
      )
      .where(eq(definitionDocumentOccurrences.definitionId, definitionId))
      .orderBy(asc(regulatoryDocuments.title));

    return results;
  }

  /**
   * Get count of documents where a definition's term appears.
   */
  async getTermOccurrenceCount(definitionId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(definitionDocumentOccurrences)
      .where(eq(definitionDocumentOccurrences.definitionId, definitionId));

    return result?.count ?? 0;
  }

  /**
   * Get definitions that actually appear in a specific document's text.
   *
   * This is different from getApplicableDefinitions which uses scope hierarchy.
   * Use this when you want to know which defined terms are used in the text.
   * Returns ApplicableDefinition with scope document context.
   */
  async getDefinitionsAppearingInDocument(documentId: number): Promise<ApplicableDefinition[]> {
    const scopeDoc = alias(regulatoryDocuments, 'scope_doc');
    const sourceDoc = alias(regulatoryDocuments, 'source_doc');

    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        url: definitions.url,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        // Review workflow fields
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        // Developer tracking fields
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        // Scope document context
        scopeDocTitle: scopeDoc.title,
        scopeDocLevel: scopeDoc.hierarchyLevel,
        // Source document context (for linking to where definition is defined)
        regId: sourceDoc.id,
        regTitle: sourceDoc.title,
        regUrl: sourceDoc.url,
        regJurisdiction: sourceDoc.jurisdiction,
        njacTitle: sourceDoc.njacTitle,
        njacChapter: sourceDoc.njacChapter,
        njacSubchapter: sourceDoc.njacSubchapter,
        nycrrTitle: sourceDoc.nycrrTitle,
        nycrrPart: sourceDoc.nycrrPart,
        nycrrSection: sourceDoc.nycrrSection,
      })
      .from(definitionDocumentOccurrences)
      .innerJoin(
        definitions,
        eq(definitionDocumentOccurrences.definitionId, definitions.id)
      )
      .leftJoin(scopeDoc, eq(definitions.scopeDocumentId, scopeDoc.id))
      .leftJoin(sourceDoc, eq(definitions.documentId, sourceDoc.id))
      .where(eq(definitionDocumentOccurrences.documentId, documentId))
      .orderBy(asc(definitions.term));

    // Map results to include regulation context
    return results.map(row => ({
      ...row,
      regulation: row.regId ? {
        id: row.regId,
        title: row.regTitle,
        url: row.regUrl,
        jurisdiction: row.regJurisdiction,
        njacTitle: row.njacTitle,
        njacChapter: row.njacChapter,
        njacSubchapter: row.njacSubchapter,
        nycrrTitle: row.nycrrTitle,
        nycrrPart: row.nycrrPart,
        nycrrSection: row.nycrrSection,
      } : undefined,
    }));
  }

  /**
   * Get occurrence statistics for a state.
   */
  async getOccurrenceStats(jurisdiction: JurisdictionCode): Promise<{
    totalLinks: number;
    definitionsWithOccurrences: number;
    documentsWithOccurrences: number;
  }> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    // Total links for this state
    const [linksResult] = await this.db
      .select({ count: count() })
      .from(definitionDocumentOccurrences)
      .innerJoin(definitions, eq(definitionDocumentOccurrences.definitionId, definitions.id))
      .where(like(definitions.url, jurisdictionPattern));

    // Definitions with occurrences
    const [defsResult] = await this.db
      .select({ count: sql<number>`count(distinct ${definitionDocumentOccurrences.definitionId})` })
      .from(definitionDocumentOccurrences)
      .innerJoin(definitions, eq(definitionDocumentOccurrences.definitionId, definitions.id))
      .where(like(definitions.url, jurisdictionPattern));

    // Documents with occurrences
    const [docsResult] = await this.db
      .select({ count: sql<number>`count(distinct ${definitionDocumentOccurrences.documentId})` })
      .from(definitionDocumentOccurrences)
      .innerJoin(definitions, eq(definitionDocumentOccurrences.definitionId, definitions.id))
      .where(like(definitions.url, jurisdictionPattern));

    return {
      totalLinks: linksResult?.count ?? 0,
      definitionsWithOccurrences: Number(defsResult?.count ?? 0),
      documentsWithOccurrences: Number(docsResult?.count ?? 0),
    };
  }

  // ============================================================================
  // Review Workflow Methods
  // ============================================================================

  /**
   * Get definitions for review with pagination and filters
   */
  async getDefinitionsForReview(options: {
    jurisdiction: JurisdictionCode;
    page: number;
    pageSize: number;
    reviewStatus?: 'unreviewed' | 'confirmed' | 'corrected' | 'false_positive';
    scopeLevel?: string;
    definitionType?: 'formal' | 'abbreviation';
    documentId?: number;
    sortBy?: 'term' | 'extractedAt' | 'document';
    sortOrder?: 'asc' | 'desc';
    isCrossReference?: boolean;
    inDefinitionsSection?: boolean;
    scopeText?: string;
    scopeRelation?: 'self' | 'parent';
    scopeMismatch?: boolean;
    termSearch?: string;
    definitionId?: number;
  }): Promise<{
    data: DefinitionWithContext[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { jurisdiction, page, pageSize, reviewStatus, scopeLevel, definitionType, documentId, sortBy = 'document', sortOrder = 'asc', isCrossReference, inDefinitionsSection, scopeText, scopeRelation, scopeMismatch, termSearch, definitionId } = options;
    const offset = (page - 1) * pageSize;
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const conditions: ReturnType<typeof eq>[] = [like(definitions.url, jurisdictionPattern)];

    if (reviewStatus) {
      conditions.push(eq(definitions.reviewStatus, reviewStatus));
    }
    if (scopeLevel) {
      conditions.push(eq(definitions.scopeLevel, scopeLevel));
    }
    if (definitionType) {
      conditions.push(eq(definitions.definitionType, definitionType));
    }
    if (documentId) {
      conditions.push(eq(definitions.documentId, documentId));
    }
    if (isCrossReference !== undefined) {
      conditions.push(eq(definitions.isCrossReference, isCrossReference));
    }
    if (scopeText) {
      conditions.push(eq(definitions.scope, scopeText));
    }
    // Filter by scope relationship: 'self' means scope_document_id = document_id, 'parent' means they differ
    if (scopeRelation === 'self') {
      conditions.push(sql`${definitions.scopeDocumentId} = ${definitions.documentId}`);
    } else if (scopeRelation === 'parent') {
      conditions.push(sql`${definitions.scopeDocumentId} IS NOT NULL AND ${definitions.scopeDocumentId} != ${definitions.documentId}`);
    }
    // Filter by whether the source document title contains "definition" (case-insensitive)
    if (inDefinitionsSection === true) {
      conditions.push(sql`lower(${regulatoryDocuments.title}) like '%definition%'`);
    } else if (inDefinitionsSection === false) {
      conditions.push(sql`(${regulatoryDocuments.title} IS NULL OR lower(${regulatoryDocuments.title}) not like '%definition%')`);
    }
    // Filter by term search (case-insensitive partial match)
    if (termSearch) {
      conditions.push(ilike(definitions.term, `%${termSearch}%`));
    }
    // Filter by exact definition ID
    if (definitionId !== undefined) {
      conditions.push(eq(definitions.id, definitionId));
    }
    // Filter by scope mismatch: scope text contains a level keyword but scope_level doesn't match
    // E.g., scope says "in this subchapter" but scope_level is "section"
    if (scopeMismatch === true) {
      conditions.push(sql`(
        (lower(${definitions.scope}) like '%in this section%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'section') OR
        (lower(${definitions.scope}) like '%in this subpart%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'subpart') OR
        (lower(${definitions.scope}) like '%in this part%' AND lower(${definitions.scope}) NOT LIKE '%in this subpart%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'part') OR
        (lower(${definitions.scope}) like '%in this subchapter%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'subchapter') OR
        (lower(${definitions.scope}) like '%in this chapter%' AND lower(${definitions.scope}) NOT LIKE '%in this subchapter%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'chapter') OR
        (lower(${definitions.scope}) like '%in this subtitle%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'subtitle') OR
        (lower(${definitions.scope}) like '%in this title%' AND lower(${definitions.scope}) NOT LIKE '%in this subtitle%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'title')
      )`);
    } else if (scopeMismatch === false) {
      // Filter for definitions where scope text matches scope_level (or has no scope text with level keywords)
      conditions.push(sql`NOT (
        (lower(${definitions.scope}) like '%in this section%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'section') OR
        (lower(${definitions.scope}) like '%in this subpart%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'subpart') OR
        (lower(${definitions.scope}) like '%in this part%' AND lower(${definitions.scope}) NOT LIKE '%in this subpart%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'part') OR
        (lower(${definitions.scope}) like '%in this subchapter%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'subchapter') OR
        (lower(${definitions.scope}) like '%in this chapter%' AND lower(${definitions.scope}) NOT LIKE '%in this subchapter%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'chapter') OR
        (lower(${definitions.scope}) like '%in this subtitle%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'subtitle') OR
        (lower(${definitions.scope}) like '%in this title%' AND lower(${definitions.scope}) NOT LIKE '%in this subtitle%' AND ${definitions.scopeLevel} IS DISTINCT FROM 'title')
      )`);
    }

    const whereClause = and(...conditions);

    // Get total count (need join when filtering by inDefinitionsSection)
    const countQuery = this.db
      .select({ count: count() })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .where(whereClause);
    const [{ count: total }] = await countQuery;

    // Build sort with secondary sort by id for consistent ordering
    let orderByClause;
    if (sortBy === 'document') {
      orderByClause = sortOrder === 'asc'
        ? [asc(definitions.documentId), asc(definitions.term), asc(definitions.id)]
        : [desc(definitions.documentId), asc(definitions.term), asc(definitions.id)];
    } else if (sortBy === 'extractedAt') {
      orderByClause = [sortOrder === 'asc' ? asc(definitions.extractedAt) : desc(definitions.extractedAt), asc(definitions.id)];
    } else {
      orderByClause = [sortOrder === 'asc' ? asc(definitions.term) : desc(definitions.term), asc(definitions.id)];
    }

    // Create alias for parent document
    const parentDoc = alias(regulatoryDocuments, 'parent_doc');

    // Build the base query
    const baseQuery = this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        // Developer tracking fields
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
        regulationContent: regulatoryDocuments.content,
        regulationParentId: regulatoryDocuments.parentId,
        parentTitle: parentDoc.title,
        parentHierarchyLevel: parentDoc.hierarchyLevel,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .leftJoin(parentDoc, eq(regulatoryDocuments.parentId, parentDoc.id))
      .where(whereClause)
      .orderBy(...orderByClause);

    // Apply pagination directly in SQL (scopeRelation filter is already in whereClause)
    const results = await baseQuery.limit(pageSize).offset(offset);

    // Map results to DefinitionWithContext
    // scopeIsAncestor is computed based on whether scope == self or parent
    // (We verified all scope documents ARE ancestors, so this is just self vs parent distinction)
    const mappedResults = results.map(row => {
      // Compute scope relationship: null if no scope, true if parent/ancestor, false if self
      // Note: "scopeIsAncestor = true" means scope is a DIFFERENT document (parent/ancestor)
      // "scopeIsAncestor = false" means scope is the same document (self)
      const computedScopeIsAncestor = row.scopeDocumentId === null
        ? null
        : row.scopeDocumentId !== row.documentId;

      return {
        id: row.id,
        documentId: row.documentId,
        term: row.term,
        verbatimText: row.verbatimText,
        isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
        rephrasedDefinition: row.rephrasedDefinition,
        scope: row.scope,
        definitionOverlap: row.definitionOverlap,
        sourceLocation: row.sourceLocation,
        url: row.url,
        modelVersion: row.modelVersion,
        extractedAt: row.extractedAt,
        notes: row.notes,
        scopeLevel: row.scopeLevel,
        scopeDocumentId: row.scopeDocumentId,
        definitionType: row.definitionType,
        normalizedTerm: row.normalizedTerm,
        isCrossReference: row.isCrossReference,
        reviewStatus: row.reviewStatus,
        reviewedAt: row.reviewedAt,
        reviewerName: row.reviewerName,
        justificationNotes: row.justificationNotes,
        teamNotes: row.teamNotes,
        originalValues: row.originalValues,
        // Developer tracking fields
        developerStatus: row.developerStatus,
        developerAssigned: row.developerAssigned,
        developerNotes: row.developerNotes,
        resolutionType: row.resolutionType,
        resolutionComments: row.resolutionComments,
        developerQuestion: row.developerQuestion,
        developerCheckedAt: row.developerCheckedAt,
        scopeIsAncestor: computedScopeIsAncestor,
        regulation: row.regulationId ? {
          id: row.regulationId,
          title: row.regulationTitle,
          url: row.regulationUrl,
          nycrrTitle: row.regulationNycrrTitle,
          nycrrPart: row.regulationNycrrPart,
          nycrrSection: row.regulationNycrrSection,
          njacTitle: row.regulationNjacTitle,
          njacChapter: row.regulationNjacChapter,
          njacSubchapter: row.regulationNjacSubchapter,
          jurisdiction: row.regulationJurisdiction,
          content: row.regulationContent,
          parentId: row.regulationParentId,
          parentTitle: row.parentTitle,
          parentHierarchyLevel: row.parentHierarchyLevel,
        } : undefined,
      };
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: mappedResults,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get unique scope text values for filter dropdown
   */
  async getUniqueScopeTexts(jurisdiction: JurisdictionCode): Promise<string[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .selectDistinct({ scope: definitions.scope })
      .from(definitions)
      .where(and(
        like(definitions.url, jurisdictionPattern),
        sql`${definitions.scope} IS NOT NULL AND ${definitions.scope} != ''`
      ))
      .orderBy(asc(definitions.scope))
      .limit(100); // Limit to prevent too many options

    return results.map(r => r.scope).filter((s): s is string => s !== null);
  }

  /**
   * Update a definition's review status and optionally correct its values.
   * Stores original values in the originalValues JSONB column when corrections are made.
   */
  async updateDefinitionReview(
    id: number,
    update: {
      reviewStatus: 'confirmed' | 'corrected' | 'false_positive';
      reviewerName: string;
      justificationNotes?: string;
      teamNotes?: string;
      // Editable fields (only included if being corrected)
      term?: string;
      isVerbatimTextComplete?: boolean;
      verbatimText?: string;
      rephrasedDefinition?: string | null;
      scope?: string | null;
      scopeLevel?: string | null;
      scopeDocumentId?: number | null;
      definitionType?: string;
      isCrossReference?: boolean;
      referenceCompleteness?: string | null;
      referenceTarget?: string | null;
    }
  ): Promise<Definition | undefined> {
    // Get current values first
    const [current] = await this.db
      .select()
      .from(definitions)
      .where(eq(definitions.id, id))
      .limit(1);

    if (!current) {
      return undefined;
    }

    // Build the update object
    const updateData: Record<string, unknown> = {
      reviewStatus: update.reviewStatus,
      reviewedAt: new Date(),
      reviewerName: update.reviewerName,
    };

    if (update.justificationNotes !== undefined) {
      updateData.justificationNotes = update.justificationNotes;
    }
    if (update.teamNotes !== undefined) {
      updateData.teamNotes = update.teamNotes;
    }

    // If correcting, store original values and apply corrections
    if (update.reviewStatus === 'corrected') {
      const originalValues: Record<string, unknown> = {};

      // Track which fields are being changed
      if (update.term !== undefined && update.term !== current.term) {
        originalValues.term = current.term;
        updateData.term = update.term;
      }
      if (update.isVerbatimTextComplete !== undefined && update.isVerbatimTextComplete !== current.isVerbatimTextComplete) {
        originalValues.isVerbatimTextComplete = current.isVerbatimTextComplete;
        updateData.isVerbatimTextComplete = update.isVerbatimTextComplete;
      }
      if (update.verbatimText !== undefined && update.verbatimText !== current.verbatimText) {
        originalValues.verbatimText = current.verbatimText;
        updateData.verbatimText = update.verbatimText;
      }
      if (update.rephrasedDefinition !== undefined && update.rephrasedDefinition !== current.rephrasedDefinition) {
        originalValues.rephrasedDefinition = current.rephrasedDefinition;
        updateData.rephrasedDefinition = update.rephrasedDefinition;
      }
      if (update.scope !== undefined && update.scope !== current.scope) {
        originalValues.scope = current.scope;
        updateData.scope = update.scope;
      }
      if (update.scopeLevel !== undefined && update.scopeLevel !== current.scopeLevel) {
        originalValues.scopeLevel = current.scopeLevel;
        updateData.scopeLevel = update.scopeLevel;
      }
      if (update.scopeDocumentId !== undefined && update.scopeDocumentId !== current.scopeDocumentId) {
        originalValues.scopeDocumentId = current.scopeDocumentId;
        updateData.scopeDocumentId = update.scopeDocumentId;
      }
      if (update.definitionType !== undefined && update.definitionType !== current.definitionType) {
        originalValues.definitionType = current.definitionType;
        updateData.definitionType = update.definitionType;
      }
      if (update.isCrossReference !== undefined && update.isCrossReference !== current.isCrossReference) {
        originalValues.isCrossReference = current.isCrossReference;
        updateData.isCrossReference = update.isCrossReference;
      }
      if (update.referenceCompleteness !== undefined && update.referenceCompleteness !== current.referenceCompleteness) {
        originalValues.referenceCompleteness = current.referenceCompleteness;
        updateData.referenceCompleteness = update.referenceCompleteness;
      }
      if (update.referenceTarget !== undefined && update.referenceTarget !== current.referenceTarget) {
        originalValues.referenceTarget = current.referenceTarget;
        updateData.referenceTarget = update.referenceTarget;
      }

      // Only store original values if there are actual changes
      if (Object.keys(originalValues).length > 0) {
        updateData.originalValues = originalValues;
      }
    }

    // Execute the update
    const [updated] = await this.db
      .update(definitions)
      .set(updateData)
      .where(eq(definitions.id, id))
      .returning();

    return updated;
  }

  /**
   * Bulk update review status for multiple definitions
   */
  async bulkUpdateReviewStatus(
    ids: number[],
    reviewStatus: 'confirmed' | 'false_positive',
    reviewerName: string,
    justificationNotes?: string
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await this.db
      .update(definitions)
      .set({
        reviewStatus,
        reviewedAt: new Date(),
        reviewerName,
        justificationNotes: justificationNotes ?? null,
      })
      .where(inArray(definitions.id, ids));

    return result.rowCount ?? 0;
  }

  /**
   * Search regulatory documents for scope document typeahead.
   * Searches by title and citation.
   */
  async searchDocumentsForScope(
    query: string,
    jurisdiction: JurisdictionCode,
    limit: number = 10
  ): Promise<{
    id: number;
    title: string | null;
    hierarchyLevel: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
  }[]> {
    const jurisdictionCondition = eq(regulatoryDocuments.jurisdiction, normalizeJurisdiction(jurisdiction));

    const results = await this.db
      .select({
        id: regulatoryDocuments.id,
        title: regulatoryDocuments.title,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        njacTitle: regulatoryDocuments.njacTitle,
        njacChapter: regulatoryDocuments.njacChapter,
      })
      .from(regulatoryDocuments)
      .where(and(
        jurisdictionCondition,
        ilike(regulatoryDocuments.title, `%${query}%`)
      ))
      .orderBy(asc(regulatoryDocuments.title))
      .limit(limit);

    return results;
  }

  /**
   * Get a single document by ID for scope document typeahead prepopulation.
   */
  async getDocumentById(documentId: number): Promise<{
    id: number;
    title: string | null;
    hierarchyLevel: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
  } | null> {
    const [result] = await this.db
      .select({
        id: regulatoryDocuments.id,
        title: regulatoryDocuments.title,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        njacTitle: regulatoryDocuments.njacTitle,
        njacChapter: regulatoryDocuments.njacChapter,
      })
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.id, documentId))
      .limit(1);

    return result ?? null;
  }

  /**
   * Get ancestor documents for a given document.
   * Used for typeahead defaults to show parent/ancestor documents first.
   */
  async getAncestorDocuments(documentId: number): Promise<{
    id: number;
    title: string | null;
    hierarchyLevel: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
  }[]> {
    const results = await this.db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id, hierarchy_level, title,
               nycrr_title, nycrr_part, njac_title, njac_chapter, 0 as depth
        FROM regulatory_documents
        WHERE id = ${documentId}

        UNION ALL

        SELECT rd.id, rd.parent_id, rd.hierarchy_level, rd.title,
               rd.nycrr_title, rd.nycrr_part, rd.njac_title, rd.njac_chapter, a.depth + 1
        FROM regulatory_documents rd
        INNER JOIN ancestors a ON rd.id = a.parent_id
        WHERE a.depth < 10
      )
      SELECT id, title, hierarchy_level as "hierarchyLevel",
             nycrr_title as "nycrrTitle", nycrr_part as "nycrrPart",
             njac_title as "njacTitle", njac_chapter as "njacChapter"
      FROM ancestors
      ORDER BY depth
    `);

    return (results.rows as {
      id: number;
      title: string | null;
      hierarchyLevel: string | null;
      nycrrTitle: number | null;
      nycrrPart: string | null;
      njacTitle: string | null;
      njacChapter: string | null;
    }[]);
  }

  /**
   * Get review statistics for definitions dashboard
   */
  async getReviewStats(jurisdiction: JurisdictionCode): Promise<{
    unreviewed: number;
    confirmed: number;
    corrected: number;
    falsePositive: number;
    total: number;
  }> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        reviewStatus: definitions.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(like(definitions.url, jurisdictionPattern))
      .groupBy(definitions.reviewStatus);

    const stats: Record<string, number> = {};
    let total = 0;
    for (const row of results) {
      stats[row.reviewStatus ?? 'unreviewed'] = row.count;
      total += row.count;
    }

    return {
      unreviewed: stats['unreviewed'] ?? 0,
      confirmed: stats['confirmed'] ?? 0,
      corrected: stats['corrected'] ?? 0,
      falsePositive: stats['false_positive'] ?? 0,
      total,
    };
  }

  /**
   * Get corrected definitions for developer review queue.
   * Shows definitions that have been corrected with their original values.
   */
  async getCorrectedDefinitions(
    jurisdiction: JurisdictionCode,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    data: DefinitionWithContext[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const offset = (page - 1) * pageSize;

    const whereClause = and(
      like(definitions.url, jurisdictionPattern),
      eq(definitions.reviewStatus, 'corrected')
    );

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(whereClause);

    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        // Developer tracking fields
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(desc(definitions.reviewedAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map(row => ({
        id: row.id,
        documentId: row.documentId,
        term: row.term,
        verbatimText: row.verbatimText,
        isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
        rephrasedDefinition: row.rephrasedDefinition,
        scope: row.scope,
        definitionOverlap: row.definitionOverlap,
        sourceLocation: row.sourceLocation,
        url: row.url,
        modelVersion: row.modelVersion,
        extractedAt: row.extractedAt,
        notes: row.notes,
        scopeLevel: row.scopeLevel,
        scopeDocumentId: row.scopeDocumentId,
        definitionType: row.definitionType,
        normalizedTerm: row.normalizedTerm,
        isCrossReference: row.isCrossReference,
        reviewStatus: row.reviewStatus,
        reviewedAt: row.reviewedAt,
        reviewerName: row.reviewerName,
        justificationNotes: row.justificationNotes,
        teamNotes: row.teamNotes,
        originalValues: row.originalValues,
        // Developer tracking fields
        developerStatus: row.developerStatus,
        developerAssigned: row.developerAssigned,
        developerNotes: row.developerNotes,
        resolutionType: row.resolutionType,
        resolutionComments: row.resolutionComments,
        developerQuestion: row.developerQuestion,
        developerCheckedAt: row.developerCheckedAt,
        regulation: row.regulationId ? {
          id: row.regulationId,
          title: row.regulationTitle,
          url: row.regulationUrl,
          nycrrTitle: row.regulationNycrrTitle,
          nycrrPart: row.regulationNycrrPart,
          nycrrSection: row.regulationNycrrSection,
          njacTitle: row.regulationNjacTitle,
          njacChapter: row.regulationNjacChapter,
          njacSubchapter: row.regulationNjacSubchapter,
          jurisdiction: row.regulationJurisdiction,
        } : undefined,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // =========================================================================
  // DEVELOPER TRACKING METHODS
  // =========================================================================

  /**
   * Update developer status for a definition
   */
  async updateDeveloperStatus(
    id: number,
    data: UpdateDefinitionDeveloperStatusInput
  ): Promise<Definition | undefined> {
    const [result] = await this.db
      .update(definitions)
      .set({
        developerStatus: data.developerStatus,
        developerAssigned: data.developerAssigned,
        developerNotes: data.developerNotes,
        resolutionType: data.resolutionType,
        resolutionComments: data.resolutionComments,
        developerQuestion: data.developerQuestion,
        developerCheckedAt: new Date(),
      })
      .where(eq(definitions.id, id))
      .returning();

    return result;
  }

  /**
   * Get developer status counts for definitions in a state.
   * Only counts definitions that have been reviewed (not 'unreviewed').
   */
  async getDeveloperStatusCounts(jurisdiction: JurisdictionCode): Promise<DefinitionDeveloperStatusCounts> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    // Base condition: reviewed definitions only
    const reviewedCondition = and(
      like(definitions.url, jurisdictionPattern),
      ne(definitions.reviewStatus, 'unreviewed')
    );

    const results = await this.db
      .select({
        developerStatus: definitions.developerStatus,
        count: count(),
      })
      .from(definitions)
      .where(reviewedCondition)
      .groupBy(definitions.developerStatus);

    // Initialize counts
    const counts: DefinitionDeveloperStatusCounts = {
      unresolved: 0,
      resolved: 0,
      pending: 0,
      backlogged: 0,
      need_more_info: 0,
      total: 0,
    };

    // Populate from results
    for (const row of results) {
      const status = (row.developerStatus || 'unresolved') as keyof DefinitionDeveloperStatusCounts;
      if (status in counts && status !== 'total') {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get reviewed definitions for developer mode with pagination and filters.
   */
  async getReviewedDefinitionsPaginated(options: {
    jurisdiction: JurisdictionCode;
    page: number;
    pageSize: number;
    developerStatus?: DeveloperStatus | 'all';
    developerAssigned?: Developer;
    reviewStatus?: 'confirmed' | 'corrected' | 'false_positive' | 'all';
    hasJustification?: 'yes' | 'no' | 'all';
    hasTeamNotes?: 'yes' | 'no' | 'all';
    sortBy?: 'reviewedAt' | 'term' | 'developerCheckedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedDefinitionsResult> {
    const {
      jurisdiction,
      page,
      pageSize,
      developerStatus,
      developerAssigned,
      reviewStatus,
      hasJustification,
      hasTeamNotes,
      sortBy = 'reviewedAt',
      sortOrder = 'desc',
    } = options;

    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const offset = (page - 1) * pageSize;

    // Build conditions: reviewed definitions only
    const conditions = [
      like(definitions.url, jurisdictionPattern),
      ne(definitions.reviewStatus, 'unreviewed'),
    ];

    // Filter by developer status
    if (developerStatus && developerStatus !== 'all') {
      conditions.push(eq(definitions.developerStatus, developerStatus));
    }

    // Filter by developer assigned
    if (developerAssigned) {
      conditions.push(eq(definitions.developerAssigned, developerAssigned));
    }

    // Filter by review status
    if (reviewStatus && reviewStatus !== 'all') {
      conditions.push(eq(definitions.reviewStatus, reviewStatus));
    }

    // Filter by has justification notes
    if (hasJustification === 'yes') {
      conditions.push(sql`${definitions.justificationNotes} IS NOT NULL AND ${definitions.justificationNotes} != ''`);
    } else if (hasJustification === 'no') {
      conditions.push(sql`${definitions.justificationNotes} IS NULL OR ${definitions.justificationNotes} = ''`);
    }

    // Filter by has team notes
    if (hasTeamNotes === 'yes') {
      conditions.push(sql`${definitions.teamNotes} IS NOT NULL AND ${definitions.teamNotes} != ''`);
    } else if (hasTeamNotes === 'no') {
      conditions.push(sql`${definitions.teamNotes} IS NULL OR ${definitions.teamNotes} = ''`);
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(whereClause);

    // Determine sort column
    let orderByColumn;
    switch (sortBy) {
      case 'term':
        orderByColumn = definitions.term;
        break;
      case 'developerCheckedAt':
        orderByColumn = definitions.developerCheckedAt;
        break;
      case 'reviewedAt':
      default:
        orderByColumn = definitions.reviewedAt;
    }
    const orderBy = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);

    // Fetch definitions with regulation context
    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map(row => ({
        id: row.id,
        documentId: row.documentId,
        term: row.term,
        verbatimText: row.verbatimText,
        isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
        rephrasedDefinition: row.rephrasedDefinition,
        scope: row.scope,
        definitionOverlap: row.definitionOverlap,
        sourceLocation: row.sourceLocation,
        url: row.url,
        modelVersion: row.modelVersion,
        extractedAt: row.extractedAt,
        notes: row.notes,
        scopeLevel: row.scopeLevel,
        scopeDocumentId: row.scopeDocumentId,
        definitionType: row.definitionType,
        normalizedTerm: row.normalizedTerm,
        isCrossReference: row.isCrossReference,
        reviewStatus: row.reviewStatus,
        reviewedAt: row.reviewedAt,
        reviewerName: row.reviewerName,
        justificationNotes: row.justificationNotes,
        teamNotes: row.teamNotes,
        originalValues: row.originalValues,
        developerStatus: row.developerStatus,
        developerAssigned: row.developerAssigned,
        developerNotes: row.developerNotes,
        resolutionType: row.resolutionType,
        resolutionComments: row.resolutionComments,
        developerQuestion: row.developerQuestion,
        developerCheckedAt: row.developerCheckedAt,
        regulation: row.regulationId ? {
          id: row.regulationId,
          title: row.regulationTitle,
          nycrrTitle: row.regulationNycrrTitle,
          nycrrPart: row.regulationNycrrPart,
          nycrrSection: row.regulationNycrrSection,
          njacTitle: row.regulationNjacTitle,
          njacChapter: row.regulationNjacChapter,
          njacSubchapter: row.regulationNjacSubchapter,
          jurisdiction: row.regulationJurisdiction,
          url: row.regulationUrl,
        } : undefined,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get definitions that need more info from developers (for NeedMoreInfo queue).
   */
  async getNeedMoreInfoDefinitions(
    jurisdiction: JurisdictionCode,
    options: {
      page: number;
      pageSize: number;
      reviewerName?: string;
    }
  ): Promise<PaginatedDefinitionsResult> {
    const { page, pageSize, reviewerName } = options;
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const offset = (page - 1) * pageSize;

    const conditions = [
      like(definitions.url, jurisdictionPattern),
      eq(definitions.developerStatus, 'need_more_info'),
    ];

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(whereClause);

    // Fetch definitions with regulation context
    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatimTextComplete: definitions.isVerbatimTextComplete,
        referenceCompleteness: definitions.referenceCompleteness,
        referenceTarget: definitions.referenceTarget,
        rephrasedDefinition: definitions.rephrasedDefinition,
        scope: definitions.scope,
        definitionOverlap: definitions.definitionOverlap,
        sourceLocation: definitions.sourceLocation,
        url: definitions.url,
        modelVersion: definitions.modelVersion,
        extractedAt: definitions.extractedAt,
        notes: definitions.notes,
        scopeLevel: definitions.scopeLevel,
        scopeDocumentId: definitions.scopeDocumentId,
        definitionType: definitions.definitionType,
        normalizedTerm: definitions.normalizedTerm,
        isCrossReference: definitions.isCrossReference,
        reviewStatus: definitions.reviewStatus,
        reviewedAt: definitions.reviewedAt,
        reviewerName: definitions.reviewerName,
        justificationNotes: definitions.justificationNotes,
        teamNotes: definitions.teamNotes,
        originalValues: definitions.originalValues,
        developerStatus: definitions.developerStatus,
        developerAssigned: definitions.developerAssigned,
        developerNotes: definitions.developerNotes,
        resolutionType: definitions.resolutionType,
        resolutionComments: definitions.resolutionComments,
        developerQuestion: definitions.developerQuestion,
        developerCheckedAt: definitions.developerCheckedAt,
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationUrl: regulatoryDocuments.url,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationJurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(desc(definitions.developerCheckedAt))
      .limit(pageSize)
      .offset(offset);

    // Sort: reviewer's items first if reviewerName provided
    let sortedResults = results;
    if (reviewerName) {
      sortedResults = [
        ...results.filter(r => r.reviewerName === reviewerName),
        ...results.filter(r => r.reviewerName !== reviewerName),
      ];
    }

    return {
      data: sortedResults.map(row => ({
        id: row.id,
        documentId: row.documentId,
        term: row.term,
        verbatimText: row.verbatimText,
        isVerbatimTextComplete: row.isVerbatimTextComplete,
      referenceCompleteness: row.referenceCompleteness,
      referenceTarget: row.referenceTarget,
        rephrasedDefinition: row.rephrasedDefinition,
        scope: row.scope,
        definitionOverlap: row.definitionOverlap,
        sourceLocation: row.sourceLocation,
        url: row.url,
        modelVersion: row.modelVersion,
        extractedAt: row.extractedAt,
        notes: row.notes,
        scopeLevel: row.scopeLevel,
        scopeDocumentId: row.scopeDocumentId,
        definitionType: row.definitionType,
        normalizedTerm: row.normalizedTerm,
        isCrossReference: row.isCrossReference,
        reviewStatus: row.reviewStatus,
        reviewedAt: row.reviewedAt,
        reviewerName: row.reviewerName,
        justificationNotes: row.justificationNotes,
        teamNotes: row.teamNotes,
        originalValues: row.originalValues,
        developerStatus: row.developerStatus,
        developerAssigned: row.developerAssigned,
        developerNotes: row.developerNotes,
        resolutionType: row.resolutionType,
        resolutionComments: row.resolutionComments,
        developerQuestion: row.developerQuestion,
        developerCheckedAt: row.developerCheckedAt,
        regulation: row.regulationId ? {
          id: row.regulationId,
          title: row.regulationTitle,
          nycrrTitle: row.regulationNycrrTitle,
          nycrrPart: row.regulationNycrrPart,
          nycrrSection: row.regulationNycrrSection,
          njacTitle: row.regulationNjacTitle,
          njacChapter: row.regulationNjacChapter,
          njacSubchapter: row.regulationNjacSubchapter,
          jurisdiction: row.regulationJurisdiction,
          url: row.regulationUrl,
        } : undefined,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get counts for need_more_info definitions.
   */
  async getNeedMoreInfoCount(
    jurisdiction: JurisdictionCode,
    reviewerName?: string
  ): Promise<{ total: number; forReviewer: number }> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const baseCondition = and(
      like(definitions.url, jurisdictionPattern),
      eq(definitions.developerStatus, 'need_more_info')
    );

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(baseCondition);

    let forReviewer = 0;
    if (reviewerName) {
      const [result] = await this.db
        .select({ count: count() })
        .from(definitions)
        .where(and(baseCondition, eq(definitions.reviewerName, reviewerName)));
      forReviewer = result.count;
    }

    return { total, forReviewer };
  }

  /**
   * Get comprehensive analytics stats for the Definitions tab on the analytics page.
   * Aggregates data about scope levels, types, cross-references, quality, and review progress.
   */
  async getAnalyticsStats(jurisdiction: JurisdictionCode): Promise<{
    total: number;
    uniqueTerms: number;
    averageOverlap: number;
    byScopeLevel: Array<{ level: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
    crossRefStats: {
      total: number;
      byCompleteness: Array<{ type: string; count: number }>;
      byTarget: Array<{ target: string; count: number }>;
    };
    qualityDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    reviewStatus: {
      unreviewed: number;
      confirmed: number;
      corrected: number;
      falsePositive: number;
    };
  }> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const jurisdictionCondition = like(definitions.url, jurisdictionPattern);

    // Get total and unique terms
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(jurisdictionCondition);
    const total = totalResult.count;

    const [uniqueResult] = await this.db
      .select({ count: sql<number>`count(distinct ${definitions.term})` })
      .from(definitions)
      .where(jurisdictionCondition);
    const uniqueTerms = uniqueResult.count;

    // Get average overlap
    const [avgResult] = await this.db
      .select({ avg: sql<number>`avg(${definitions.definitionOverlap})` })
      .from(definitions)
      .where(jurisdictionCondition);
    const averageOverlap = avgResult.avg ?? 0;

    // Get counts by scope level
    const scopeLevelResults = await this.db
      .select({
        level: definitions.scopeLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(jurisdictionCondition)
      .groupBy(definitions.scopeLevel)
      .orderBy(sql`count(*) desc`);

    const byScopeLevel = scopeLevelResults.map(row => ({
      level: row.level ?? 'unknown',
      count: row.count,
    }));

    // Get counts by definition type
    const typeResults = await this.db
      .select({
        type: definitions.definitionType,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(jurisdictionCondition)
      .groupBy(definitions.definitionType)
      .orderBy(sql`count(*) desc`);

    const byType = typeResults.map(row => ({
      type: row.type ?? 'unknown',
      count: row.count,
    }));

    // Get cross-reference stats
    const [crossRefTotal] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(and(jurisdictionCondition, eq(definitions.isCrossReference, true)));

    const completenessResults = await this.db
      .select({
        type: definitions.referenceCompleteness,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(and(jurisdictionCondition, eq(definitions.isCrossReference, true)))
      .groupBy(definitions.referenceCompleteness);

    const targetResults = await this.db
      .select({
        target: definitions.referenceTarget,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(and(jurisdictionCondition, eq(definitions.isCrossReference, true)))
      .groupBy(definitions.referenceTarget)
      .orderBy(sql`count(*) desc`);

    const crossRefStats = {
      total: crossRefTotal.count,
      byCompleteness: completenessResults.map(row => ({
        type: row.type ?? 'unknown',
        count: row.count,
      })),
      byTarget: targetResults.map(row => ({
        target: row.target ?? 'unknown',
        count: row.count,
      })),
    };

    // Get quality distribution based on definition_overlap
    // High: >= 1.0, Medium: 0.3-1.0, Low: < 0.3
    const [highQuality] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(and(jurisdictionCondition, sql`${definitions.definitionOverlap} >= 1.0`));

    const [mediumQuality] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(and(
        jurisdictionCondition,
        sql`${definitions.definitionOverlap} >= 0.3`,
        sql`${definitions.definitionOverlap} < 1.0`
      ));

    const [lowQuality] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(and(jurisdictionCondition, sql`${definitions.definitionOverlap} < 0.3`));

    const qualityDistribution = {
      high: highQuality.count,
      medium: mediumQuality.count,
      low: lowQuality.count,
    };

    // Get review status breakdown
    const reviewResults = await this.db
      .select({
        status: definitions.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(jurisdictionCondition)
      .groupBy(definitions.reviewStatus);

    const reviewStats: Record<string, number> = {};
    for (const row of reviewResults) {
      reviewStats[row.status ?? 'unreviewed'] = row.count;
    }

    const reviewStatus = {
      unreviewed: reviewStats['unreviewed'] ?? 0,
      confirmed: reviewStats['confirmed'] ?? 0,
      corrected: reviewStats['corrected'] ?? 0,
      falsePositive: reviewStats['false_positive'] ?? 0,
    };

    return {
      total,
      uniqueTerms,
      averageOverlap,
      byScopeLevel,
      byType,
      crossRefStats,
      qualityDistribution,
      reviewStatus,
    };
  }

  // =============================================================================
  // Graph/Analytics Methods
  // =============================================================================

  /**
   * Get definition network graph edges.
   * Creates edges between definitions that:
   * 1. Share the same normalized term (same_term)
   * 2. Share the same scope document (shared_scope)
   * 3. Appear in the same documents via occurrences (shared_occurrence)
   *
   * Returns edges with weight based on connection strength.
   * @param jurisdiction - JurisdictionCode ('NY' or 'NJ')
   * @param limit - Max edges to return (default 500)
   */
  async getDefinitionGraph(
    jurisdiction: JurisdictionCode,
    limit: number = 500,
    titleFilter?: string
  ): Promise<DefinitionEdge[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const isNY = jurisdiction.toLowerCase() === 'ny';

    // Create aliases for self-join
    const d1 = alias(definitions, 'd1');
    const d2 = alias(definitions, 'd2');
    const rd1 = alias(regulatoryDocuments, 'rd1');
    const rd2 = alias(regulatoryDocuments, 'rd2');

    // Build base conditions for Query 1
    const query1Conditions = [
      like(d1.url, jurisdictionPattern),
      like(d2.url, jurisdictionPattern),
      isNotNull(d1.documentId),
      isNotNull(d2.documentId),
      ne(d1.documentId, d2.documentId), // Different source documents
    ];

    // Add title filter if specified
    if (titleFilter) {
      if (isNY) {
        query1Conditions.push(eq(rd1.nycrrTitle, parseInt(titleFilter, 10)));
      } else {
        query1Conditions.push(eq(rd1.njacTitle, titleFilter));
      }
    }

    // Query 1: Same normalized term from different sources
    const sameTermEdges = await this.db
      .select({
        sourceId: sql<string>`${d1.id}::text`,
        sourceTerm: d1.term,
        sourceDocumentId: d1.documentId,
        sourceCitation: rd1.citation,
        targetId: sql<string>`${d2.id}::text`,
        targetTerm: d2.term,
        targetDocumentId: d2.documentId,
        targetCitation: rd2.citation,
        weight: sql<number>`1`,
      })
      .from(d1)
      .innerJoin(d2, and(
        eq(d1.normalizedTerm, d2.normalizedTerm),
        sql`${d1.id} < ${d2.id}` // Avoid duplicates and self-loops
      ))
      .innerJoin(rd1, eq(d1.documentId, rd1.id)) // INNER JOIN since we need title filter
      .leftJoin(rd2, eq(d2.documentId, rd2.id))
      .where(and(...query1Conditions))
      .limit(Math.floor(limit / 3));

    // Build base conditions for Query 2
    const query2Conditions = [
      like(d1.url, jurisdictionPattern),
      isNotNull(d1.scopeDocumentId),
      isNotNull(d1.documentId),
      isNotNull(d2.documentId),
    ];

    // Add title filter for Query 2
    if (titleFilter) {
      if (isNY) {
        query2Conditions.push(eq(rd1.nycrrTitle, parseInt(titleFilter, 10)));
      } else {
        query2Conditions.push(eq(rd1.njacTitle, titleFilter));
      }
    }

    // Query 2: Shared scope document
    const sharedScopeEdges = await this.db
      .select({
        sourceId: sql<string>`${d1.id}::text`,
        sourceTerm: d1.term,
        sourceDocumentId: d1.documentId,
        sourceCitation: rd1.citation,
        targetId: sql<string>`${d2.id}::text`,
        targetTerm: d2.term,
        targetDocumentId: d2.documentId,
        targetCitation: rd2.citation,
        weight: sql<number>`1`,
      })
      .from(d1)
      .innerJoin(d2, and(
        eq(d1.scopeDocumentId, d2.scopeDocumentId),
        sql`${d1.id} < ${d2.id}`,
        ne(d1.normalizedTerm, d2.normalizedTerm) // Different terms
      ))
      .innerJoin(rd1, eq(d1.documentId, rd1.id)) // INNER JOIN since we need title filter
      .leftJoin(rd2, eq(d2.documentId, rd2.id))
      .where(and(...query2Conditions))
      .limit(Math.floor(limit / 3));

    // Build base conditions for Query 3
    const query3Conditions = [
      like(d1.url, jurisdictionPattern),
      isNotNull(d1.documentId),
      isNotNull(d2.documentId),
    ];

    // Add title filter for Query 3
    if (titleFilter) {
      if (isNY) {
        query3Conditions.push(eq(rd1.nycrrTitle, parseInt(titleFilter, 10)));
      } else {
        query3Conditions.push(eq(rd1.njacTitle, titleFilter));
      }
    }

    // Query 3: Shared occurrence documents (definitions appearing in same documents)
    const ddo1 = alias(definitionDocumentOccurrences, 'ddo1');
    const ddo2 = alias(definitionDocumentOccurrences, 'ddo2');

    const sharedOccurrenceEdges = await this.db
      .select({
        sourceId: sql<string>`${d1.id}::text`,
        sourceTerm: d1.term,
        sourceDocumentId: d1.documentId,
        sourceCitation: rd1.citation,
        targetId: sql<string>`${d2.id}::text`,
        targetTerm: d2.term,
        targetDocumentId: d2.documentId,
        targetCitation: rd2.citation,
        weight: sql<number>`count(distinct ${ddo1.documentId})::int`,
      })
      .from(d1)
      .innerJoin(ddo1, eq(d1.id, ddo1.definitionId))
      .innerJoin(ddo2, eq(ddo1.documentId, ddo2.documentId))
      .innerJoin(d2, and(
        eq(ddo2.definitionId, d2.id),
        sql`${d1.id} < ${d2.id}`,
        ne(d1.normalizedTerm, d2.normalizedTerm)
      ))
      .innerJoin(rd1, eq(d1.documentId, rd1.id)) // INNER JOIN since we need title filter
      .leftJoin(rd2, eq(d2.documentId, rd2.id))
      .where(and(...query3Conditions))
      .groupBy(
        d1.id,
        d1.term,
        d1.documentId,
        rd1.citation,
        d2.id,
        d2.term,
        d2.documentId,
        rd2.citation
      )
      .having(sql`count(distinct ${ddo1.documentId}) >= 2`)
      .limit(Math.floor(limit / 3));

    // Combine and format results
    const edges: DefinitionEdge[] = [];

    for (const row of sameTermEdges) {
      if (row.sourceDocumentId && row.targetDocumentId) {
        edges.push({
          ...row,
          sourceDocumentId: row.sourceDocumentId,
          targetDocumentId: row.targetDocumentId,
          edgeType: 'same_term',
        });
      }
    }

    for (const row of sharedScopeEdges) {
      if (row.sourceDocumentId && row.targetDocumentId) {
        edges.push({
          ...row,
          sourceDocumentId: row.sourceDocumentId,
          targetDocumentId: row.targetDocumentId,
          edgeType: 'shared_scope',
        });
      }
    }

    for (const row of sharedOccurrenceEdges) {
      if (row.sourceDocumentId && row.targetDocumentId) {
        edges.push({
          ...row,
          sourceDocumentId: row.sourceDocumentId,
          targetDocumentId: row.targetDocumentId,
          edgeType: 'shared_occurrence',
        });
      }
    }

    return edges;
  }

  /**
   * Get top definitions by occurrence count (hub definitions).
   * These are the most connected/referenced definitions in the corpus.
   * @param jurisdiction - JurisdictionCode ('NY' or 'NJ')
   * @param limit - Max definitions to return (default 20)
   * @param titleFilter - Optional title number to filter by (e.g., "11" for NY, "8" for NJ)
   */
  async getTopDefinitions(
    jurisdiction: JurisdictionCode,
    limit: number = 20,
    titleFilter?: string
  ): Promise<DefinitionHub[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const isNY = jurisdiction.toLowerCase() === 'ny';

    // Build conditions
    const conditions = [
      like(definitions.url, jurisdictionPattern),
      isNotNull(definitions.documentId),
    ];

    // Add title filter if specified
    if (titleFilter) {
      if (isNY) {
        conditions.push(eq(regulatoryDocuments.nycrrTitle, parseInt(titleFilter, 10)));
      } else {
        conditions.push(eq(regulatoryDocuments.njacTitle, titleFilter));
      }
    }

    const results = await this.db
      .select({
        definitionId: definitions.id,
        term: definitions.term,
        normalizedTerm: definitions.normalizedTerm,
        documentId: definitions.documentId,
        citation: regulatoryDocuments.citation,
        documentTitle: regulatoryDocuments.title,
        occurrenceCount: sql<number>`count(${definitionDocumentOccurrences.documentId})::int`,
        scopeLevel: definitions.scopeLevel,
        definitionType: definitions.definitionType,
        // Include definition text for snippet
        rephrasedDefinition: definitions.rephrasedDefinition,
        verbatimText: definitions.verbatimText,
        // Include title number for display
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        njacTitle: regulatoryDocuments.njacTitle,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .leftJoin(definitionDocumentOccurrences, eq(definitions.id, definitionDocumentOccurrences.definitionId))
      .where(and(...conditions))
      .groupBy(
        definitions.id,
        definitions.term,
        definitions.normalizedTerm,
        definitions.documentId,
        regulatoryDocuments.citation,
        regulatoryDocuments.title,
        definitions.scopeLevel,
        definitions.definitionType,
        definitions.rephrasedDefinition,
        definitions.verbatimText,
        regulatoryDocuments.nycrrTitle,
        regulatoryDocuments.njacTitle
      )
      .orderBy(desc(sql`count(${definitionDocumentOccurrences.documentId})`))
      .limit(limit);

    return results.map(row => {
      // Create snippet: prefer rephrased, fall back to verbatim, truncate to 120 chars
      const fullText = row.rephrasedDefinition || row.verbatimText;
      const snippet = fullText
        ? fullText.length > 120 ? fullText.slice(0, 120) + '...' : fullText
        : null;

      return {
        definitionId: row.definitionId,
        term: row.term,
        normalizedTerm: row.normalizedTerm ?? row.term.toLowerCase(),
        documentId: row.documentId!,
        citation: row.citation,
        documentTitle: row.documentTitle,
        occurrenceCount: row.occurrenceCount,
        scopeLevel: row.scopeLevel,
        definitionType: row.definitionType,
        definitionSnippet: snippet,
        titleNumber: isNY ? row.nycrrTitle?.toString() ?? null : row.njacTitle,
      };
    });
  }

  /**
   * Get scope level flow matrix for chord diagram.
   * Shows how definitions flow from source scope levels to target scope levels.
   * @param jurisdiction - JurisdictionCode ('NY' or 'NJ')
   */
  async getScopeLevelFlows(jurisdiction: JurisdictionCode): Promise<ScopeLevelFlow[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    // For each definition, get its source scope level and compare with occurrence doc levels
    // This shows how definitions at one level are used in documents at another level
    const scopeDoc = alias(regulatoryDocuments, 'scope_doc');

    const results = await this.db
      .select({
        fromLevel: definitions.scopeLevel,
        toLevel: scopeDoc.hierarchyLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .innerJoin(definitionDocumentOccurrences, eq(definitions.id, definitionDocumentOccurrences.definitionId))
      .innerJoin(scopeDoc, eq(definitionDocumentOccurrences.documentId, scopeDoc.id))
      .where(and(
        like(definitions.url, jurisdictionPattern),
        isNotNull(definitions.scopeLevel),
        isNotNull(scopeDoc.hierarchyLevel)
      ))
      .groupBy(definitions.scopeLevel, scopeDoc.hierarchyLevel)
      .orderBy(desc(sql`count(*)`));

    return results.map(row => ({
      fromLevel: row.fromLevel ?? 'unknown',
      toLevel: row.toLevel ?? 'unknown',
      count: row.count,
    }));
  }

  /**
   * Get definition hierarchy data for edge bundling visualization.
   * Builds a tree of titles → chapters → parts → sections with definitions at leaves.
   * @param jurisdiction - JurisdictionCode ('NY' or 'NJ')
   * @param limit - Max definitions per section (default 10)
   */
  async getDefinitionHierarchy(jurisdiction: JurisdictionCode, limit: number = 10): Promise<DefinitionHierarchyNode> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const isNY = jurisdiction.toLowerCase() === 'ny';

    // Get definitions with their document hierarchy info
    const results = await this.db
      .select({
        definitionId: definitions.id,
        term: definitions.term,
        documentId: definitions.documentId,
        nycrrTitle: regulatoryDocuments.nycrrTitle,
        nycrrPart: regulatoryDocuments.nycrrPart,
        njacTitle: regulatoryDocuments.njacTitle,
        njacChapter: regulatoryDocuments.njacChapter,
        docTitle: regulatoryDocuments.title,
      })
      .from(definitions)
      .innerJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .where(and(
        like(definitions.url, jurisdictionPattern),
        isNotNull(definitions.documentId)
      ))
      .orderBy(
        isNY ? regulatoryDocuments.nycrrTitle : regulatoryDocuments.njacTitle,
        isNY ? regulatoryDocuments.nycrrPart : regulatoryDocuments.njacChapter,
        definitions.term
      )
      .limit(500); // Cap for performance

    // Build hierarchy tree
    const root: DefinitionHierarchyNode = {
      id: 'root',
      name: normalizeJurisdiction(jurisdiction),
      level: 'root',
      children: [],
    };

    const titleMap = new Map<string, DefinitionHierarchyNode>();

    for (const row of results) {
      if (!row.documentId) continue;

      const titleKey = isNY
        ? `title-${row.nycrrTitle}`
        : `title-${row.njacTitle}`;
      const titleName = isNY
        ? `Title ${row.nycrrTitle}`
        : `Title ${row.njacTitle}`;

      // Get or create title node
      let titleNode = titleMap.get(titleKey);
      if (!titleNode) {
        titleNode = {
          id: titleKey,
          name: titleName,
          level: 'title',
          children: [],
        };
        titleMap.set(titleKey, titleNode);
        root.children!.push(titleNode);
      }

      // For NY, group by part; for NJ, group by chapter
      const partKey = isNY
        ? `part-${row.nycrrTitle}-${row.nycrrPart}`
        : `chapter-${row.njacTitle}-${row.njacChapter}`;
      const partName = isNY
        ? `Part ${row.nycrrPart}`
        : `Chapter ${row.njacChapter}`;

      // Get or create part/chapter node
      let partNode = titleNode.children?.find(c => c.id === partKey);
      if (!partNode) {
        partNode = {
          id: partKey,
          name: partName,
          level: isNY ? 'part' : 'chapter',
          definitions: [],
        };
        titleNode.children!.push(partNode);
      }

      // Add definition to part (with limit per section)
      if (!partNode.definitions) partNode.definitions = [];
      if (partNode.definitions.length < limit) {
        partNode.definitions.push({
          term: row.term,
          definitionId: row.definitionId,
          documentId: row.documentId,
        });
      }
    }

    return root;
  }

  /**
   * Get available title numbers for definition filtering.
   * Efficient query that only fetches distinct titles.
   * @param jurisdiction - JurisdictionCode ('NY' or 'NJ')
   */
  async getAvailableTitles(jurisdiction: JurisdictionCode): Promise<string[]> {
    const jurisdictionPattern = jurisdiction.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const isNY = jurisdiction.toLowerCase() === 'ny';

    const titleColumn = isNY ? regulatoryDocuments.nycrrTitle : regulatoryDocuments.njacTitle;

    const results = await this.db
      .selectDistinct({
        title: titleColumn,
      })
      .from(definitions)
      .innerJoin(regulatoryDocuments, eq(definitions.documentId, regulatoryDocuments.id))
      .where(and(
        like(definitions.url, jurisdictionPattern),
        isNotNull(definitions.documentId),
        isNotNull(titleColumn)
      ))
      .orderBy(titleColumn);

    return results
      .map(r => r.title?.toString() ?? '')
      .filter(t => t !== '');
  }
}
