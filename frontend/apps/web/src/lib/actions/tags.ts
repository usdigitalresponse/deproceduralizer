'use server';

import 'server-only';
import {
  db,
  TagsRepository,
  type JurisdictionCode,
  type TagOverviewStats,
  type TagCooccurrenceResult,
  type TagNetworkResult,
  type TagNetworkOptions,
  type TagFlowResult,
  type TagDetailResult,
  type TagReadabilityCrosscuts,
  type SimilarTag,
} from '@deproceduralizer/database';
import { type ActionResult, runAction, runCachedAction } from './types';

const tagsRepo = new TagsRepository(db);

// Re-export types for components
export type {
  TagOverviewStats,
  TagCooccurrenceResult,
  TagNetworkResult,
  TagNetworkOptions,
  TagFlowResult,
  TagDetailResult,
  TagReadabilityCrosscuts,
  SimilarTag,
};

export async function getTagOverview(
  state: JurisdictionCode,
): Promise<ActionResult<TagOverviewStats>> {
  return runCachedAction(
    'getTagOverview',
    () => tagsRepo.getTagOverview(state),
    [`tags-overview-${state}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getTagCooccurrence(
  state: JurisdictionCode,
  fieldA: string,
  fieldB: string,
): Promise<ActionResult<TagCooccurrenceResult>> {
  return runCachedAction(
    'getTagCooccurrence',
    () => tagsRepo.getTagCooccurrence(state, fieldA, fieldB),
    [`tags-cooccurrence-${state}-${fieldA}-${fieldB}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getTagNetwork(
  state: JurisdictionCode,
  options?: TagNetworkOptions,
): Promise<ActionResult<TagNetworkResult>> {
  const domainKey = options?.domains?.sort().join(',') ?? 'all';
  const fieldKey = options?.fields?.sort().join(',') ?? 'all';
  const minW = options?.minEdgeWeight ?? 0;
  const maxN = options?.maxNodes ?? 0;
  return runCachedAction(
    'getTagNetwork',
    () => tagsRepo.getTagNetwork(state, options),
    [`tags-network-${state}-${domainKey}-${fieldKey}-${minW}-${maxN}`],
    { revalidate: 600, tags: ['tags'] },
  );
}

export async function getTagFlow(
  state: JurisdictionCode,
  stages: string[],
): Promise<ActionResult<TagFlowResult>> {
  const stagesKey = stages.join(',');
  return runCachedAction(
    'getTagFlow',
    () => tagsRepo.getTagFlow(state, stages),
    [`tags-flow-${state}-${stagesKey}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

/**
 * Tag detail — uncached because contextDocumentId varies per call.
 */
export async function getTagDetail(
  state: JurisdictionCode,
  field: string,
  value: string,
  contextDocumentId?: number,
): Promise<ActionResult<TagDetailResult>> {
  return runAction('getTagDetail', () =>
    tagsRepo.getTagDetail(state, field, value, contextDocumentId),
  );
}

export async function getTagReadabilityCrosscuts(
  state: JurisdictionCode,
  field: string,
): Promise<ActionResult<TagReadabilityCrosscuts>> {
  return runCachedAction(
    'getTagReadabilityCrosscuts',
    () => tagsRepo.getTagReadabilityCrosscuts(state, field),
    [`tags-readability-${state}-${field}`],
    { revalidate: 300, tags: ['tags'] },
  );
}

export async function getSimilarTags(
  state: JurisdictionCode,
  field: string,
  value: string,
): Promise<ActionResult<SimilarTag[]>> {
  return runCachedAction(
    'getSimilarTags',
    () => tagsRepo.getSimilarTags(state, field, value),
    [`tags-similar-${state}-${field}-${value}`],
    { revalidate: 600, tags: ['tags'] },
  );
}
