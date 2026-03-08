'use client';

import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';

interface RegulationQuickStatsProps {
  regulation: Pick<
    RegulationWithAnalysis,
    'hierarchyLevel'
  >;
  className?: string;
}

/**
 * Displays quick stats as inline badges (level).
 * Used in DetailPanel header and other compact displays.
 *
 * @example
 * <RegulationQuickStats regulation={regulation} />
 */
export function RegulationQuickStats({
  regulation,
  className = '',
}: RegulationQuickStatsProps) {
  const { hierarchyLevel } = regulation;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {hierarchyLevel && (
        <Badge variant="default" className="capitalize">
          {hierarchyLevel}
        </Badge>
      )}
    </div>
  );
}

export default RegulationQuickStats;
