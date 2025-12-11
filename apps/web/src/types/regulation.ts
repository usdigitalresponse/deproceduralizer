export interface RedFlag {
  category: string;
  explanation: string;
  severity: number;
  complexity: string;
  matched_phrases?: string[];
  implementation_approach?: string;
  effort_estimate?: string;
  text_examples?: string[];
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
