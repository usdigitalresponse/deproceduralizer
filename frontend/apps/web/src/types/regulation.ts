// Dropdown options for the review form UI
// These extend the database constants with display labels

export const REVIEW_STATUSES = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'needs_context', label: 'Needs Context' },
  { value: 'deferred', label: 'Deferred' },
] as const;

export const IMPACT_TYPES = [
  { value: 'cost_savings', label: 'Cost Savings' },
  { value: 'time_savings', label: 'Time Savings' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'compliance_risk', label: 'Compliance Risk' },
  { value: 'operational_efficiency', label: 'Operational Efficiency' },
  { value: 'citizen_experience', label: 'Citizen Experience' },
  { value: 'other', label: 'Other' },
] as const;

// Note: values are strings for Radix Select compatibility
// Parse with parseInt() when saving to database
export const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Highest' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - Low' },
  { value: '5', label: '5 - Lowest' },
] as const;

// Compliance issue types - requirements that add burden
export const COMPLIANCE_ISSUE_TYPES = [
  { value: 'wet_signature', label: 'Wet Signature Required' },
  { value: 'in_person', label: 'In-Person Required' },
  { value: 'paper_form', label: 'Paper Form Required' },
  { value: 'notarized', label: 'Notarization Required' },
  { value: 'certified', label: 'Certification Required' },
  { value: 'reporting_requirement', label: 'Reporting Requirement' },
  { value: 'other', label: 'Other' },
] as const;

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  wet_signature: 'Wet Signature',
  in_person: 'In-Person',
  paper_form: 'Paper Form',
  notarized: 'Notarized',
  certified: 'Certified',
  reporting_requirement: 'Reporting',
  other: 'Other',
};

// Review type for the review page tabs
export const REVIEW_TYPES = [
  { value: 'flags', label: 'Red Flags' },
  { value: 'compliance', label: 'Compliance Issues' },
  { value: 'all', label: 'All' },
] as const;

export type ReviewType = typeof REVIEW_TYPES[number]['value'];
