'use client';

import { useState, useTransition } from 'react';
import { DollarSign, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { DocumentSearchSelector } from '../JenAIPipelineComposer/DocumentSearchSelector';
import { FinesComposedPromptViewer } from './FinesComposedPromptViewer';
import { FinesContextPanel } from './FinesContextPanel';
import { FinesTokenBreakdown } from './FinesTokenBreakdown';
import { composeFinesPrompt } from '@/lib/actions/fines-prompt-composer';
import type { FinesComposedPrompt } from './types';

interface FinesPipelineComposerProps {
  className?: string;
}

export function FinesPipelineComposer({ className = '' }: FinesPipelineComposerProps) {
  const [composedPrompt, setComposedPrompt] = useState<FinesComposedPrompt | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDocumentSelect = (documentId: number) => {
    setError(null);

    startTransition(async () => {
      const result = await composeFinesPrompt(documentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComposedPrompt(result.data);
    });
  };

  return (
    <div id="fines-composer" className={`space-y-6 ${className}`}>
      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[var(--color-accent-muted)] rounded-[var(--radius-md)]">
            <DollarSign className="w-6 h-6 text-[var(--color-warning)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Fines Pipeline Prompt Composer
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              View the fully assembled 2-layer prompt for fines/fees extraction, with real context from the database
            </p>
          </div>
        </div>

        {/* Document Search - reuse JenAI's DocumentSearchSelector */}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <FinesComposedPromptViewer
                composedPrompt={composedPrompt}
                isLoading={isPending}
              />
            </div>
            <div className="lg:col-span-1">
              <FinesContextPanel
                context={composedPrompt.context}
                isLoading={isPending}
              />
            </div>
          </div>

          <FinesTokenBreakdown composedPrompt={composedPrompt} />
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
                Search for a section above to see the fully composed fines extraction prompt with
                real document metadata and regulation context.
              </p>
            </div>
          </Card>
        )
      )}

      {isPending && !composedPrompt && (
        <FinesComposedPromptViewer composedPrompt={null} isLoading />
      )}
    </div>
  );
}
