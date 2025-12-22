import { eq, and, asc, desc, sql, count, like, ilike, gte, lt } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { definitions, Definition } from '../schema/definitions';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { StateCode } from '../schema/constants';

export interface DefinitionWithContext extends Definition {
  regulation?: {
    id: number;
    title: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
    state: string | null;
  };
}

export interface DefinitionPaginationOptions {
  state: StateCode;
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
}

export interface PaginatedAggregatedResult {
  data: AggregatedTerm[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
   * Get paginated definitions with regulation context for glossary page
   */
  async getAllPaginated(
    options: DefinitionPaginationOptions
  ): Promise<PaginatedDefinitionsResult> {
    const { state, page, pageSize, search, letter, scope, sortBy = 'term', sortOrder = 'asc', scopeLevel, definitionType, quality } = options;
    const offset = (page - 1) * pageSize;

    // Build base conditions - join via URL to get state
    // Since document_id is NULL, we need to join on URL
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

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
    conditions.push(like(definitions.url, statePattern));

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

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get paginated results with regulation context via URL join
    const results = await this.db
      .select({
        // Definition fields
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatim: definitions.isVerbatim,
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
        // Regulation context
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationState: regulatoryDocuments.state,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.url, regulatoryDocuments.url))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset);

    // Transform to DefinitionWithContext
    const data: DefinitionWithContext[] = results.map(row => ({
      id: row.id,
      documentId: row.documentId,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatim: row.isVerbatim,
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
      regulation: row.regulationId ? {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        state: row.regulationState,
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
  async getStats(state: StateCode): Promise<DefinitionStats> {
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';
    const stateCondition = like(definitions.url, statePattern);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(definitions)
      .where(stateCondition);

    // Get unique terms count
    const [{ count: uniqueTerms }] = await this.db
      .select({ count: sql<number>`count(distinct ${definitions.term})` })
      .from(definitions)
      .where(stateCondition);

    // Get counts by scope
    const scopeResults = await this.db
      .select({
        scope: definitions.scope,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(stateCondition)
      .groupBy(definitions.scope);

    const byScope: Record<string, number> = {};
    for (const row of scopeResults) {
      byScope[row.scope ?? '(no scope)'] = row.count;
    }

    // Get average overlap
    const [{ avg }] = await this.db
      .select({ avg: sql<number>`avg(${definitions.definitionOverlap})` })
      .from(definitions)
      .where(stateCondition);

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
  async searchByTerm(state: StateCode, term: string): Promise<DefinitionWithContext[]> {
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatim: definitions.isVerbatim,
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
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationState: regulatoryDocuments.state,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.url, regulatoryDocuments.url))
      .where(and(
        like(definitions.url, statePattern),
        ilike(definitions.term, `%${term}%`)
      ))
      .orderBy(asc(definitions.term))
      .limit(50);

    return results.map(row => ({
      id: row.id,
      documentId: row.documentId,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatim: row.isVerbatim,
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
      regulation: row.regulationId ? {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        state: row.regulationState,
      } : undefined,
    }));
  }

  /**
   * Get alphabetical index with counts for A-Z navigation
   */
  async getAlphabeticalIndex(state: StateCode): Promise<AlphabeticalIndex[]> {
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        letter: sql<string>`upper(left(${definitions.term}, 1))`,
        count: sql<number>`count(*)::int`,
      })
      .from(definitions)
      .where(like(definitions.url, statePattern))
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
  async getScopes(state: StateCode): Promise<string[]> {
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .selectDistinct({ scope: definitions.scope })
      .from(definitions)
      .where(and(
        like(definitions.url, statePattern),
        sql`${definitions.scope} is not null`
      ))
      .orderBy(asc(definitions.scope));

    return results.map(r => r.scope!).filter(Boolean);
  }

  /**
   * Get aggregated terms for glossary (grouped by normalized_term)
   */
  async getAggregatedTerms(options: {
    state: StateCode;
    search?: string;
    letter?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedAggregatedResult> {
    const { state, search, letter, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const conditions: ReturnType<typeof eq>[] = [like(definitions.url, statePattern)];

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

    // Get aggregated terms
    const results = await this.db
      .select({
        normalizedTerm: definitions.normalizedTerm,
        displayTerm: sql<string>`max(${definitions.term})`,
        variantCount: sql<number>`count(*)::int`,
        previewDefinition: sql<string | null>`max(${definitions.verbatimText}) filter (where ${definitions.definitionOverlap} = 1.0)`,
        scopeLevels: sql<(string | null)[]>`array_agg(distinct ${definitions.scopeLevel})`,
      })
      .from(definitions)
      .where(whereClause)
      .groupBy(definitions.normalizedTerm)
      .orderBy(asc(definitions.normalizedTerm))
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map(r => ({
        normalizedTerm: r.normalizedTerm ?? '',
        displayTerm: r.displayTerm,
        variantCount: r.variantCount,
        previewDefinition: r.previewDefinition,
        scopeLevels: r.scopeLevels?.filter(Boolean) ?? [],
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
    state: StateCode
  ): Promise<DefinitionWithContext[]> {
    const statePattern = state.toLowerCase() === 'ny' ? '%new-york%' : '%new-jersey%';

    const results = await this.db
      .select({
        id: definitions.id,
        documentId: definitions.documentId,
        term: definitions.term,
        verbatimText: definitions.verbatimText,
        isVerbatim: definitions.isVerbatim,
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
        regulationId: regulatoryDocuments.id,
        regulationTitle: regulatoryDocuments.title,
        regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
        regulationNycrrPart: regulatoryDocuments.nycrrPart,
        regulationNycrrSection: regulatoryDocuments.nycrrSection,
        regulationNjacTitle: regulatoryDocuments.njacTitle,
        regulationNjacChapter: regulatoryDocuments.njacChapter,
        regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
        regulationState: regulatoryDocuments.state,
      })
      .from(definitions)
      .leftJoin(regulatoryDocuments, eq(definitions.url, regulatoryDocuments.url))
      .where(and(
        like(definitions.url, statePattern),
        eq(definitions.normalizedTerm, normalizedTerm)
      ))
      .orderBy(desc(definitions.definitionOverlap), asc(definitions.term));

    return results.map(row => ({
      id: row.id,
      documentId: row.documentId,
      term: row.term,
      verbatimText: row.verbatimText,
      isVerbatim: row.isVerbatim,
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
      regulation: row.regulationId ? {
        id: row.regulationId,
        title: row.regulationTitle,
        nycrrTitle: row.regulationNycrrTitle,
        nycrrPart: row.regulationNycrrPart,
        nycrrSection: row.regulationNycrrSection,
        njacTitle: row.regulationNjacTitle,
        njacChapter: row.regulationNjacChapter,
        njacSubchapter: row.regulationNjacSubchapter,
        state: row.regulationState,
      } : undefined,
    }));
  }
}
