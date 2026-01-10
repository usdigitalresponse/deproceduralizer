/**
 * Pipeline tier data for visualizations.
 * Single source of truth for tier information displayed in the UI.
 */

/**
 * Classification colors consistent with TierClassificationFlow.tsx
 */
export const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Gray - terminal/dismissed
  all_false_positives: {
    bg: 'bg-[var(--color-neutral-100)]',
    text: 'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-neutral-300)]',
  },
  unrelated: {
    bg: 'bg-[var(--color-neutral-100)]',
    text: 'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-neutral-300)]',
  },
  // Blue - proceeding to next tier
  needs_research: {
    bg: 'bg-[var(--color-info-bg)]',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/30',
  },
  needs_full_context: {
    bg: 'bg-[var(--color-info-bg)]',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/30',
  },
  // Green - justified (terminal, positive)
  justified: {
    bg: 'bg-[var(--color-success-bg)]',
    text: 'text-[var(--color-success)]',
    border: 'border-[var(--color-success)]/30',
  },
  // Orange - burdensome (terminal, action needed)
  burdensome: {
    bg: 'bg-[var(--color-warning-bg)]',
    text: 'text-[var(--color-warning)]',
    border: 'border-[var(--color-warning)]/30',
  },
};

/**
 * Human-readable labels for classifications
 */
export const CLASSIFICATION_LABELS: Record<string, string> = {
  all_false_positives: 'False Positive',
  needs_research: 'Needs Research',
  unrelated: 'Unrelated',
  justified: 'Justified',
  burdensome: 'Burdensome',
  needs_full_context: 'Needs Context',
};

export interface PipelineInput {
  label: string;
  description?: string;
}

export interface PipelineRouting {
  condition: string;
  destination: 'T2' | 'T3' | 'STOP';
  description: string;
  percentage?: string;
}

export interface PipelineTierData {
  number: 1 | 2 | 3;
  title: string;
  shortTitle: string;
  description: string;
  inputs: PipelineInput[];
  outputs: {
    classifications: string[];
    additionalOutputs: string[];
  };
  routing: PipelineRouting[];
}

/**
 * V5 Pipeline tier configurations (3-tier architecture)
 *
 * V5 consolidates the old 4-tier V4 pipeline into 3 tiers:
 * - T1: Match Filtering (same as V4)
 * - T2: Full Classification (combines V4's T2 Summary Research + T3 Full Context)
 * - T3: Web Search Verification (was V4's T4 Web Validation)
 */
export const PIPELINE_TIERS: PipelineTierData[] = [
  {
    number: 1,
    title: 'Match Filtering',
    shortTitle: 'T1',
    description: 'AI filters regex matches to identify valid compliance issues vs false positives. Also generates argument framing for next tier.',
    inputs: [
      { label: 'Context catalog', description: 'Metadata about available context (titles, citations, terms)' },
      { label: 'Regex matches', description: 'Keyword matches with surrounding text' },
      { label: 'Sibling metadata', description: 'Adjacent section titles and summaries' },
    ],
    outputs: {
      classifications: ['needs_research', 'all_false_positives'],
      additionalOutputs: [
        'Argument framing (best case for each classification)',
        'Context recommendations',
        'Dismissed matches with reasons',
      ],
    },
    routing: [
      {
        condition: 'needs_research',
        destination: 'T2',
        description: 'Valid matches found, proceed to full classification',
      },
      {
        condition: 'all_false_positives',
        destination: 'STOP',
        description: 'All matches are false positives',
        percentage: '~40%',
      },
    ],
  },
  {
    number: 2,
    title: 'Full Classification',
    shortTitle: 'T2',
    description: 'Deep analysis with full document text, definitions, and context to classify burden and calculate severity.',
    inputs: [
      { label: 'Full document', description: 'Complete regulation text' },
      { label: 'Definitions', description: 'Inherited definitions from scope chain' },
      { label: 'T1 framing', description: 'Argument framing from Tier 1' },
      { label: 'Context items', description: 'Siblings, cross-refs, statutes as needed' },
    ],
    outputs: {
      classifications: ['burdensome', 'justified', 'unrelated'],
      additionalOutputs: [
        'Severity score (1-10)',
        'Verbatim requirements',
        'Arguments for/against',
        'Federal citation (if applicable)',
        'Needs web search flag',
      ],
    },
    routing: [
      {
        condition: 'High-risk issue + justified',
        destination: 'T3',
        description: 'High-risk issues (notarization, wet_signature, witness, etc.) always escalate when justified',
      },
      {
        condition: 'High-risk issue + severity ≥ 7',
        destination: 'T3',
        description: 'High-risk issues with high severity need verification',
      },
      {
        condition: 'cites_federal_statute',
        destination: 'T3',
        description: 'Federal statute claims need external verification',
      },
      {
        condition: 'Low confidence + severity ≥ 7',
        destination: 'T3',
        description: 'Uncertain classifications benefit from web verification',
      },
      {
        condition: 'justified / unrelated / low-sev burdensome',
        destination: 'STOP',
        description: 'Final classification reached',
        percentage: '~60%',
      },
    ],
  },
  {
    number: 3,
    title: 'Web Search Verification',
    shortTitle: 'T3',
    description: 'External validation using web search to verify federal mandates, find modernized alternatives, and confirm state discretion.',
    inputs: [
      { label: 'T2 analysis', description: 'Previous tier classification and reasoning' },
      { label: 'Web search results', description: 'Results from Claude web search tool' },
      { label: 'Statute citations', description: 'Federal mandate references to verify' },
    ],
    outputs: {
      classifications: ['burdensome', 'justified', 'unrelated'],
      additionalOutputs: [
        'Severity adjustment (-3 to +3)',
        'Federal mandate confirmed?',
        'State discretion found?',
        'Modernized alternatives found?',
        'Evidence sources',
      ],
    },
    routing: [
      {
        condition: 'Any classification',
        destination: 'STOP',
        description: 'Terminal tier - final classification',
        percentage: '100%',
      },
    ],
  },
];

/**
 * Get colors for a classification
 */
export function getClassificationColors(classification: string) {
  return CLASSIFICATION_COLORS[classification] || CLASSIFICATION_COLORS.unrelated;
}

/**
 * Get label for a classification
 */
export function getClassificationLabel(classification: string) {
  return CLASSIFICATION_LABELS[classification] || classification;
}
