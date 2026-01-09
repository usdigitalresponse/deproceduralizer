'use client';

import { Card } from '@/components/ui/Card';
import type { ComposedPrompt } from '@/lib/actions/research-pipeline';

interface TokenBreakdownProps {
  composedPrompt: ComposedPrompt;
}

export function TokenBreakdown({ composedPrompt }: TokenBreakdownProps) {
  const { layers, totalTokenEstimate } = composedPrompt;

  const staticCorePercent = (layers.static_core.tokenEstimate / totalTokenEstimate) * 100;
  const issueBlockPercent = (layers.issue_block.tokenEstimate / totalTokenEstimate) * 100;
  const batchContextPercent = (layers.batch_context.tokenEstimate / totalTokenEstimate) * 100;
  const documentTemplatePercent = (layers.document_template.tokenEstimate / totalTokenEstimate) * 100;

  // Calculate cache savings:
  // - static_core is always cached (100% savings after first call)
  // - issue_block is cached per issue type (~95% of calls are repeats)
  // - batch_context is cached per subchapter (~80% of calls are repeats within subchapter batches)
  // - document_template is never cached (0% savings)
  const cacheSavingsPercent =
    staticCorePercent +
    (issueBlockPercent * 0.95) +
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
          style={{ width: `${staticCorePercent}%` }}
          title={`Static Core: ${layers.static_core.tokenEstimate.toLocaleString()} tokens (${staticCorePercent.toFixed(0)}%)`}
        >
          {staticCorePercent > 12 && (
            <span className="text-xs text-white font-medium">
              {staticCorePercent.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="bg-[var(--color-warning)] flex items-center justify-center transition-all"
          style={{ width: `${issueBlockPercent}%` }}
          title={`Issue Block: ${layers.issue_block.tokenEstimate.toLocaleString()} tokens (${issueBlockPercent.toFixed(0)}%)`}
        >
          {issueBlockPercent > 10 && (
            <span className="text-xs text-white font-medium">
              {issueBlockPercent.toFixed(0)}%
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
          style={{ width: `${documentTemplatePercent}%` }}
          title={`Document Template: ${layers.document_template.tokenEstimate.toLocaleString()} tokens (${documentTemplatePercent.toFixed(0)}%)`}
        >
          {documentTemplatePercent > 8 && (
            <span className="text-xs text-white font-medium">
              {documentTemplatePercent.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-primary)]" />
          <span className="text-[var(--color-text-muted)]">
            Static: {layers.static_core.tokenEstimate.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--color-warning)]" />
          <span className="text-[var(--color-text-muted)]">
            Issue: {layers.issue_block.tokenEstimate.toLocaleString()}
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
            Doc: {layers.document_template.tokenEstimate.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Cache savings note */}
      <div className="mt-3 p-3 bg-[var(--color-success-bg)] rounded-[var(--radius-md)]">
        <p className="text-sm text-[var(--color-success)]">
          <strong>~{cacheSavingsPercent.toFixed(0)}% cache hit rate</strong> - Static Core cached globally,
          Issue Block per issue type, Batch Context per subchapter.
        </p>
      </div>
    </Card>
  );
}
