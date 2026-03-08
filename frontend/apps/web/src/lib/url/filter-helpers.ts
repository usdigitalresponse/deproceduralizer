/**
 * Server-safe filter parsing helpers.
 * These functions don't depend on nuqs and can be used in server components.
 */

// ============================================
// Multi-Select Parsing Helpers
// ============================================

export type SeverityLevel = 'high' | 'medium' | 'low';
const VALID_SEVERITIES: readonly SeverityLevel[] = ['high', 'medium', 'low'];

/**
 * Parse comma-separated string into array. Server-safe (no nuqs dependency).
 */
export function parseCommaSeparated(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

/**
 * Serialize array to comma-separated string for URL.
 */
export function serializeCommaSeparated(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.join(',');
}

/**
 * Parse comma-separated severity string into typed array.
 * Filters out invalid values.
 */
export function parseSeverities(raw: string | null | undefined): SeverityLevel[] {
  if (!raw) return [];
  return raw.split(',').filter((s): s is SeverityLevel => VALID_SEVERITIES.includes(s as SeverityLevel));
}

// ============================================
// Filter Parsing Helpers
// ============================================

/**
 * Parse a boolean filter from a URL query parameter.
 * Returns true for 'true', false for 'false', and undefined otherwise.
 *
 * @example
 * const hasFlags = parseBooleanParam(queryParams.hasFlags);
 */
export function parseBooleanParam(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Parse severity filter value.
 * Supports comma-separated multi-select values (e.g., "high,medium").
 * Returns undefined when no filter is active.
 */
export function parseSeverityFilter(val?: string): string | undefined {
  if (!val || val === 'all') return undefined;
  return val;
}

/**
 * Parse boolean filter value (handles string 'true'/'false'/'all').
 */
export function parseBooleanFilter(val?: string): boolean | 'all' {
  if (!val || val === 'all') return 'all';
  return val === 'true';
}

/**
 * Parse requirementFound filter.
 * Default to true (only confirmed) to match client-side nuqs parser.
 */
export function parseRequirementFoundFilter(val?: string): boolean | 'all' {
  if (val === 'all') return 'all';
  if (val === 'false') return false;
  return true; // Default to true (LLM confirmed only)
}

/**
 * Parse tier filter value for research pipeline analysis.
 */
export function parseTierFilter(val?: string): '0' | '1' | '2' | '3' | 'all' {
  if (!val || val === 'all') return 'all';
  if (['0', '1', '2', '3'].includes(val)) return val as '0' | '1' | '2' | '3';
  return 'all';
}

// ============================================
// Page Config Helpers
// ============================================

interface PageConfig {
  title: string;
  description: string;
}

/**
 * Get page config (title/description) for the review page.
 */
export function getReviewPageConfig(
  stateName: string,
  regulationsLabel: string,
  mode: 'review' | 'developer',
  reviewType: 'compliance' | 'definitions' | 'needs_info' | 'jenai'
): PageConfig {
  if (mode === 'developer') {
    if (reviewType === 'definitions') {
      return {
        title: `Developer Review - ${stateName} Definitions`,
        description: 'Track implementation status of reviewed definitions',
      };
    }
    if (reviewType === 'jenai') {
      return {
        title: `Developer Review - ${stateName} JenAI`,
        description: 'Track implementation status of JenAI implementation issues',
      };
    }
    return {
      title: `Developer Review - ${stateName}`,
      description: 'Track implementation status of reviewed regulatory items',
    };
  }

  // Review mode
  switch (reviewType) {
    case 'definitions':
      return {
        title: `Review ${stateName} Definitions`,
        description: 'Review and correct LLM-extracted definitions',
      };
    case 'compliance':
      return {
        title: `Review ${stateName} Regulations`,
        description: `Efficiently triage compliance issues identified in ${regulationsLabel}`,
      };
    case 'needs_info':
      return {
        title: `Review ${stateName} Regulations`,
        description: 'Items that need additional information from reviewers',
      };
    case 'jenai':
      return {
        title: `Review ${stateName} Implementation Issues`,
        description: `Review JenAI-identified implementation complexity issues in ${regulationsLabel}`,
      };
    default:
      return {
        title: `Review ${stateName} Regulations`,
        description: `Efficiently triage issues identified in ${regulationsLabel}`,
      };
  }
}
