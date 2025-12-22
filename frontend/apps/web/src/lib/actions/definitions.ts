'use server';

import {
  db,
  DefinitionsRepository,
  type Definition,
  type DefinitionWithContext,
  type ApplicableDefinition,
  type PaginatedDefinitionsResult,
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
