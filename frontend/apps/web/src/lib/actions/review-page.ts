'use server';

import 'server-only';
import type { JurisdictionCode } from '@deproceduralizer/database';
import {
  getComplianceIssuesPaginated,
  getComplianceIssueStatusCounts,
  getComplianceIssueTypes,
  getComplianceSuggestionBatch,
  type SuggestionBatchResult,
} from './compliance-issues';
import {
  getCombinedDeveloperStatusCounts,
  getCombinedReviewedItems,
  getNeedMoreInfoItems,
  getNeedMoreInfoCounts,
  getComplianceIssueDeveloperStatusCounts,
  getComplianceIssueDeveloperItems,
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
  compliance: number;
  definitions: number;
  needs_info: number;
  jenai: number;
}

export interface DeveloperModeCountsData {
  tabCounts: TabCounts;
  developerStatusCounts: Awaited<ReturnType<typeof getCombinedDeveloperStatusCounts>> extends ActionResult<infer T> ? T : never;
  complianceDeveloperStatusCounts: Awaited<ReturnType<typeof getComplianceIssueDeveloperStatusCounts>> extends ActionResult<infer T> ? T : never;
  needsInfoCounts: Awaited<ReturnType<typeof getNeedMoreInfoCounts>> extends ActionResult<infer T> ? T : never;
}

export interface ReviewModeCountsData {
  tabCounts: TabCounts;
  complianceStatusCounts: Awaited<ReturnType<typeof getComplianceIssueStatusCounts>> extends ActionResult<infer T> ? T : never;
  definitionsStats: Awaited<ReturnType<typeof getDefinitionReviewStats>> extends ActionResult<infer T> ? T : never;
  needsInfoCounts: Awaited<ReturnType<typeof getNeedMoreInfoCounts>> extends ActionResult<infer T> ? T : never;
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
    complianceDevCountsResult,
    needsInfoCountsResult,
    definitionDevCountsResult,
    jenaiDevCountsResult,
  ] = await Promise.all([
    getCombinedDeveloperStatusCounts(stateCode),
    getComplianceIssueDeveloperStatusCounts(stateCode),
    getNeedMoreInfoCounts(stateCode),
    getDefinitionDeveloperStatusCounts(stateCode),
    getJenAIDeveloperStatusCounts(stateCode),
  ]);

  if (!developerStatusCountsResult.success) {
    return failure(`Failed to load developer status counts: ${developerStatusCountsResult.error}`);
  }

  if (!complianceDevCountsResult.success) {
    return failure(`Failed to load compliance developer status counts: ${complianceDevCountsResult.error}`);
  }

  if (!needsInfoCountsResult.success) {
    return failure(`Failed to load needs info counts: ${needsInfoCountsResult.error}`);
  }

  const developerStatusCounts = developerStatusCountsResult.data;
  const complianceDeveloperStatusCounts = complianceDevCountsResult.data;
  const needsInfoCounts = needsInfoCountsResult.data;
  const definitionDevCounts = definitionDevCountsResult.success
    ? definitionDevCountsResult.data
    : { total: 0 };
  const jenaiDevCounts = jenaiDevCountsResult.success
    ? jenaiDevCountsResult.data
    : { total: 0 };

  const tabCounts: TabCounts = {
    compliance: complianceDeveloperStatusCounts.total,
    definitions: definitionDevCounts.total,
    needs_info: needsInfoCounts.combined.total,
    jenai: jenaiDevCounts.total,
  };

  return success({
    tabCounts,
    developerStatusCounts,
    complianceDeveloperStatusCounts,
    needsInfoCounts,
  });
}

/**
 * Fetch developer queue items (compliance issues)
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
  stateCode: JurisdictionCode,
  options?: { source?: 'regulation' | 'guidance' | 'all' }
): Promise<ActionResult<ReviewModeCountsData>> {
  const [
    complianceStatusCountsResult,
    definitionsStatsResult,
    needsInfoCountsResult,
    jenaiStatusCountsResult,
  ] = await Promise.all([
    getComplianceIssueStatusCounts(stateCode, { source: options?.source }),
    getDefinitionReviewStats(stateCode),
    getNeedMoreInfoCounts(stateCode),
    getJenAIStatusCounts(stateCode),
  ]);

  if (!complianceStatusCountsResult.success) {
    return failure(`Failed to load compliance issue status counts: ${complianceStatusCountsResult.error}`);
  }

  if (!definitionsStatsResult.success) {
    return failure(`Failed to load definitions counts: ${definitionsStatsResult.error}`);
  }

  if (!needsInfoCountsResult.success) {
    return failure(`Failed to load needs info counts: ${needsInfoCountsResult.error}`);
  }

  const complianceStatusCounts = complianceStatusCountsResult.data;
  const definitionsStats = definitionsStatsResult.data;
  const needsInfoCounts = needsInfoCountsResult.data;
  const jenaiStatusCounts = jenaiStatusCountsResult.success ? jenaiStatusCountsResult.data : { total: 0 };

  const tabCounts: TabCounts = {
    compliance: complianceStatusCounts.total,
    definitions: definitionsStats.total,
    needs_info: needsInfoCounts.combined.total,
    jenai: jenaiStatusCounts.total,
  };

  return success({
    tabCounts,
    complianceStatusCounts,
    definitionsStats,
    needsInfoCounts,
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
      source?: 'regulation' | 'guidance' | 'all';
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
