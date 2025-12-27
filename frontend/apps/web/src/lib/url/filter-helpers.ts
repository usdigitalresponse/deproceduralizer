/**
 * Server-safe filter parsing helpers.
 * These functions don't depend on nuqs and can be used in server components.
 */

// ============================================
// Filter Parsing Helpers
// ============================================

/**
 * Parse severity filter value to typed value.
 */
export function parseSeverityFilter(val?: string): 'high' | 'medium' | 'low' | 'all' {
  if (!val || val === 'all') return 'all';
  if (val === 'high' || val === 'medium' || val === 'low') return val;
  return 'all';
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
  reviewType: 'flags' | 'compliance' | 'definitions' | 'needs_info'
): PageConfig {
  if (mode === 'developer') {
    if (reviewType === 'definitions') {
      return {
        title: `Developer Review - ${stateName} Definitions`,
        description: 'Track implementation status of reviewed definitions',
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
    default:
      return {
        title: `Review ${stateName} Regulations`,
        description: `Efficiently triage red flags identified in ${regulationsLabel}`,
      };
  }
}
