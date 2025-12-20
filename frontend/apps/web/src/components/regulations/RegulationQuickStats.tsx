'use client';

import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { Badge, SeverityBadge } from '@/components/ui';
import { getComplexityVariant } from '@/types/regulation';

interface RegulationQuickStatsProps {
  regulation: Pick<
    RegulationWithAnalysis,
    'hierarchyLevel' | 'maxSeverity' | 'numFlags' | 'overallComplexity'
  >;
  className?: string;
}

/**
 * Displays quick stats as inline badges (level, severity, flags, complexity).
 * Used in DetailPanel header and other compact displays.
 *
 * @example
 * <RegulationQuickStats regulation={regulation} />
 */
export function RegulationQuickStats({
  regulation,
  className = '',
}: RegulationQuickStatsProps) {
  const { hierarchyLevel, maxSeverity, numFlags, overallComplexity } = regulation;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {hierarchyLevel && (
        <Badge variant="default" className="capitalize">
          {hierarchyLevel}
        </Badge>
      )}
      {maxSeverity !== null && maxSeverity !== undefined && (
        <SeverityBadge severity={maxSeverity} />
      )}
      {numFlags !== null && numFlags !== undefined && numFlags > 0 && (
        <Badge variant="danger">
          {numFlags} {numFlags === 1 ? 'flag' : 'flags'}
        </Badge>
      )}
      {overallComplexity && (
        <Badge variant={getComplexityVariant(overallComplexity)}>
          {overallComplexity} complexity
        </Badge>
      )}
    </div>
  );
}

export default RegulationQuickStats;
