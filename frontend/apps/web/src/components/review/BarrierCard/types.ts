import type { BarrierIssueWithContext } from '@deproceduralizer/database';

export interface BarrierCardProps {
  issue: BarrierIssueWithContext;
  onUpdated: (updated: BarrierIssueWithContext) => void;
  onCleared?: (issueId: number) => void;
  state?: string;
  mode?: 'review' | 'developer';
}

export interface BarrierFormProps {
  issue: BarrierIssueWithContext;
  onUpdated: (updated: BarrierIssueWithContext) => void;
}

export type ReviewFormProps = BarrierFormProps;
export type DeveloperFormProps = BarrierFormProps & { state?: string; onCleared?: (issueId: number) => void };
