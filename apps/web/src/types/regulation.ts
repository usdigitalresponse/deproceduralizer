export interface RedFlag {
  category: string;
  explanation: string;
  severity: number;
  complexity: string;
  matched_phrases?: string[];
}

export interface Regulation {
  source_index: string;
  title: string;
  url: string;
  content: string;
  url_type: string;
  red_flags: string; // JSON string of RedFlag[]
  has_implementation_issues: string;
  overall_complexity: string;
  summary: string;
  requires_technical_review: string;
  has_reporting_requirement: string;
  max_severity: string;
  num_flags: string;
}

export interface ParsedRegulation extends Omit<Regulation, 'red_flags'> {
  red_flags: RedFlag[];
  categories: string;
  explanations: string;
}
