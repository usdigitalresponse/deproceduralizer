import type { RegulationWithAnalysis, ComplianceIssue, CrossReferenceWithTarget, CrossReferenceWithSource } from '@deproceduralizer/database';

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

export interface RedFlagsSectionProps {
  redFlags: NonNullable<RegulationWithAnalysis['redFlags']>;
  state: string;
  documentId: number;
  currentUrl: string;
}

export interface ComplianceIssuesSectionProps {
  issues: ComplianceIssue[];
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
  complianceIssues: ComplianceIssue[];
  crossRefs: CrossReferenceWithTarget[];
  incomingRefs: CrossReferenceWithSource[];
  isLoading: boolean;
  error: string | null;
}
