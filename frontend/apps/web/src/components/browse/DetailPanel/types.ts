import type { RegulationWithAnalysis, ComplianceIssueWithAnalysisFields, CrossReferenceWithTarget, CrossReferenceWithSource, RegulationStatuteLinkWithStatute } from '@deproceduralizer/database';

export interface DetailPanelProps {
  documentId: number | null;
  onClose: () => void;
  onNavigate?: (id: number) => void;
  /** When true, panel fills entire viewport (for mobile drawer) */
  fullScreen?: boolean;
}

export interface HeaderProps {
  document: RegulationWithAnalysis;
  state: string;
  currentUrl: string;
  onClose: () => void;
}

export interface SummarySectionProps {
  summary: string | null;
}

export interface MetadataSectionProps {
  document: RegulationWithAnalysis;
}

export interface ComplianceIssuesSectionProps {
  issues: ComplianceIssueWithAnalysisFields[];
  state: string;
  documentId: number;
  currentUrl: string;
}

export interface CrossReferencesSectionProps {
  refs: CrossReferenceWithTarget[];
  state: string;
  documentId: number;
  currentUrl: string;
}

export interface IncomingReferencesSectionProps {
  refs: CrossReferenceWithSource[];
  state: string;
  documentId: number;
  currentUrl: string;
}

export interface DetailPanelData {
  document: RegulationWithAnalysis | null;
  complianceIssues: ComplianceIssueWithAnalysisFields[];
  crossRefs: CrossReferenceWithTarget[];
  incomingRefs: CrossReferenceWithSource[];
  statuteLinks: RegulationStatuteLinkWithStatute[];
  isLoading: boolean;
  error: string | null;
}
