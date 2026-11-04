'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { X } from 'lucide-react';
import type { BarrierStrategyStats } from '@/lib/actions/barrier-strategies';
import type { StrategyKey } from '@/lib/actions/barrier-strategies';
import { STRATEGIES, getStrategyCount } from '@/lib/constants/barrier';

interface BarrierCompareTabProps {
  stats: BarrierStrategyStats | null;
}

function getOverlap(stats: BarrierStrategyStats | null, a: StrategyKey, b: StrategyKey): number {
  if (!stats?.overlaps) return 0;
  if (a === b) return getStrategyCount(stats, a);
  const match = stats.overlaps.find(
    o => (o.strategy1 === a && o.strategy2 === b) || (o.strategy1 === b && o.strategy2 === a)
  );
  return match?.overlap ?? 0;
}

export function BarrierCompareTab({ stats }: BarrierCompareTabProps) {
  const total = stats?.total ?? 0;
  const [modalStrategy, setModalStrategy] = useState<StrategyKey | null>(null);

  return (
    <div className="space-y-6">
      {/* Note */}
      <div className="px-4 py-3 bg-[var(--color-primary-weaker)] border border-[var(--color-primary-weak)] rounded-[var(--radius-md)]">
        <p className="text-sm text-[var(--color-text-secondary)]">
          These four strategies are different ways to filter the same {total.toLocaleString()} findings.
          They range from narrow ({getStrategyCount(stats, 'best-stories').toLocaleString()} findings) to broad ({total.toLocaleString()}).
          Click &ldquo;Show overlap&rdquo; on any strategy to see how it relates to the others.
        </p>
      </div>

      {/* One card per strategy */}
      {STRATEGIES.map((s) => {
        const count = getStrategyCount(stats, s.key);
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const barWidth = total > 0 ? Math.max((count / total) * 100, 2) : 0;
        const Icon = s.icon;

        return (
          <Card key={s.key}>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-primary-weaker)]">
                    <Icon className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{s.label}</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">{s.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[var(--color-text)]">{count.toLocaleString()}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">{pct}% of total</div>
                </div>
              </div>

              <div className="h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="flex items-start justify-between gap-4 text-sm">
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Filters: </span>
                    <span className="text-[var(--color-text-secondary)]">{s.filters}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Best for: </span>
                    <span className="text-[var(--color-text-secondary)]">{s.audience}</span>
                  </div>
                </div>
                <button
                  onClick={() => setModalStrategy(s.key)}
                  className="text-sm text-[var(--color-primary)] hover:underline whitespace-nowrap"
                >
                  Show overlap →
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Overlap modal */}
      {modalStrategy && (
        <OverlapModal
          stats={stats}
          strategyKey={modalStrategy}
          onClose={() => setModalStrategy(null)}
        />
      )}
    </div>
  );
}

function OverlapModal({
  stats,
  strategyKey,
  onClose,
}: {
  stats: BarrierStrategyStats | null;
  strategyKey: StrategyKey;
  onClose: () => void;
}) {
  const strategy = STRATEGIES.find(s => s.key === strategyKey);
  if (!strategy) return null;

  const thisCount = getStrategyCount(stats, strategyKey);
  const others = STRATEGIES.filter(s => s.key !== strategyKey);
  const Icon = strategy.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-xl shadow-xl max-w-lg w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-neutral-200)]">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[var(--color-primary)]" />
            <h3 className="text-lg font-semibold">{strategy.label}</h3>
            <span className="text-sm text-[var(--color-text-muted)]">({thisCount.toLocaleString()} findings)</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-neutral-100)] rounded">
            <X className="h-5 w-5 text-[var(--color-text-muted)]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Of the <strong>{thisCount.toLocaleString()}</strong> findings in <strong>{strategy.label}</strong>:
          </p>

          {others.map(other => {
            const overlap = getOverlap(stats, strategyKey, other.key);
            const pct = thisCount > 0 ? Math.round((overlap / thisCount) * 100) : 0;
            const OtherIcon = other.icon;

            return (
              <div key={other.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <OtherIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
                    <span className="font-medium">{other.label}</span>
                  </div>
                  <span className="font-semibold">{pct}% overlap</span>
                </div>
                <div className="h-5 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {overlap.toLocaleString()} of {thisCount.toLocaleString()} {strategy.label} findings are also in {other.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
