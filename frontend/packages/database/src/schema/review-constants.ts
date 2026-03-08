// Shared review workflow constants used across compliance-issues,
// definitions, incorporations-by-reference, and fines-fees-penalties

// Review status constants
export const REVIEW_STATUSES = [
  'unreviewed',
  'confirmed',
  'rejected_clear_fp',
  'rejected_not_obvious_bad',
  'needs_context',
  'deferred'
] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

// Status labels for UI display
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  unreviewed: 'Unreviewed',
  confirmed: 'Confirmed',
  rejected_clear_fp: 'Rejected - Clear False Positive',
  rejected_not_obvious_bad: 'Rejected - Not Obviously Bad',
  needs_context: 'Needs More Context',
  deferred: 'Deferred',
};

// Status descriptions for UI helper text
export const REVIEW_STATUS_DESCRIPTIONS: Record<ReviewStatus, string> = {
  unreviewed: 'This item has not been reviewed yet.',
  confirmed: 'Confirm that this is clearly a bad regulation. Provide justification or additional comments beyond what the model said.',
  rejected_clear_fp: 'It is clear that this is not a policy mistake. Provide the reason why this is clearly not a problem.',
  rejected_not_obvious_bad: 'This would require more research to show that it is a bad policy.',
  needs_context: 'Use sparingly. Use this if a simple programmatic next step or question from developers would help categorize.',
  deferred: 'Do not have enough time to look into this. Consider marking as "not obviously bad" unless in narrow circumstances.',
};

// Impact type constants
export const IMPACT_TYPES = [
  'cost_savings',
  'time_savings',
  'accessibility',
  'compliance_risk',
  'operational_efficiency',
  'citizen_experience',
  'other'
] as const;
export type ImpactType = typeof IMPACT_TYPES[number];

// Developer status constants
export const DEVELOPER_STATUSES = [
  'unresolved',
  'resolved',
  'pending',
  'backlogged',
  'need_more_info'
] as const;
export type DeveloperStatus = typeof DEVELOPER_STATUSES[number];

// Resolution type constants (for when status is 'resolved')
export const RESOLUTION_TYPES = [
  'implemented',
  'not_implemented'
] as const;
export type ResolutionType = typeof RESOLUTION_TYPES[number];

// Developer assignment options
export const DEVELOPERS = ['Michael', 'Abigail'] as const;
export type Developer = typeof DEVELOPERS[number];
