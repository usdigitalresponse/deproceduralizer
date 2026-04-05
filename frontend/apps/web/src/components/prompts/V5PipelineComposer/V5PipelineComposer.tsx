'use client';

import { useState, useTransition } from 'react';
import { Layers, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PipelineOverviewDiagram } from './PipelineOverviewDiagram';
import { IssueSelector } from './IssueSelector';
import { TierTabBar } from './TierTabBar';
import { ComposedPromptViewer } from './ComposedPromptViewer';
import { IssueMetadataPanel } from './IssueMetadataPanel';
import { TokenBreakdown } from './TokenBreakdown';
import { composePromptForTier, getIssueConfigByType, getResearchPipelinePrompts } from '@/lib/actions/research-pipeline';
import type { IssueTypeOption, TierNumber, IssueConfig, ComposedPrompt } from './types';
import type { TierPromptData } from '@/lib/actions/research-pipeline';

/** Lightweight viewer for the summary tier prompt (system + template only). */
function SummaryPromptViewer({ data, isLoading }: { data: TierPromptData; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 bg-[var(--color-neutral-200)] rounded" />
          <div className="h-24 bg-[var(--color-neutral-100)] rounded" />
          <div className="h-4 w-1/3 bg-[var(--color-neutral-200)] rounded" />
          <div className="h-24 bg-[var(--color-neutral-100)] rounded" />
        </div>
      </Card>
    );
  }

  /** Highlight {placeholders} in prompt text */
  function highlightPlaceholders(text: string) {
    return text.split(/(\{[^}]+\})/).map((part, i) =>
      part.startsWith('{') && part.endsWith('}')
        ? <span key={i} className="px-1 py-0.5 rounded bg-[var(--color-accent-muted)] text-[var(--color-warning)] font-mono text-xs">{part}</span>
        : <span key={i}>{part}</span>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Summary Generation Prompt</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        {data.description} {data.updated_at && <span className="ml-1">(updated {data.updated_at})</span>}
      </p>

      {data.static_core && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">System Prompt</h4>
          <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-secondary)] bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4 max-h-96 overflow-y-auto leading-relaxed">
            {highlightPlaceholders(data.static_core)}
          </pre>
        </div>
      )}

      {data.document_template && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Template (User Message)</h4>
          <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-secondary)] bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4 max-h-96 overflow-y-auto leading-relaxed">
            {highlightPlaceholders(data.document_template)}
          </pre>
        </div>
      )}
    </Card>
  );
}

interface V5PipelineComposerProps {
  issueTypes: IssueTypeOption[];
  className?: string;
}

export function V5PipelineComposer({ issueTypes, className = '' }: V5PipelineComposerProps) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<TierNumber>(1);
  const [composedPrompt, setComposedPrompt] = useState<ComposedPrompt | null>(null);
  const [issueConfig, setIssueConfig] = useState<IssueConfig | null>(null);
  const [summaryPromptData, setSummaryPromptData] = useState<TierPromptData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleIssueChange = (issueType: string) => {
    setSelectedIssue(issueType);
    setError(null);

    startTransition(async () => {
      if (activeTier === 'summary') {
        // Summary tier: load pipeline prompts and issue config
        const [pipelineResult, configResult] = await Promise.all([
          getResearchPipelinePrompts(),
          getIssueConfigByType(issueType),
        ]);
        if (!pipelineResult.success) { setError(pipelineResult.error); return; }
        if (!configResult.success) { setError(configResult.error); return; }
        setSummaryPromptData(pipelineResult.data.summary ?? null);
        setComposedPrompt(null);
        setIssueConfig(configResult.data);
      } else {
        // Load both the composed prompt and issue config
        const [promptResult, configResult] = await Promise.all([
          composePromptForTier(activeTier, issueType),
          getIssueConfigByType(issueType),
        ]);
        if (!promptResult.success) { setError(promptResult.error); return; }
        if (!configResult.success) { setError(configResult.error); return; }
        setComposedPrompt(promptResult.data);
        setSummaryPromptData(null);
        setIssueConfig(configResult.data);
      }
    });
  };

  const handleTierChange = (tier: TierNumber) => {
    setActiveTier(tier);
    if (!selectedIssue) return;

    setError(null);
    startTransition(async () => {
      if (tier === 'summary') {
        const result = await getResearchPipelinePrompts();
        if (!result.success) { setError(result.error); return; }
        setSummaryPromptData(result.data.summary ?? null);
        setComposedPrompt(null);
      } else {
        const result = await composePromptForTier(tier, selectedIssue);
        if (!result.success) { setError(result.error); return; }
        setComposedPrompt(result.data);
        setSummaryPromptData(null);
      }
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[var(--color-accent-muted)] rounded-[var(--radius-md)]">
            <Layers className="w-6 h-6 text-[var(--color-warning)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Compliance/Research Pipeline Prompt Composer
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Interactive view of the 3-tier progressive context disclosure system
            </p>
          </div>
        </div>

        {/* Pipeline Overview Diagram */}
        <PipelineOverviewDiagram activeTier={activeTier} />

        {/* Issue Selector */}
        <div className="mt-6">
          <IssueSelector
            issueTypes={issueTypes}
            selectedIssue={selectedIssue}
            onSelect={handleIssueChange}
            isLoading={isPending}
          />
        </div>
      </Card>

      {/* Main Content Area - Only show when issue is selected */}
      {selectedIssue && (
        <>
          {/* Tier Tab Bar */}
          <TierTabBar activeTier={activeTier} onChange={handleTierChange} />

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)]">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Composed Prompt Viewer (2/3 width) */}
            <div className="lg:col-span-2">
              {activeTier === 'summary' ? (
                summaryPromptData ? (
                  <SummaryPromptViewer data={summaryPromptData} isLoading={isPending} />
                ) : !isPending ? (
                  <Card>
                    <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
                      No summary prompt section found in research_pipeline.yaml.
                      The summary generation prompt will appear here once added by the backend pipeline.
                    </p>
                  </Card>
                ) : null
              ) : (
                <ComposedPromptViewer
                  composedPrompt={composedPrompt}
                  isLoading={isPending}
                />
              )}
            </div>

            {/* Issue Metadata Panel (1/3 width) */}
            <div className="lg:col-span-1">
              <IssueMetadataPanel
                issueConfig={issueConfig}
                isLoading={isPending}
              />
            </div>
          </div>

          {/* Token Breakdown */}
          {composedPrompt && (
            <TokenBreakdown composedPrompt={composedPrompt} />
          )}
        </>
      )}

      {/* Empty state when no issue selected */}
      {!selectedIssue && (
        <Card>
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
              Select an Issue Type
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
              Choose an issue type above to see how the research pipeline prompts are composed
              for each tier with progressive context disclosure.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
