'use client';

import type { TierCompletionCounts, ClassificationBreakdown } from '@deproceduralizer/database';

interface TierDistributionChartProps {
  tierCounts: TierCompletionCounts;
  classificationBreakdown: ClassificationBreakdown;
  total: number;
}

const TIER_LABELS = [
  { tier: 0, label: 'Not Analyzed', shortLabel: 'T0', color: 'var(--color-neutral-400)' },
  { tier: 1, label: 'Match Filtering', shortLabel: 'T1', color: 'var(--color-info)' },
  { tier: 2, label: 'Full Classification', shortLabel: 'T2', color: 'var(--color-primary)' },
  { tier: 3, label: 'Web Search', shortLabel: 'T3', color: 'var(--color-success)' },
];

const CLASSIFICATION_COLORS: Record<string, string> = {
  all_false_positives: 'var(--color-neutral-400)',
  needs_research: 'var(--color-info)',
  needs_full_context: 'var(--color-info)',
  unrelated: 'var(--color-neutral-500)',
  justified: 'var(--color-success)',
  burdensome: 'var(--color-warning)',
};

function formatClassification(classification: string): string {
  return classification
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function TierDistributionChart({
  tierCounts,
  classificationBreakdown,
  total,
}: TierDistributionChartProps) {
  const counts = [
    tierCounts.tier0,
    tierCounts.tier1,
    tierCounts.tier2,
    tierCounts.tier3,
  ];

  // Build stacked bar segments for each tier based on classification outcomes
  const getStackedSegments = (tier: number) => {
    if (tier === 0) {
      // T0 = Not analyzed, single gray bar
      return [{ classification: 'not_analyzed', count: counts[0], color: 'var(--color-neutral-400)' }];
    }

    const breakdown = tier === 1 ? classificationBreakdown.tier1
      : tier === 2 ? classificationBreakdown.tier2
      : classificationBreakdown.tier3;

    if (!breakdown) return [];

    // Order: Proceeds (blue) → Justified (green) → Burdensome (orange) → Dismissed/Unrelated (gray)
    const segments = [];

    // "Proceeds to next tier" classifications
    const proceeds = (breakdown['needs_research'] || 0) + (breakdown['needs_full_context'] || 0);
    if (proceeds > 0) {
      segments.push({ classification: 'proceeds', count: proceeds, color: 'var(--color-info)' });
    }

    // Terminal: Justified (green)
    if (breakdown['justified']) {
      segments.push({ classification: 'justified', count: breakdown['justified'], color: 'var(--color-success)' });
    }

    // Terminal: Burdensome (orange)
    if (breakdown['burdensome']) {
      segments.push({ classification: 'burdensome', count: breakdown['burdensome'], color: 'var(--color-warning)' });
    }

    // Dismissed/Unrelated (gray)
    const dismissed = (breakdown['all_false_positives'] || 0) + (breakdown['unrelated'] || 0);
    if (dismissed > 0) {
      segments.push({ classification: 'dismissed', count: dismissed, color: 'var(--color-neutral-400)' });
    }

    return segments;
  };

  return (
    <div className="space-y-6">
      {/* Tier Distribution */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">
          Pipeline Progress
        </h3>
        <div className="space-y-3">
          {TIER_LABELS.map(({ tier, label, shortLabel, color }) => {
            const count = counts[tier];
            const percentage = total > 0 ? (count / total) * 100 : 0;
            const segments = getStackedSegments(tier);

            return (
              <div key={tier} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-5 rounded text-[10px] font-semibold flex items-center justify-center text-white"
                      style={{ backgroundColor: color }}
                    >
                      {shortLabel}
                    </span>
                    <span className="text-[var(--color-text-secondary)]">{label}</span>
                  </div>
                  <span className="font-medium text-[var(--color-text)]">
                    {count.toLocaleString()} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden flex">
                  {segments.map((segment, idx) => {
                    const segmentWidth = total > 0 ? (segment.count / total) * 100 : 0;
                    return (
                      <div
                        key={segment.classification}
                        className={`h-full transition-all duration-500 ${idx === 0 ? 'rounded-l-full' : ''} ${idx === segments.length - 1 ? 'rounded-r-full' : ''}`}
                        style={{
                          width: `${segmentWidth}%`,
                          backgroundColor: segment.color,
                        }}
                        title={`${formatClassification(segment.classification)}: ${segment.count.toLocaleString()}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Classification Breakdown */}
      <div className="pt-4 border-t border-[var(--color-neutral-200)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4">
          Classification Distribution
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Tier 2+ Final Classifications */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--color-text-muted)]">
              Final Classifications
            </h4>
            {['burdensome', 'justified', 'unrelated'].map(classification => {
              const t2 = classificationBreakdown.tier2[classification] || 0;
              const t3 = classificationBreakdown.tier3[classification] || 0;
              const total = t2 + t3;
              if (total === 0) return null;

              return (
                <div
                  key={classification}
                  className="flex items-center justify-between text-xs bg-[var(--color-neutral-50)] px-2 py-1.5 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CLASSIFICATION_COLORS[classification] }}
                    />
                    <span className="text-[var(--color-text-secondary)]">
                      {formatClassification(classification)}
                    </span>
                  </div>
                  <span className="font-medium text-[var(--color-text)]">
                    {total.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Early Exits */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-[var(--color-text-muted)]">
              Early Exits
            </h4>
            {['all_false_positives', 'needs_research', 'needs_full_context'].map(classification => {
              const t1 = classificationBreakdown.tier1[classification] || 0;
              const t2 = classificationBreakdown.tier2[classification] || 0;
              const total = t1 + t2;
              if (total === 0) return null;

              return (
                <div
                  key={classification}
                  className="flex items-center justify-between text-xs bg-[var(--color-neutral-50)] px-2 py-1.5 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CLASSIFICATION_COLORS[classification] }}
                    />
                    <span className="text-[var(--color-text-secondary)]">
                      {formatClassification(classification)}
                    </span>
                  </div>
                  <span className="font-medium text-[var(--color-text)]">
                    {total.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TierDistributionChart;
