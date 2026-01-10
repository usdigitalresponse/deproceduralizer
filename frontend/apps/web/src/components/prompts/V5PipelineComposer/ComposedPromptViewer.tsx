'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Loader2, Database, Zap, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Layers } from 'lucide-react';
import type { ComposedPrompt } from '@/lib/actions/research-pipeline';

interface ComposedPromptViewerProps {
  composedPrompt: ComposedPrompt | null;
  isLoading?: boolean;
}

interface LayerSectionProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  tokenEstimate: number;
  cacheStatus: string;
  colorClass: string;
  bgClass: string;
  placeholders?: string[];
  defaultExpanded?: boolean;
}

/**
 * Highlights placeholder variables in content using React elements
 */
function HighlightedContent({ content }: { content: string }) {
  const parts = useMemo(() => {
    const regex = /(\{[\w_]+\})/g;
    const segments: Array<{ text: string; isPlaceholder: boolean }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: content.slice(lastIndex, match.index), isPlaceholder: false });
      }
      segments.push({ text: match[1], isPlaceholder: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      segments.push({ text: content.slice(lastIndex), isPlaceholder: false });
    }

    return segments;
  }, [content]);

  return (
    <pre className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-mono leading-relaxed">
      {parts.map((part, i) =>
        part.isPlaceholder ? (
          <span
            key={i}
            className="text-[var(--color-info)] font-medium bg-[var(--color-info-bg)] px-1 rounded"
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </pre>
  );
}

function LayerSection({
  title,
  icon,
  content,
  tokenEstimate,
  cacheStatus,
  colorClass,
  bgClass,
  placeholders = [],
  defaultExpanded = false,
}: LayerSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = content.split('\n').length;

  return (
    <div className={`border-l-4 ${colorClass} rounded-[var(--radius-md)] overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${bgClass} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
          )}
          {icon}
          <div className="text-left">
            <span className="font-medium text-[var(--color-text)]">{title}</span>
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              {cacheStatus}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            ~{tokenEstimate.toLocaleString()} tokens
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {lineCount} lines
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-white rounded-[var(--radius-sm)] shadow-sm transition-colors z-10"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-[var(--color-success)]" />
            ) : (
              <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
            )}
          </button>

          {placeholders.length > 0 && (
            <div className="px-4 py-2 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-100)] flex flex-wrap gap-1.5">
              <span className="text-xs text-[var(--color-text-muted)]">Placeholders:</span>
              {placeholders.map((p) => (
                <span
                  key={p}
                  className="text-xs px-2 py-0.5 bg-[var(--color-info-bg)] text-[var(--color-info)] rounded"
                >
                  {'{' + p + '}'}
                </span>
              ))}
            </div>
          )}

          <div className="p-4 bg-[var(--color-neutral-50)] max-h-[500px] overflow-y-auto">
            <HighlightedContent content={content} />
          </div>
        </div>
      )}
    </div>
  );
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
