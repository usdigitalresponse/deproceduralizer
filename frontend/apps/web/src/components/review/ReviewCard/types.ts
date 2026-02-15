import type { RedFlagWithContext } from '@deproceduralizer/database';

export interface ReviewCardProps {
  flag: RedFlagWithContext;
  onUpdated: (updatedFlag: RedFlagWithContext) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
  /** State code for hierarchy links */
  state?: string;
}

export interface HeaderProps {
  flag: RedFlagWithContext;
}

export interface LLMAnalysisSectionProps {
  explanation: string;
  textExamples: string[] | null;
  implementationApproach: string | null;
  effortEstimate: string | null;
}

export interface RegulationActionsProps {
  regulation: RedFlagWithContext['regulation'];
  stateCode: string;
  explanation: string;
  matchedPhrases: string[] | null;
}

export interface ReviewFormProps {
  flag: RedFlagWithContext;
  onUpdated: (updatedFlag: RedFlagWithContext) => void;
}
