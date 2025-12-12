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

export const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - Highest' },
  { value: 2, label: '2 - High' },
  { value: 3, label: '3 - Medium' },
  { value: 4, label: '4 - Low' },
  { value: 5, label: '5 - Lowest' },
] as const;
