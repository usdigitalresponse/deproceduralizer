import {
  parseAsString,
  parseAsInteger,
  parseAsStringEnum,
  parseAsBoolean,
} from 'nuqs';

// Review status values
export const REVIEW_STATUS_VALUES = [
  'all',
  'unreviewed',
  'confirmed',
  'false_positive',
  'needs_context',
  'deferred',
] as const;
export type ReviewStatusValue = (typeof REVIEW_STATUS_VALUES)[number];

// Developer status values
export const DEVELOPER_STATUS_VALUES = [
  'all',
  'unresolved',
  'resolved',
  'pending',
  'backlogged',
  'need_more_info',
] as const;
export type DeveloperStatusValue = (typeof DEVELOPER_STATUS_VALUES)[number];

// Severity values
export const SEVERITY_VALUES = ['all', 'high', 'medium', 'low'] as const;
export type SeverityValue = (typeof SEVERITY_VALUES)[number];

// Sort order
export const SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type SortOrderValue = (typeof SORT_ORDER_VALUES)[number];

// Review type values
export const REVIEW_TYPE_VALUES = ['flags', 'compliance', 'needs_info'] as const;
export type ReviewTypeValue = (typeof REVIEW_TYPE_VALUES)[number];

// Review mode values
export const REVIEW_MODE_VALUES = ['review', 'developer'] as const;
export type ReviewModeValue = (typeof REVIEW_MODE_VALUES)[number];

// ============================================
// Parsers
// ============================================

// Pagination parsers
export const pageParser = parseAsInteger.withDefault(1);
export const pageSizeParser = parseAsInteger.withDefault(20);

// Sort parsers
export const sortOrderParser = parseAsStringEnum([...SORT_ORDER_VALUES]).withDefault('desc');

// Review parsers
export const reviewStatusParser = parseAsStringEnum([...REVIEW_STATUS_VALUES]).withDefault('unreviewed');
export const developerStatusParser = parseAsStringEnum([...DEVELOPER_STATUS_VALUES]).withDefault('all');
export const severityParser = parseAsStringEnum([...SEVERITY_VALUES]).withDefault('all');
export const reviewTypeParser = parseAsStringEnum([...REVIEW_TYPE_VALUES]).withDefault('flags');
export const reviewModeParser = parseAsStringEnum([...REVIEW_MODE_VALUES]).withDefault('review');

// Boolean filter parsers
export const booleanParser = parseAsBoolean;

// Generic string parsers with no default (returns null if missing)
export const categoryParser = parseAsString;
export const searchParser = parseAsString;
export const developerAssignedParser = parseAsString;
export const letterParser = parseAsString;
export const reviewerParser = parseAsString;

// Sort by parsers for different contexts
export const flagSortByParser = parseAsStringEnum([
  'severity',
  'category',
  'reviewedAt',
] as const).withDefault('severity');

export const complianceSortByParser = parseAsStringEnum([
  'issueType',
  'createdAt',
  'reviewedAt',
] as const).withDefault('createdAt');

export const developerSortByParser = parseAsStringEnum([
  'reviewedAt',
  'developerCheckedAt',
] as const).withDefault('reviewedAt');

export const regulationSortByParser = parseAsStringEnum([
  'title',
  'numFlags',
  'maxSeverity',
  'overallComplexity',
] as const).withDefault('numFlags');

// ============================================
// Combined parsers for common use cases
// ============================================

/**
 * Parser configuration for pagination controls
 */
export const paginationParsers = {
  page: pageParser,
  pageSize: pageSizeParser,
};

/**
 * Parser configuration for the review queue filters
 */
export const reviewQueueParsers = {
  page: pageParser,
  reviewStatus: reviewStatusParser,
  severity: severityParser,
  category: categoryParser,
  sortBy: flagSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for the developer queue filters
 */
export const developerQueueParsers = {
  page: pageParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  sortBy: developerSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for the review page
 */
export const reviewPageParsers = {
  type: reviewTypeParser,
  mode: reviewModeParser,
  page: pageParser,
  reviewStatus: reviewStatusParser,
  severity: severityParser,
  category: categoryParser,
  sortBy: flagSortByParser,
  sortOrder: sortOrderParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
};

/**
 * Parser configuration for the browse hierarchy filters
 */
export const browseFiltersParsers = {
  analyzed: booleanParser,
  hasFlags: booleanParser,
  severity: severityParser,
  hasDefs: booleanParser,
  hasCompliance: booleanParser,
  search: searchParser,
};

// ============================================
// Helper for creating URL strings
// ============================================

/**
 * Creates a query string from an object of key-value pairs.
 * Omits null, undefined, and 'all' values.
 */
export function createQueryString(
  params: Record<string, string | number | null | undefined>
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === 'all') {
      continue;
    }
    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

/**
 * Merges new params into existing search params, resetting page to 1 when filters change.
 */
export function mergeQueryParams(
  existingParams: URLSearchParams | string,
  updates: Record<string, string | number | null | undefined>,
  resetPage = true
): string {
  const params =
    typeof existingParams === 'string'
      ? new URLSearchParams(existingParams)
      : new URLSearchParams(existingParams.toString());

  if (resetPage) {
    params.set('page', '1');
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '' || value === 'all') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  return params.toString();
}
