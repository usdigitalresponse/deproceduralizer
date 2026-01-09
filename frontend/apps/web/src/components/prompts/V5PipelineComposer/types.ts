import type { IssueConfig, ComposedPrompt } from '@/lib/actions/research-pipeline';

export type TierNumber = 1 | 2 | 3;

export interface TierInfo {
  tier: TierNumber;
  name: string;
  description: string;
  shortName: string;
}

export const TIER_INFO: TierInfo[] = [
  {
    tier: 1,
    name: 'Match Filtering + Argument Framing',
    description: 'Filters regex matches, identifies false positives, generates argument framing',
    shortName: 'Filter',
  },
  {
    tier: 2,
    name: 'Full Classification',
    description: 'Deep analysis with full document context and definitions',
    shortName: 'Classify',
  },
  {
    tier: 3,
    name: 'Web Search Verification',
    description: 'Validates findings using external web sources',
    shortName: 'Verify',
  },
];

export interface IssueTypeOption {
  name: string;
  displayName: string;
  category: string;
  precision: number;
}

export type { IssueConfig, ComposedPrompt };
