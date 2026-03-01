'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { db, RegulatoryDocumentsRepository, regulatoryDocuments, eq, and, desc, type RegulationWithAnalysis, type PaginationOptions, type FilterOptions, type JurisdictionCode, type PaginatedResult, type ComplianceIssueWithAnalysisFields, type DefinitionWithContext, type DocumentNote } from '@deproceduralizer/database';
import { type ActionResult, success, failure, getErrorMessage, runAction, runCachedAction } from './types';
import { getComplianceIssuesByDocumentId } from './compliance-issues';
import { getApplicableDefinitionsForDocument } from './definitions';
import { getNotesByDocumentId } from './document-notes';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

/**
 * Fetches a regulation with its current analysis by ID.
 * @param id - The regulatory document ID
 * @returns The regulation with analysis data or null if not found
 */
export async function getRegulationById(
  id: number
): Promise<ActionResult<RegulationWithAnalysis | null>> {
  return runAction('getRegulationById', () => regulationsRepo.getByIdWithAnalysis(id));
}

/**
 * Fetches paginated regulations with analysis data.
 * @param options - Pagination and filter options including state
 * @returns Paginated result with regulations
 */
export async function getRegulationsPaginated(
  options: PaginationOptions & { filters?: FilterOptions }
): Promise<ActionResult<PaginatedResult<RegulationWithAnalysis>>> {
  return runAction('getRegulationsPaginated', () => regulationsRepo.getAllWithAnalysisPaginated(options));
}

// ============================================================================
// Analysis Exclusion Actions
// ============================================================================

export interface SetExclusionInput {
  documentId: number;
  exclude: boolean;
  excludedBy: string;
  reason?: string;
}

export interface ExcludedDocument {
  id: number;
  title: string;
  hierarchyLevel: string | null;
  excludedAt: Date | null;
  excludedBy: string | null;
  excludedReason: string | null;
  jurisdiction: string | null;
}

/**
 * Sets or removes the exclude_from_analysis flag for a document.
 */
export async function setDocumentExclusion(
  input: SetExclusionInput
): Promise<ActionResult<{ id: number; excludeFromAnalysis: boolean }>> {
  try {
    const now = input.exclude ? new Date() : null;

    await db
      .update(regulatoryDocuments)
      .set({
        excludeFromAnalysis: input.exclude,
        excludedAt: now,
        excludedBy: input.exclude ? input.excludedBy : null,
        excludedReason: input.exclude ? (input.reason || null) : null,
      })
      .where(eq(regulatoryDocuments.id, input.documentId));

    // Revalidate the detail page for this document
    revalidatePath(`/`);

    return success({
      id: input.documentId,
      excludeFromAnalysis: input.exclude,
    });
  } catch (error) {
    console.error('[setDocumentExclusion]', error);
    return failure(getErrorMessage(error));
  }
}

/**
 * Fetches all documents marked as excluded from analysis for a given state.
 */
export async function getExcludedDocuments(
  state: string
): Promise<ActionResult<ExcludedDocument[]>> {
  return runAction('getExcludedDocuments', () =>
    db
      .select({
        id: regulatoryDocuments.id,
        title: regulatoryDocuments.title,
        hierarchyLevel: regulatoryDocuments.hierarchyLevel,
        excludedAt: regulatoryDocuments.excludedAt,
        excludedBy: regulatoryDocuments.excludedBy,
        excludedReason: regulatoryDocuments.excludedReason,
        jurisdiction: regulatoryDocuments.jurisdiction,
      })
      .from(regulatoryDocuments)
      .where(
        and(
          eq(regulatoryDocuments.jurisdiction, state.toUpperCase()),
          eq(regulatoryDocuments.excludeFromAnalysis, true)
        )
      )
      .orderBy(desc(regulatoryDocuments.excludedAt))
  );
}

// ============================================================================
// Regulation Detail Bundle Action
// ============================================================================

/**
 * Options for fetching regulation detail bundle.
 */
export interface BundleOptions {
  /** Include applicable definitions for the document */
  includeDefinitions?: boolean;
  /** Include document notes/annotations */
  includeNotes?: boolean;
  /** Include compliance issues for the document */
  includeComplianceIssues?: boolean;
  /** Include full content (false = truncated preview for panel/modal views) */
  includeContent?: boolean;
}

/**
 * Result from regulation detail bundle.
 * Uses partial success pattern - optional data can fail independently.
 */
export interface BundleResult {
  regulation: RegulationWithAnalysis | null;
  complianceIssues?: ComplianceIssueWithAnalysisFields[];
  definitions?: DefinitionWithContext[];
  notes?: DocumentNote[];
  /** Section-level errors for optional data that failed to load */
  errors: {
    complianceIssues?: string;
    definitions?: string;
    notes?: string;
  };
}

/**
 * Content preview length for truncated views (panel/modal)
 */
const CONTENT_PREVIEW_LENGTH = 500;

/**
 * Fetches a regulation with optional related data in a single action.
 * Uses Promise.allSettled for partial success - the regulation is required,
 * but optional data (definitions, notes, compliance issues) can fail
 * independently without blocking the entire response.
 *
 * @param id - The regulatory document ID
 * @param options - What optional data to include
 * @returns Bundle with regulation, optional data, and any section-level errors
 */
export async function getRegulationDetailBundle(
  id: number,
  options: BundleOptions = {}
): Promise<ActionResult<BundleResult>> {
  const {
    includeDefinitions = false,
    includeNotes = false,
    includeComplianceIssues = false,
    includeContent = true,
  } = options;

  // Regulation is required - fail fast if it fails
  const regResult = await getRegulationById(id);
  if (!regResult.success) {
    return failure(regResult.error);
  }

  const regulation = regResult.data;
  if (!regulation) {
    return success({ regulation: null, errors: {} });
  }

  // Fetch optional data in parallel using Promise.allSettled for partial success
  const optionalFetches = await Promise.allSettled([
    includeComplianceIssues ? getComplianceIssuesByDocumentId(id) : Promise.resolve({ success: true, data: undefined }),
    includeDefinitions ? getApplicableDefinitionsForDocument(id) : Promise.resolve({ success: true, data: undefined }),
    includeNotes ? getNotesByDocumentId(id) : Promise.resolve({ success: true, data: undefined }),
  ]);

  const [complianceResult, definitionsResult, notesResult] = optionalFetches;
  const errors: BundleResult['errors'] = {};

  // Process compliance issues result
  let complianceIssues: ComplianceIssueWithAnalysisFields[] | undefined;
  if (complianceResult.status === 'fulfilled') {
    const result = complianceResult.value as ActionResult<ComplianceIssueWithAnalysisFields[] | undefined>;
    if (result.success && result.data) {
      complianceIssues = result.data;
    } else if (!result.success) {
      errors.complianceIssues = result.error;
    }
  } else {
    errors.complianceIssues = complianceResult.reason?.message || 'Failed to load compliance issues';
  }

  // Process definitions result
  let definitions: DefinitionWithContext[] | undefined;
  if (definitionsResult.status === 'fulfilled') {
    const result = definitionsResult.value as ActionResult<DefinitionWithContext[] | undefined>;
    if (result.success && result.data) {
      definitions = result.data;
    } else if (!result.success) {
      errors.definitions = result.error;
    }
  } else {
    errors.definitions = definitionsResult.reason?.message || 'Failed to load definitions';
  }

  // Process notes result
  let notes: DocumentNote[] | undefined;
  if (notesResult.status === 'fulfilled') {
    const result = notesResult.value as ActionResult<DocumentNote[] | undefined>;
    if (result.success && result.data) {
      notes = result.data;
    } else if (!result.success) {
      errors.notes = result.error;
    }
  } else {
    errors.notes = notesResult.reason?.message || 'Failed to load notes';
  }

  // Optionally truncate content for panel/modal views
  const finalRegulation: RegulationWithAnalysis = includeContent
    ? regulation
    : {
        ...regulation,
        content: regulation.content && regulation.content.length > CONTENT_PREVIEW_LENGTH
          ? regulation.content.slice(0, CONTENT_PREVIEW_LENGTH) + '...'
          : regulation.content,
      };

  return success({
    regulation: finalRegulation,
    complianceIssues,
    definitions,
    notes,
    errors,
  });
}

// ============================================================================
// Summary Metadata Actions
// ============================================================================

export interface SectionTypeStats {
  sectionType: string;
  count: number;
}

export interface MetadataStats {
  withSummary: number;
  withForm: number;
  withIbr: number;
  total: number;
  bySectionType: Record<string, number>;
}

export interface KeywordStats {
  keyword: string;
  count: number;
}

export interface AppliesToStats {
  entity: string;
  count: number;
}

/**
 * Gets section type distribution stats for a state.
 * Cached for 60 seconds to reduce database load.
 */
export async function getSectionTypeStats(
  state: string
): Promise<ActionResult<SectionTypeStats[]>> {
  return runCachedAction(
    'getSectionTypeStats',
    () => regulationsRepo.getSectionTypeStats(state as JurisdictionCode),
    [`section-type-stats-${state}`],
    { revalidate: 60, tags: ['analytics'] }
  );
}

/**
 * Gets overall metadata statistics for a state (counts of documents with summaries, forms, IBR).
 * Cached for 60 seconds to reduce database load.
 */
export async function getMetadataStats(
  state: string
): Promise<ActionResult<MetadataStats>> {
  return runCachedAction(
    'getMetadataStats',
    () => regulationsRepo.getMetadataStats(state as JurisdictionCode),
    [`metadata-stats-${state}`],
    { revalidate: 60, tags: ['analytics'] }
  );
}

/**
 * Gets top keywords across all documents for a state.
 * Cached for 60 seconds to reduce database load.
 */
export async function getTopKeywords(
  state: string,
  limit: number = 20
): Promise<ActionResult<KeywordStats[]>> {
  return runCachedAction(
    'getTopKeywords',
    () => regulationsRepo.getTopKeywords(state as JurisdictionCode, limit),
    [`top-keywords-${state}-${limit}`],
    { revalidate: 60, tags: ['analytics'] }
  );
}

/**
 * Gets top "applies to" entities across all documents for a state.
 * Cached for 60 seconds to reduce database load.
 */
export async function getTopAppliesTo(
  state: string,
  limit: number = 20
): Promise<ActionResult<AppliesToStats[]>> {
  return runCachedAction(
    'getTopAppliesTo',
    () => regulationsRepo.getTopAppliesTo(state as JurisdictionCode, limit),
    [`top-applies-to-${state}-${limit}`],
    { revalidate: 60, tags: ['analytics'] }
  );
}
