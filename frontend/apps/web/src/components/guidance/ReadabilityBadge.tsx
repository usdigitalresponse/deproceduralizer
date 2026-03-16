'use client';

import { Badge } from '@/components/ui/Badge';
import { READABILITY_TIERS } from '@/lib/constants/values';

interface ReadabilityConfig {
  variant: 'danger' | 'warning' | 'default' | 'success';
  label: string;
}

const TIER_DISPLAY: Record<string, ReadabilityConfig> = {
  very_difficult: { variant: 'danger', label: 'Very Difficult' },
  difficult: { variant: 'warning', label: 'Difficult' },
  fairly_difficult: { variant: 'warning', label: 'Fairly Difficult' },
  standard: { variant: 'default', label: 'Standard' },
  easy: { variant: 'success', label: 'Easy' },
};

function getReadabilityConfig(score: number): ReadabilityConfig {
  for (const [tier, { max }] of Object.entries(READABILITY_TIERS)) {
    if (score < max) return TIER_DISPLAY[tier];
  }
  return TIER_DISPLAY.easy;
}

export function getReadabilityLabel(score: number): string {
  return getReadabilityConfig(score).label;
}

interface ReadabilityBadgeProps {
  score: number | null;
}

export function ReadabilityBadge({ score }: ReadabilityBadgeProps) {
  if (score === null) {
    return <Badge variant="default">No data</Badge>;
  }

  const config = getReadabilityConfig(score);
  return (
    <Badge variant={config.variant}>
      {Math.round(score)} - {config.label}
    </Badge>
  );
}
