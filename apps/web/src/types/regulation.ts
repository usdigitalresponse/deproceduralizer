export interface RedFlag {
  id?: number;
  category: string;
  explanation: string;
  severity: number;
  complexity: string;
  matched_phrases?: string[];
  implementation_approach?: string;
  effort_estimate?: string;
  text_examples?: string[];
  // Reviewer fields
  review_status?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  priority?: number;
  impact_type?: string;
}

export interface ParsedRegulation {
  source_index: number;
  title: string;
  url: string;
  content: string;
  url_type: string;
  // Hierarchy fields
  hierarchy_level: string | null;
  hierarchy_path: string | null;
  nycrr_title: number | null;
  nycrr_part: string | null;
  nycrr_section: string | null;
  parent_source_index: number | null;
  // Analysis fields
  red_flags: RedFlag[];
  has_implementation_issues: boolean;
  overall_complexity: string | null;
  summary: string | null;
  requires_technical_review: boolean;
  has_reporting_requirement: boolean;
  max_severity: number;
  num_flags: number;
  // Derived fields for table display
  categories: string;
  explanations: string;
}

// Constants for dropdowns
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
