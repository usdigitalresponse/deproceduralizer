import type { JenAIIssueWithContext } from '@deproceduralizer/database';

export interface JenAICardProps {
  issue: JenAIIssueWithContext;
  onUpdated: (updated: JenAIIssueWithContext) => void;
  onCleared?: (issueId: number) => void;
  state?: string;
  mode?: 'review' | 'developer';
}

export interface JenAIFormProps {
  issue: JenAIIssueWithContext;
  onUpdated: (updated: JenAIIssueWithContext) => void;
}

export type ReviewFormProps = JenAIFormProps;
export type DeveloperFormProps = JenAIFormProps & { state?: string; onCleared?: (issueId: number) => void };
