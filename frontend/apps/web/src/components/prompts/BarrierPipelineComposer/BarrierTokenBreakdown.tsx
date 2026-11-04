'use client';

import { Card } from '@/components/ui/Card';
import type { BarrierComposedPrompt } from './types';

interface BarrierTokenBreakdownProps {
  composedPrompt: BarrierComposedPrompt;
}

export function BarrierTokenBreakdown({ composedPrompt }: BarrierTokenBreakdownProps) {
  const { layers, totalTokenEstimate } = composedPrompt;

  const systemPercent = (layers.system.tokenEstimate / totalTokenEstimate) * 100;
  const batchContextPercent = (layers.batch_context.tokenEstimate / totalTokenEstimate) * 100;
  const templatePercent = (layers.template.tokenEstimate / totalTokenEstimate) * 100;

  // Cache savings:
  // - system is always cached (100% savings after first call)
  // - batch_context is cached per subchapter (~80% of calls are repeats within subchapter batches)
  // - template is never cached (0% savings)
  const cacheSavingsPercent =
    systemPercent +
    (batchContextPercent * 0.80);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-[var(--color-text)]">Token Breakdown</h3>
        <span className="text-sm text-[var(--color-text-muted)]">
          ~{totalTokenEstimate.toLocaleString()} tokens total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="h-8 rounded-[var(--radius-md)] overflow-hidden flex bg-[var(--color-neutral-100)]">
        <div
          className="bg-[var(--color-primary)] flex items-center justify-center transition-all"
          style={{ width: `${systemPercent}%` }}
          title={`System: ${layers.system.tokenEstimate.toLocaleString()} tokens (${systemPercent.toFixed(0)}%)`}
        >
          {systemPercent > 12 && (
            <span className="text-xs text-white font-medium">
              {systemPercent.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="bg-[var(--color-success)] flex items-center justify-center transition-all"
          style={{ width: `${batchContextPercent}%` }}
          title={`Batch Context: ${layers.batch_context.tokenEstimate.toLocaleString()} tokens (${batchContextPercent.toFixed(0)}%)`}
        >
          {batchContextPercent > 10 && (
            <span className="text-xs text-white font-medium">
              {batchContextPercent.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="bg-[var(--color-info)] flex items-center justify-center transition-all"
          style={{ width: `${templatePercent}%` }}
          title={`Template: ${layers.template.tokenEstimate.toLocaleString()} tokens (${templatePercent.toFixed(0)}%)`}
        >
          {templatePercent > 8 && (
            <span className="text-xs text-white font-medium">
              {templatePercent.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-primary)]" />
          <span className="text-[var(--color-text-muted)]">
            System: {layers.system.tokenEstimate.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-success)]" />
          <span className="text-[var(--color-text-muted)]">
            Batch: {layers.batch_context.tokenEstimate.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-info)]" />
          <span className="text-[var(--color-text-muted)]">
            Template: {layers.template.tokenEstimate.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Cache savings note */}
      <div className="mt-3 p-3 bg-[var(--color-success-bg)] rounded-[var(--radius-md)]">
        <p className="text-sm text-[var(--color-success)]">
          <strong>~{cacheSavingsPercent.toFixed(0)}% cache hit rate (estimated)</strong> - System prompt cached globally,
          Batch Context cached per subchapter. Only the per-section template is unique.
        </p>
      </div>
    </Card>
  );
}
