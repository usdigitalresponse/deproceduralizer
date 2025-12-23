'use server';

import {
  db,
  DefinitionsRepository,
  type Definition,
  type DefinitionWithContext,
  type ApplicableDefinition,
  type PaginatedDefinitionsResult,
  type PaginatedAggregatedResult,
  type DefinitionStats,
  type AlphabeticalIndex,
  type StateCode,
} from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage } from './types';

const definitionsRepo = new DefinitionsRepository(db);

/**
 * Get definitions for a specific document (for regulation detail page)
 * Tries document_id first, falls back to URL-based lookup
 */
export async function getDefinitionsForDocument(
  documentId: number
): Promise<ActionResult<DefinitionWithContext[]>> {
  try {
    const definitions = await definitionsRepo.getForDocument(documentId);
    return success(definitions);
  } catch (error) {
    console.error('[getDefinitionsForDocument]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all definitions that apply to a document via scope percolation.
 * Walks up the ancestor chain and returns definitions from parent scopes.
 */
export async function getApplicableDefinitionsForDocument(
  documentId: number
): Promise<ActionResult<ApplicableDefinition[]>> {
  try {
    const definitions = await definitionsRepo.getApplicableDefinitions(documentId);
    return success(definitions);
  } catch (error) {
    console.error('[getApplicableDefinitionsForDocument]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get paginated definitions for the glossary page
 */
export async function getDefinitionsPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    search?: string;
    letter?: string;
    scope?: string;
    sortBy?: 'term' | 'extractedAt' | 'overlap';
    sortOrder?: 'asc' | 'desc';
    // Phase 4.1 filters
    scopeLevel?: 'section' | 'part' | 'chapter' | 'title';
    definitionType?: 'formal' | 'abbreviation';
    quality?: 'high' | 'medium' | 'low';
  }
): Promise<ActionResult<PaginatedDefinitionsResult>> {
  try {
    const result = await definitionsRepo.getAllPaginated({
      state,
      ...options,
    });
    return success(result);
  } catch (error) {
    console.error('[getDefinitionsPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get stats for the glossary header
 */
export async function getDefinitionStats(
  state: StateCode
): Promise<ActionResult<DefinitionStats>> {
  try {
    const stats = await definitionsRepo.getStats(state);
    return success(stats);
  } catch (error) {
    console.error('[getDefinitionStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Search definitions by term
 */
export async function searchDefinitions(
  state: StateCode,
  term: string
): Promise<ActionResult<DefinitionWithContext[]>> {
  try {
    const definitions = await definitionsRepo.searchByTerm(state, term);
    return success(definitions);
  } catch (error) {
    console.error('[searchDefinitions]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get alphabetical index for A-Z navigation
 */
export async function getAlphabeticalIndex(
  state: StateCode
): Promise<ActionResult<AlphabeticalIndex[]>> {
  try {
    const index = await definitionsRepo.getAlphabeticalIndex(state);
    return success(index);
  } catch (error) {
    console.error('[getAlphabeticalIndex]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all unique scopes for filter dropdown
 */
export async function getDefinitionScopes(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const scopes = await definitionsRepo.getScopes(state);
    return success(scopes);
  } catch (error) {
    console.error('[getDefinitionScopes]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get a single definition by ID
 */
export async function getDefinitionById(
  id: number
): Promise<ActionResult<Definition | undefined>> {
  try {
    const definition = await definitionsRepo.getById(id);
    return success(definition);
  } catch (error) {
    console.error('[getDefinitionById]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get aggregated terms for glossary (grouped by normalized_term)
 */
export async function getAggregatedTermsPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    search?: string;
    letter?: string;
  }
): Promise<ActionResult<PaginatedAggregatedResult>> {
  try {
    const result = await definitionsRepo.getAggregatedTerms({ state, ...options });
    return success(result);
  } catch (error) {
    console.error('[getAggregatedTermsPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get all definitions for a specific normalized term
 */
export async function getDefinitionsForTermAction(
  normalizedTerm: string,
  state: StateCode
): Promise<ActionResult<DefinitionWithContext[]>> {
  try {
    const definitions = await definitionsRepo.getDefinitionsForTerm(normalizedTerm, state);
    return success(definitions);
  } catch (error) {
    console.error('[getDefinitionsForTermAction]', error);
    return failure(getErrorMessage(error));
  }
}

// ============================================================================
// Definition Review Actions
// ============================================================================

/**
 * Get definitions for the review queue with pagination and filters
 */
export async function getDefinitionsForReview(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    reviewStatus?: 'unreviewed' | 'confirmed' | 'corrected' | 'false_positive';
    scopeLevel?: string;
    definitionType?: 'formal' | 'abbreviation';
    documentId?: number;
    sortBy?: 'term' | 'extractedAt' | 'document';
    sortOrder?: 'asc' | 'desc';
    isCrossReference?: boolean;
    scopeText?: string;
    scopeRelation?: 'self' | 'parent';
  }
): Promise<ActionResult<{
  data: DefinitionWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>> {
  try {
    const result = await definitionsRepo.getDefinitionsForReview({
      state,
      ...options,
    });
    return success(result);
  } catch (error) {
    console.error('[getDefinitionsForReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Update a definition's review status and optionally correct its values.
 * Stores original values when corrections are made.
 */
export async function updateDefinitionReview(
  id: number,
  update: {
    reviewStatus: 'confirmed' | 'corrected' | 'false_positive';
    reviewerName: string;
    justificationNotes?: string;
    teamNotes?: string;
    // Editable fields (only included if being corrected)
    term?: string;
    isVerbatim?: boolean;
    verbatimText?: string;
    rephrasedDefinition?: string | null;
    scope?: string | null;
    scopeLevel?: string | null;
    scopeDocumentId?: number | null;
    definitionType?: string;
    isCrossReference?: boolean;
  }
): Promise<ActionResult<Definition | undefined>> {
  try {
    const result = await definitionsRepo.updateDefinitionReview(id, update);
    return success(result);
  } catch (error) {
    console.error('[updateDefinitionReview]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Bulk update review status for multiple definitions (confirm or mark as false positive)
 */
export async function bulkUpdateDefinitionReviewStatus(
  ids: number[],
  reviewStatus: 'confirmed' | 'false_positive',
  reviewerName: string,
  justificationNotes?: string
): Promise<ActionResult<number>> {
  try {
    const count = await definitionsRepo.bulkUpdateReviewStatus(
      ids,
      reviewStatus,
      reviewerName,
      justificationNotes
    );
    return success(count);
  } catch (error) {
    console.error('[bulkUpdateDefinitionReviewStatus]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Search regulatory documents for scope document typeahead
 */
export async function searchDocumentsForScope(
  query: string,
  state: StateCode,
  limit: number = 10
): Promise<ActionResult<{
  id: number;
  title: string | null;
  hierarchyLevel: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
}[]>> {
  try {
    const results = await definitionsRepo.searchDocumentsForScope(query, state, limit);
    return success(results);
  } catch (error) {
    console.error('[searchDocumentsForScope]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get ancestor documents for typeahead defaults
 */
export async function getAncestorDocumentsForScope(
  documentId: number
): Promise<ActionResult<{
  id: number;
  title: string | null;
  hierarchyLevel: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
}[]>> {
  try {
    const results = await definitionsRepo.getAncestorDocuments(documentId);
    return success(results);
  } catch (error) {
    console.error('[getAncestorDocumentsForScope]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get review statistics for the definitions review dashboard
 */
export async function getDefinitionReviewStats(
  state: StateCode
): Promise<ActionResult<{
  unreviewed: number;
  confirmed: number;
  corrected: number;
  falsePositive: number;
  total: number;
}>> {
  try {
    const stats = await definitionsRepo.getReviewStats(state);
    return success(stats);
  } catch (error) {
    console.error('[getDefinitionReviewStats]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get corrected definitions for developer review queue
 */
export async function getCorrectedDefinitions(
  state: StateCode,
  page: number = 1,
  pageSize: number = 20
): Promise<ActionResult<{
  data: DefinitionWithContext[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>> {
  try {
    const result = await definitionsRepo.getCorrectedDefinitions(state, page, pageSize);
    return success(result);
  } catch (error) {
    console.error('[getCorrectedDefinitions]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get a single document by ID for the scope document typeahead
 */
export async function getDocumentForScope(
  documentId: number
): Promise<ActionResult<{
  id: number;
  title: string | null;
  hierarchyLevel: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
} | null>> {
  try {
    const result = await definitionsRepo.getDocumentById(documentId);
    return success(result);
  } catch (error) {
    console.error('[getDocumentForScope]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get unique scope text values for filter dropdown
 */
export async function getUniqueScopeTexts(
  state: StateCode
): Promise<ActionResult<string[]>> {
  try {
    const result = await definitionsRepo.getUniqueScopeTexts(state);
    return success(result);
  } catch (error) {
    console.error('[getUniqueScopeTexts]', error);
    return failure(getErrorMessage(error));
  }
}
