import type { LucideIcon } from 'lucide-react';
import { BookOpen, Zap, Layers, ClipboardList } from 'lucide-react';
import { BARRIER_CATEGORY_LABELS as _LABELS } from '@deproceduralizer/database/schema';
import { formatLabel } from '@/types/regulation';
import type { StrategyKey, BarrierStrategyStats } from '@/lib/actions/barrier-strategies';

/** Re-exported with widened key type for client components indexing with `string`. */
export const BARRIER_CATEGORY_LABELS: Record<string, string> = _LABELS;

/** Categories that represent structural/systemic regulatory burden patterns. */
export const STRUCTURAL_CATEGORIES = [
  'ADMINISTRATIVE_BURDENS',
  'MANDATED_STEPS_NOT_OUTCOMES',
  'REGULATORY_COMPLEXITY',
  'ONE_SIZE_FITS_ALL',
  'CASCADE_OF_RIGIDITY',
  'UNFUNDED_MANDATE',
] as const;

/** Get a human-readable label for a Barrier category code. */
export function getCategoryLabel(cat: string): string {
  return BARRIER_CATEGORY_LABELS[cat] ?? formatLabel(cat);
}

/** Check if a category is a structural burden pattern. */
export function isStructuralCategory(cat: string): boolean {
  return (STRUCTURAL_CATEGORIES as readonly string[]).includes(cat);
}

// ---------------------------------------------------------------------------
// Strategy definitions — shared across analytics tab and /barriers page
// ---------------------------------------------------------------------------

export interface StrategyDefinition {
  key: StrategyKey;
  label: string;
  icon: LucideIcon;
  description: string;
  filters: string;
  audience: string;
}

export const STRATEGIES: StrategyDefinition[] = [
  {
    key: 'best-stories',
    label: 'Best Stories',
    icon: BookOpen,
    description: 'High severity findings in categories with strong narrative potential.',
    filters: 'Severity >= 6, 6 categories (admin burdens, dead references, frozen tech, fee burdens, missing digital auth, access barriers)',
    audience: 'For a presentation or report \u2014 findings that make people say "wait, really?"',
  },
  {
    key: 'surprises',
    label: 'Surprises',
    icon: Zap,
    description: 'Findings in areas where insiders might not know the specifics.',
    filters: 'Severity >= 4, 5 categories (unclear delegation, dead references, frozen tech, missing digital auth, access barriers)',
    audience: 'For showing state officials things they haven\'t seen before.',
  },
  {
    key: 'framework',
    label: 'Core Framework',
    icon: Layers,
    description: 'All findings that match the core structural implementation patterns.',
    filters: 'Severity >= 5, all 17 categories (excluding OTHER)',
    audience: 'For a comprehensive structural analysis of implementation barriers.',
  },
  {
    key: 'action-plan',
    label: 'Action Plan',
    icon: ClipboardList,
    description: 'Everything \u2014 the broadest view of all non-OTHER findings.',
    filters: 'All severities, all 17 categories',
    audience: 'For a complete inventory \u2014 sort and filter from here.',
  },
];

/** Get the count for a strategy from stats. */
export function getStrategyCount(stats: BarrierStrategyStats | null, key: StrategyKey): number {
  if (!stats) return 0;
  switch (key) {
    case 'best-stories': return stats.bestStories;
    case 'surprises': return stats.surprises;
    case 'framework': return stats.framework;
    case 'action-plan': return stats.total;
  }
}
