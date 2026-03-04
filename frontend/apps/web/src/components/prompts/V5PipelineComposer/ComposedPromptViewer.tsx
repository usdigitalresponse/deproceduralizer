'use client';

import { Loader2, Database, Zap, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Layers } from 'lucide-react';
import { LayerSection } from '@/components/prompts/shared/LayerSection';
import type { ComposedPrompt } from '@/lib/actions/research-pipeline';

interface ComposedPromptViewerProps {
  composedPrompt: ComposedPrompt | null;
  isLoading?: boolean;
}

export function ComposedPromptViewer({
  composedPrompt,
  isLoading = false,
}: ComposedPromptViewerProps) {
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      </Card>
    );
  }

  if (!composedPrompt) {
    return (
      <Card>
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          Select an issue type to view the composed prompt
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-[var(--color-neutral-100)]">
        <h3 className="font-semibold text-[var(--color-text)]">
          Tier {composedPrompt.tier}: {composedPrompt.tierName}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          {composedPrompt.tierDescription}
        </p>
      </div>

      <div className="px-4 py-3 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-primary)]" />
            <span>Static Core (~60%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-warning)]" />
            <span>Issue Block (~15%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-success)]" />
            <span>Batch Context (~15%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-info)]" />
            <span>Document (~10%)</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <LayerSection
          title="Static Core"
          icon={<Database className="w-4 h-4 text-[var(--color-primary)]" />}
          content={composedPrompt.layers.static_core.content}
          tokenEstimate={composedPrompt.layers.static_core.tokenEstimate}
          cacheStatus="Cached globally"
          colorClass="border-[var(--color-primary)]"
          bgClass="bg-[var(--color-primary-weaker)]"
          defaultExpanded
        />

        <LayerSection
          title="Issue Block"
          icon={<Zap className="w-4 h-4 text-[var(--color-warning)]" />}
          content={composedPrompt.layers.issue_block.content}
          tokenEstimate={composedPrompt.layers.issue_block.tokenEstimate}
          cacheStatus="Cached per issue type"
          colorClass="border-[var(--color-warning)]"
          bgClass="bg-[var(--color-accent-muted)]"
          placeholders={composedPrompt.layers.issue_block.placeholdersReplaced}
        />

        <LayerSection
          title="Batch Context"
          icon={<Layers className="w-4 h-4 text-[var(--color-success)]" />}
          content={composedPrompt.layers.batch_context.content}
          tokenEstimate={composedPrompt.layers.batch_context.tokenEstimate}
          cacheStatus="Cached per subchapter"
          colorClass="border-[var(--color-success)]"
          bgClass="bg-[var(--color-success-bg)]"
          placeholders={composedPrompt.layers.batch_context.placeholdersRemaining}
        />

        <LayerSection
          title="Document Template"
          icon={<FileText className="w-4 h-4 text-[var(--color-info)]" />}
          content={composedPrompt.layers.document_template.content}
          tokenEstimate={composedPrompt.layers.document_template.tokenEstimate}
          cacheStatus="Never cached (unique per doc)"
          colorClass="border-[var(--color-info)]"
          bgClass="bg-[var(--color-info-bg)]"
          placeholders={composedPrompt.layers.document_template.placeholdersRemaining}
        />
      </div>
    </Card>
  );
}
