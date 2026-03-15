'use client';

import { Badge } from '@/components/ui/Badge';

interface ReadabilityConfig {
  variant: 'danger' | 'warning' | 'default' | 'success';
  label: string;
}

function getReadabilityConfig(score: number): ReadabilityConfig {
  if (score < 30) return { variant: 'danger', label: 'Very Difficult' };
  if (score < 50) return { variant: 'warning', label: 'Difficult' };
  if (score < 60) return { variant: 'warning', label: 'Fairly Difficult' };
  if (score < 70) return { variant: 'default', label: 'Standard' };
  return { variant: 'success', label: 'Easy' };
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
