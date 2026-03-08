'use server';

import 'server-only';
import type { JurisdictionCode, RedFlagFilterOptions } from '@deproceduralizer/database';
import {
  getRedFlagsPaginated,
  getRedFlagStatusCounts,
  getRedFlagCategories,
} from './red-flags';
import {
  getComplianceIssuesPaginated,
  getComplianceIssueStatusCounts,
  getComplianceIssueTypes,
  getComplianceSuggestionBatch,
  getGuidanceComplianceIssueStatusCounts,
  type GuidanceStatusCounts,
  type SuggestionBatchResult,
} from './compliance-issues';
import {
  getCombinedDeveloperStatusCounts,
  getCombinedReviewedItems,
  getNeedMoreInfoItems,
  getNeedMoreInfoCounts,
  getRedFlagDeveloperStatusCounts,
  getComplianceIssueDeveloperStatusCounts,
  getRedFlagDeveloperItems,
  getComplianceIssueDeveloperItems,
  type RedFlagDeveloperQueueParams,
  type ComplianceDeveloperQueueParams,
} from './developer';
import {
  getDefinitionReviewStats,
  getDefinitionDeveloperStatusCounts,
} from './definitions';
import {
  getJenAIStatusCounts,
  getJenAIDeveloperStatusCounts,
} from './jenai';
import { type ActionResult, success, failure } from './types';

// ============================================
// Types
// ============================================

export interface TabCounts {
  flags: number;
  compliance: number;
  definitions: number;
  needs_info: number;
  jenai: number;
  guidance: number;
}

export interface DeveloperModeCountsData {
  tabCounts: TabCounts;
  developerStatusCounts: Awaited<ReturnType<typeof getCombinedDeveloperStatusCounts>> extends ActionResult<infer T> ? T : never;
  redFlagDeveloperStatusCounts: Awaited<ReturnType<typeof getRedFlagDeveloperStatusCounts>> extends ActionResult<infer T> ? T : never;
  complianceDeveloperStatusCounts: Awaited<ReturnType<typeof getComplianceIssueDeveloperStatusCounts>> extends ActionResult<infer T> ? T : never;
  needsInfoCounts: Awaited<ReturnType<typeof getNeedMoreInfoCounts>> extends ActionResult<infer T> ? T : never;
  guidanceStatusCounts: GuidanceStatusCounts;
}

export type { GuidanceStatusCounts };

export interface ReviewModeCountsData {
  tabCounts: TabCounts;
  flagStatusCounts: Awaited<ReturnType<typeof getRedFlagStatusCounts>> extends ActionResult<infer T> ? T : never;
  complianceStatusCounts: Awaited<ReturnType<typeof getComplianceIssueStatusCounts>> extends ActionResult<infer T> ? T : never;
  definitionsStats: Awaited<ReturnType<typeof getDefinitionReviewStats>> extends ActionResult<infer T> ? T : never;
  needsInfoCounts: Awaited<ReturnType<typeof getNeedMoreInfoCounts>> extends ActionResult<infer T> ? T : never;
  guidanceStatusCounts: GuidanceStatusCounts;
}

// ============================================
// Developer Mode Data Fetching
// ============================================

/**
 * Fetch all counts needed for developer mode tabs
 */
export async function getDeveloperModeCountsData(
  stateCode: JurisdictionCode
): Promise<ActionResult<DeveloperModeCountsData>> {
  const [
    developerStatusCountsResult,
    redFlagDevCountsResult,
    complianceDevCountsResult,
    needsInfoCountsResult,
    definitionDevCountsResult,
    jenaiDevCountsResult,
    guidanceCountsResult,
  ] = await Promise.all([
    getCombinedDeveloperStatusCounts(stateCode),
    getRedFlagDeveloperStatusCounts(stateCode),
    getComplianceIssueDeveloperStatusCounts(stateCode),
    getNeedMoreInfoCounts(stateCode),
    getDefinitionDeveloperStatusCounts(stateCode),
    getJenAIDeveloperStatusCounts(stateCode),
    getGuidanceComplianceIssueStatusCounts(stateCode),
  ]);

  if (!developerStatusCountsResult.success) {
    return failure(`Failed to load developer status counts: ${developerStatusCountsResult.error}`);
  }

  if (!redFlagDevCountsResult.success) {
    return failure(`Failed to load red flag developer status counts: ${redFlagDevCountsResult.error}`);
  }

  if (!complianceDevCountsResult.success) {
    return failure(`Failed to load compliance developer status counts: ${complianceDevCountsResult.error}`);
  }

  if (!needsInfoCountsResult.success) {
    return failure(`Failed to load needs info counts: ${needsInfoCountsResult.error}`);
  }

  const developerStatusCounts = developerStatusCountsResult.data;
  const redFlagDeveloperStatusCounts = redFlagDevCountsResult.data;
  const complianceDeveloperStatusCounts = complianceDevCountsResult.data;
  const needsInfoCounts = needsInfoCountsResult.data;
  const definitionDevCounts = definitionDevCountsResult.success
    ? definitionDevCountsResult.data
    : { total: 0 };
  const jenaiDevCounts = jenaiDevCountsResult.success
    ? jenaiDevCountsResult.data
    : { total: 0 };
  const guidanceStatusCounts: GuidanceStatusCounts = guidanceCountsResult.success
    ? guidanceCountsResult.data
    : { total: 0, unreviewed: 0, reviewed: 0, dismissed: 0 };

  const tabCounts: TabCounts = {
    flags: redFlagDeveloperStatusCounts.total,
    compliance: complianceDeveloperStatusCounts.total,
    definitions: definitionDevCounts.total,
    needs_info: needsInfoCounts.combined.total,
    jenai: jenaiDevCounts.total,
    guidance: guidanceStatusCounts.total,
  };

  return success({
    tabCounts,
    developerStatusCounts,
    redFlagDeveloperStatusCounts,
    complianceDeveloperStatusCounts,
    needsInfoCounts,
    guidanceStatusCounts,
  });
}

/**
 * Fetch developer queue items (combined red flags + compliance issues)
 */
export async function getDeveloperQueueData(
  stateCode: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortOrder: 'asc' | 'desc';
    developerStatus?: string;
    developerAssigned?: string;
  }
) {
  return getCombinedReviewedItems(stateCode, options);
}

/**
 * Fetch red flag developer queue data with filters
 */
export async function getRedFlagDeveloperQueueData(
  stateCode: JurisdictionCode,
  params: RedFlagDeveloperQueueParams
) {
  const [itemsResult, categoriesResult] = await Promise.all([
    getRedFlagDeveloperItems(stateCode, params),
    getRedFlagCategories(stateCode),
  ]);

  if (!itemsResult.success) {
    return failure(`Failed to load red flag developer items: ${itemsResult.error}`);
  }

  if (!categoriesResult.success) {
    return failure(`Failed to load categories: ${categoriesResult.error}`);
  }

  return success({
    items: itemsResult.data,
    categories: categoriesResult.data,
  });
}

/**
 * Fetch compliance issue developer queue data with filters
 */
export async function getComplianceDeveloperQueueData(
  stateCode: JurisdictionCode,
  params: ComplianceDeveloperQueueParams
) {
  const [itemsResult, issueTypesResult] = await Promise.all([
    getComplianceIssueDeveloperItems(stateCode, params),
    getComplianceIssueTypes(stateCode),
  ]);

  if (!itemsResult.success) {
    return failure(`Failed to load compliance developer items: ${itemsResult.error}`);
  }

  if (!issueTypesResult.success) {
    return failure(`Failed to load issue types: ${issueTypesResult.error}`);
  }

  return success({
    items: itemsResult.data,
    issueTypes: issueTypesResult.data,
  });
}

// ============================================
// Review Mode Data Fetching
// ============================================

/**
 * Fetch all counts needed for review mode tabs
 */
export async function getReviewModeCountsData(
  stateCode: JurisdictionCode
): Promise<ActionResult<ReviewModeCountsData>> {
  const [
    flagStatusCountsResult,
    complianceStatusCountsResult,
    definitionsStatsResult,
    needsInfoCountsResult,
    jenaiStatusCountsResult,
    guidanceStatusCountsResult,
  ] = await Promise.all([
    getRedFlagStatusCounts(stateCode),
    getComplianceIssueStatusCounts(stateCode),
    getDefinitionReviewStats(stateCode),
    getNeedMoreInfoCounts(stateCode),
    getJenAIStatusCounts(stateCode),
    getGuidanceComplianceIssueStatusCounts(stateCode),
  ]);

  if (!flagStatusCountsResult.success) {
    return failure(`Failed to load red flag status counts: ${flagStatusCountsResult.error}`);
  }

  if (!complianceStatusCountsResult.success) {
    return failure(`Failed to load compliance issue status counts: ${complianceStatusCountsResult.error}`);
  }

  if (!definitionsStatsResult.success) {
    return failure(`Failed to load definitions counts: ${definitionsStatsResult.error}`);
  }

  if (!needsInfoCountsResult.success) {
    return failure(`Failed to load needs info counts: ${needsInfoCountsResult.error}`);
  }

  const flagStatusCounts = flagStatusCountsResult.data;
  const complianceStatusCounts = complianceStatusCountsResult.data;
  const definitionsStats = definitionsStatsResult.data;
  const needsInfoCounts = needsInfoCountsResult.data;
  const jenaiStatusCounts = jenaiStatusCountsResult.success ? jenaiStatusCountsResult.data : { total: 0 };
  const guidanceStatusCounts: GuidanceStatusCounts = guidanceStatusCountsResult.success
    ? guidanceStatusCountsResult.data
    : { total: 0, unreviewed: 0, reviewed: 0, dismissed: 0 };

  const tabCounts: TabCounts = {
    flags: flagStatusCounts.total,
    compliance: complianceStatusCounts.total,
    definitions: definitionsStats.total,
    needs_info: needsInfoCounts.combined.total,
    jenai: jenaiStatusCounts.total,
    guidance: guidanceStatusCounts.total,
  };

  return success({
    tabCounts,
    flagStatusCounts,
    complianceStatusCounts,
    definitionsStats,
    needsInfoCounts,
    guidanceStatusCounts,
  });
}

/**
 * Fetch red flags queue data
 */
export async function getRedFlagsQueueData(
  stateCode: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy: 'severity' | 'category' | 'reviewedAt';
    sortOrder: 'asc' | 'desc';
    filters: Omit<RedFlagFilterOptions, 'jurisdiction'>;
  }
) {
  const [flagsResult, categoriesResult] = await Promise.all([
    getRedFlagsPaginated(stateCode, {
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      filters: options.filters,
    }),
    getRedFlagCategories(stateCode),
  ]);

  if (!flagsResult.success) {
    return failure(`Failed to load red flags: ${flagsResult.error}`);
  }

  if (!categoriesResult.success) {
    return failure(`Failed to load categories: ${categoriesResult.error}`);
  }

  return success({
    flags: flagsResult.data,
    categories: categoriesResult.data,
  });
}

/**
 * Fetch compliance issues queue data
 */
export async function getComplianceQueueData(
  stateCode: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy: 'issueType' | 'createdAt' | 'reviewedAt' | 'severity';
    sortOrder: 'asc' | 'desc';
    filters: {
      status?: string;
      issueType?: string;
      severity?: 'high' | 'medium' | 'low' | 'all';
      requiredByStatute?: boolean | 'all';
      requirementFound?: boolean | 'all';
      tierCompleted?: '0' | '1' | '2' | '3' | 'all';
      federalMandate?: boolean | 'all';
      hasAnalysis?: boolean | 'all';
    };
  }
) {
  const [issuesResult, issueTypesResult] = await Promise.all([
    getComplianceIssuesPaginated(stateCode, {
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      filters: options.filters,
    }),
    getComplianceIssueTypes(stateCode),
  ]);

  if (!issuesResult.success) {
    return failure(`Failed to load compliance issues: ${issuesResult.error}`);
  }

  if (!issueTypesResult.success) {
    return failure(`Failed to load issue types: ${issueTypesResult.error}`);
  }

  return success({
    issues: issuesResult.data,
    issueTypes: issueTypesResult.data,
  });
}

/**
 * Fetch needs more info items
 */
export async function getNeedsInfoQueueData(
  stateCode: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
  }
) {
  return getNeedMoreInfoItems(stateCode, options);
}

// ============================================
// Suggestion Mode Data Fetching
// ============================================

export interface SuggestionQueueParams {
  batchSize: number;
  excludeIds: number[];
  groupingMode: 'issue_type' | 'section' | 'combined';
  focus?: {
    issueType?: string;
    section?: string;
    pattern?: string;
  };
}

/**
 * Fetch compliance issues for suggestion mode with smart grouping.
 * Also fetches issue types for display purposes.
 */
export async function getComplianceSuggestionQueueData(
  stateCode: JurisdictionCode,
  params: SuggestionQueueParams
): Promise<ActionResult<{
  batch: SuggestionBatchResult;
  issueTypes: string[];
}>> {
  const [batchResult, issueTypesResult] = await Promise.all([
    getComplianceSuggestionBatch(stateCode, {
      batchSize: params.batchSize,
      excludeIds: params.excludeIds,
      groupingMode: params.groupingMode,
      focus: params.focus,
    }),
    getComplianceIssueTypes(stateCode),
  ]);

  if (!batchResult.success) {
    return failure(`Failed to load suggestion batch: ${batchResult.error}`);
  }

  if (!issueTypesResult.success) {
    return failure(`Failed to load issue types: ${issueTypesResult.error}`);
  }

  return success({
    batch: batchResult.data,
    issueTypes: issueTypesResult.data,
  });
}
