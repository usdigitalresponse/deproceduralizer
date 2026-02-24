import type { ComplianceIssueWithAnalysis, ContextEntry } from '@deproceduralizer/database';

export interface ComplianceIssueCardProps {
  issue: ComplianceIssueWithAnalysis;
  onUpdated: (updatedIssue: ComplianceIssueWithAnalysis) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export interface HeaderProps {
  issue: ComplianceIssueWithAnalysis;
  issueTypeLabel: string;
}

export interface TierClassificationSectionProps {
  analysis: NonNullable<ComplianceIssueWithAnalysis['analysis']>;
}

export interface SummaryContextProps {
  regulation: ComplianceIssueWithAnalysis['regulation'];
  state: string;
  citation: string;
}

export interface LLMAnalysisSectionProps {
  tier1Reasoning: string | null;
  tier2Reasoning: string | null;
  tier3Reasoning: string | null;
  verbatimSupportingText: string[] | null;
  isVerbatim: boolean | null;
  statuteCitation: string | null;
}

export interface EvidenceSectionProps {
  contextUsed: ContextEntry[];
  verbatimRequirements?: string[];
}

export interface AnalysisDetailsSectionProps {
  analysis: NonNullable<ComplianceIssueWithAnalysis['analysis']>;
}

export interface TechnicalDetailsSectionProps {
  regexMatchPattern: string;
}

export interface RegulationActionsProps {
  regulation: ComplianceIssueWithAnalysis['regulation'];
  stateCode: string;
  verbatimSupportingText: string[] | null;
  regexMatchPattern: string | null;
  isVerbatim: boolean | null;
}

export interface ReviewFormProps {
  issue: ComplianceIssueWithAnalysis;
  onUpdated: (updatedIssue: ComplianceIssueWithAnalysis) => void;
}
