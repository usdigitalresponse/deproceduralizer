'use server';

import 'server-only';
import {
  db,
  DefinitionsRepository,
  type Definition,
  type DefinitionWithContext,
  type ApplicableDefinition,
  type SplitApplicableDefinitions,
  type DefinitionsWithContext,
  type PaginatedDefinitionsResult,
  type PaginatedAggregatedResult,
  type DefinitionStats,
  type AlphabeticalIndex,
  type StateCode,
  type DefinitionDeveloperStatusCounts,
  type DeveloperStatus,
  type Developer,
  type ResolutionType,
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS,
} from '@deproceduralizer/database';
import { revalidatePath } from 'next/cache';
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
 * Get applicable definitions split into current document vs ancestors.
 * This replaces the need for separate getDefinitionsForDocument + getApplicableDefinitionsForDocument calls.
 */
export async function getApplicableDefinitionsForDocumentSplit(
  documentId: number
): Promise<ActionResult<SplitApplicableDefinitions>> {
  try {
    const definitions = await definitionsRepo.getApplicableDefinitionsSplit(documentId);
    return success(definitions);
  } catch (error) {
    console.error('[getApplicableDefinitionsForDocumentSplit]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get definitions with full context for a document.
 *
 * Distinguishes between:
 * - usedInText.definedHere: Terms that appear in text and are defined in this document
 * - usedInText.inherited: Terms that appear in text and are inherited from ancestor scope
 * - availableButNotUsed: Terms that are in scope but don't appear in the document text
 */
export async function getDefinitionsWithContext(
  documentId: number
): Promise<ActionResult<DefinitionsWithContext>> {
  try {
    const data = await definitionsRepo.getDefinitionsWithContext(documentId);
    return success(data);
  } catch (error) {
    console.error('[getDefinitionsWithContext]', error);
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
    inDefinitionsSection?: boolean;
    scopeText?: string;
    scopeRelation?: 'self' | 'parent';
    scopeMismatch?: boolean;
    termSearch?: string;
    definitionId?: number;
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

// ============================================================================
// Definition Developer Tracking Actions
// ============================================================================

export interface UpdateDefinitionDeveloperStatusInput {
  id: number;
  developerStatus: string;
  developerAssigned: string;
  developerNotes?: string;
  resolutionType?: string;
  resolutionComments?: string;
  developerQuestion?: string;
}

/**
 * Update developer status for a definition
 */
export async function updateDefinitionDeveloperStatus(
  input: UpdateDefinitionDeveloperStatusInput
): Promise<ActionResult<Definition>> {
  try {
    // Validate developer status
    if (!DEVELOPER_STATUSES.includes(input.developerStatus as DeveloperStatus)) {
      return failure(`Invalid developer status: ${input.developerStatus}`);
    }

    // Validate developer assignment
    if (!DEVELOPERS.includes(input.developerAssigned as Developer)) {
      return failure(`Invalid developer: ${input.developerAssigned}`);
    }

    // Validate resolution type if provided
    if (input.resolutionType && !RESOLUTION_TYPES.includes(input.resolutionType as ResolutionType)) {
      return failure(`Invalid resolution type: ${input.resolutionType}`);
    }

    const result = await definitionsRepo.updateDeveloperStatus(input.id, {
      developerStatus: input.developerStatus as DeveloperStatus,
      developerAssigned: input.developerAssigned as Developer,
      developerNotes: input.developerNotes,
      resolutionType: input.resolutionType as ResolutionType | undefined,
      resolutionComments: input.resolutionComments,
      developerQuestion: input.developerQuestion,
    });

    if (!result) {
      return failure(`Definition with id ${input.id} not found`);
    }

    revalidatePath('/');
    return success(result);
  } catch (error) {
    console.error('[updateDefinitionDeveloperStatus]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get developer status counts for definitions
 */
export async function getDefinitionDeveloperStatusCounts(
  state: StateCode
): Promise<ActionResult<DefinitionDeveloperStatusCounts>> {
  try {
    const counts = await definitionsRepo.getDeveloperStatusCounts(state);
    return success(counts);
  } catch (error) {
    console.error('[getDefinitionDeveloperStatusCounts]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get reviewed definitions for developer mode with pagination and filters
 */
export async function getReviewedDefinitionsPaginated(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    developerStatus?: string;
    developerAssigned?: string;
    reviewStatus?: string;
    hasJustification?: string;
    hasTeamNotes?: string;
    sortBy?: 'reviewedAt' | 'term' | 'developerCheckedAt';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<ActionResult<PaginatedDefinitionsResult>> {
  try {
    const result = await definitionsRepo.getReviewedDefinitionsPaginated({
      state,
      page: options.page,
      pageSize: options.pageSize,
      developerStatus: options.developerStatus as DeveloperStatus | 'all' | undefined,
      developerAssigned: options.developerAssigned as Developer | undefined,
      reviewStatus: options.reviewStatus as 'confirmed' | 'corrected' | 'false_positive' | 'all' | undefined,
      hasJustification: options.hasJustification as 'yes' | 'no' | 'all' | undefined,
      hasTeamNotes: options.hasTeamNotes as 'yes' | 'no' | 'all' | undefined,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
    return success(result);
  } catch (error) {
    console.error('[getReviewedDefinitionsPaginated]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get definitions that need more info from developers
 */
export async function getNeedMoreInfoDefinitions(
  state: StateCode,
  options: {
    page: number;
    pageSize: number;
    reviewerName?: string;
  }
): Promise<ActionResult<PaginatedDefinitionsResult>> {
  try {
    const result = await definitionsRepo.getNeedMoreInfoDefinitions(state, options);
    return success(result);
  } catch (error) {
    console.error('[getNeedMoreInfoDefinitions]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Get counts of definitions that need more info
 */
export async function getDefinitionNeedMoreInfoCount(
  state: StateCode,
  reviewerName?: string
): Promise<ActionResult<{ total: number; forReviewer: number }>> {
  try {
    const counts = await definitionsRepo.getNeedMoreInfoCount(state, reviewerName);
    return success(counts);
  } catch (error) {
    console.error('[getDefinitionNeedMoreInfoCount]', error);
    return failure(getErrorMessage(error));
  }
}
