'use client';

import { Loader2, Database, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { LayerSection } from '@/components/prompts/shared/LayerSection';
import type { FinesComposedPrompt } from './types';

interface FinesComposedPromptViewerProps {
  composedPrompt: FinesComposedPrompt | null;
  isLoading?: boolean;
}

export function FinesComposedPromptViewer({
  composedPrompt,
  isLoading = false,
}: FinesComposedPromptViewerProps) {
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
          Search for a regulatory section to view its composed prompt
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-[var(--color-neutral-100)]">
        <h3 className="font-semibold text-[var(--color-text)]">
          Fines Extraction Prompt
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          2-layer architecture: system (static extraction rules) + template (per document)
        </p>
      </div>

      <div className="px-4 py-3 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)]">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-primary)]" />
            <span>System (static extraction rules)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-info)]" />
            <span>Template (per document)</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <LayerSection
          title="System (Extraction Rules)"
          icon={<Database className="w-4 h-4 text-[var(--color-primary)]" />}
          content={composedPrompt.layers.system.content}
          tokenEstimate={composedPrompt.layers.system.tokenEstimate}
          cacheStatus="Cached globally"
          colorClass="border-[var(--color-primary)]"
          bgClass="bg-[var(--color-primary-weaker)]"
          defaultExpanded
        />

        <LayerSection
          title="Document Template"
          icon={<FileText className="w-4 h-4 text-[var(--color-info)]" />}
          content={composedPrompt.layers.template.content}
          tokenEstimate={composedPrompt.layers.template.tokenEstimate}
          cacheStatus="Never cached (unique per document)"
          colorClass="border-[var(--color-info)]"
          bgClass="bg-[var(--color-info-bg)]"
          placeholders={composedPrompt.layers.template.placeholdersReplaced}
        />
      </div>
    </Card>
  );
}
