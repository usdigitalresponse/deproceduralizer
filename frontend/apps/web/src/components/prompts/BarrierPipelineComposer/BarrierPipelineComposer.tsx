'use client';

import { useState, useTransition } from 'react';
import { Cpu, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DocumentSearchSelector } from './DocumentSearchSelector';
import { BarrierComposedPromptViewer } from './BarrierComposedPromptViewer';
import { DocumentContextPanel } from './DocumentContextPanel';
import { BarrierTokenBreakdown } from './BarrierTokenBreakdown';
import { composeBarrierPrompt } from '@/lib/actions/barrier-prompt-composer';
import type { BarrierComposedPrompt } from './types';

interface BarrierPipelineComposerProps {
  className?: string;
}

export function BarrierPipelineComposer({ className = '' }: BarrierPipelineComposerProps) {
  const [composedPrompt, setComposedPrompt] = useState<BarrierComposedPrompt | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDocumentSelect = (documentId: number) => {
    setError(null);

    startTransition(async () => {
      const result = await composeBarrierPrompt(documentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComposedPrompt(result.data);
    });
  };

  return (
    <div id="barrier-composer" className={`space-y-6 ${className}`}>
      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[var(--color-accent-muted)] rounded-[var(--radius-md)]">
            <Cpu className="w-6 h-6 text-[var(--color-warning)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Barrier Pipeline Prompt Composer
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              View the fully assembled 3-layer prompt for any regulatory section, with real context from the database
            </p>
          </div>
        </div>

        {/* Document Search */}
        <DocumentSearchSelector
          onSelect={handleDocumentSelect}
          isLoading={isPending}
        />
      </Card>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)]">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Main Content Area */}
      {composedPrompt ? (
        <>
          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Composed Prompt Viewer (2/3 width) */}
            <div className="lg:col-span-2">
              <BarrierComposedPromptViewer
                composedPrompt={composedPrompt}
                isLoading={isPending}
              />
            </div>

            {/* Document Context Panel (1/3 width) */}
            <div className="lg:col-span-1">
              <DocumentContextPanel
                context={composedPrompt.context}
                isLoading={isPending}
              />
            </div>
          </div>

          {/* Token Breakdown */}
          <BarrierTokenBreakdown composedPrompt={composedPrompt} />
        </>
      ) : (
        !isPending && (
          <Card>
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
                Search for a Regulatory Section
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
                Search for a section above to see the fully composed Barrier analysis prompt with
                real hierarchy, definitions, sibling sections, and cross-reference context.
              </p>
            </div>
          </Card>
        )
      )}

      {/* Loading state when transitioning */}
      {isPending && !composedPrompt && (
        <BarrierComposedPromptViewer composedPrompt={null} isLoading />
      )}
    </div>
  );
}
