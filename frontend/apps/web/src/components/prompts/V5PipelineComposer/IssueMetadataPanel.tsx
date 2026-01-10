'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, TrendingUp, TrendingDown, BarChart3, Code, FileText, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { IssueConfig } from './types';

interface IssueMetadataPanelProps {
  issueConfig: IssueConfig | null;
  isLoading?: boolean;
}

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function AccordionSection({
  title,
  icon,
  badge,
  children,
  defaultExpanded = false,
}: AccordionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-[var(--color-neutral-100)] last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-neutral-50)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
          {icon}
          <span className="font-medium text-[var(--color-text)]">{title}</span>
        </div>
        {badge}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function IssueMetadataPanel({
  issueConfig,
  isLoading = false,
}: IssueMetadataPanelProps) {
  if (isLoading) {
    return (
      <Card padding="none">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      </Card>
    );
  }

  if (!issueConfig) {
    return (
      <Card padding="none">
        <div className="text-center py-16 text-sm text-[var(--color-text-muted)]">
          Select an issue type to view metadata
        </div>
      </Card>
    );
  }

  const exampleCounts = {
    truePositives: issueConfig.examples.true_positives.length,
    falsePositives: issueConfig.examples.false_positives.length,
    justified: issueConfig.examples.justified.length,
  };

  return (
    <Card padding="none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-neutral-100)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">
            {issueConfig.category}
          </span>
        </div>
        <h3 className="font-semibold text-[var(--color-text)]">
          {issueConfig.display_name}
        </h3>
      </div>

      {/* Accordion Sections */}
      <div>
        {/* Positive Indicators */}
        <AccordionSection
          title="Positive Indicators"
          icon={<CheckCircle className="w-4 h-4 text-[var(--color-success)]" />}
          badge={
            <span className="text-xs px-2 py-0.5 bg-[var(--color-success-bg)] text-[var(--color-success)] rounded">
              {issueConfig.positive_indicators.length}
            </span>
          }
          defaultExpanded
        >
          <ul className="space-y-1.5">
            {issueConfig.positive_indicators.map((indicator, i) => (
              <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                <span className="text-[var(--color-success)] mt-1 flex-shrink-0">+</span>
                <span>{indicator}</span>
              </li>
            ))}
          </ul>
        </AccordionSection>

        {/* Negative Indicators */}
        <AccordionSection
          title="Negative Indicators"
          icon={<XCircle className="w-4 h-4 text-[var(--color-danger)]" />}
          badge={
            <span className="text-xs px-2 py-0.5 bg-[var(--color-danger-bg)] text-[var(--color-danger)] rounded">
              {issueConfig.negative_indicators.length}
            </span>
          }
        >
          <ul className="space-y-1.5">
            {issueConfig.negative_indicators.map((indicator, i) => (
              <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                <span className="text-[var(--color-danger)] mt-1 flex-shrink-0">-</span>
                <span>{indicator}</span>
              </li>
            ))}
          </ul>
        </AccordionSection>

        {/* Severity */}
        <AccordionSection
          title="Severity Scoring"
          icon={<BarChart3 className="w-4 h-4 text-[var(--color-warning)]" />}
          badge={
            <span className="text-xs px-2 py-0.5 bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded">
              Base: {issueConfig.severity_baseline}
            </span>
          }
        >
          <div className="space-y-3">
            <div className="text-sm">
              <strong>Baseline:</strong> {issueConfig.severity_baseline} / 10
            </div>
            {issueConfig.severity_modifiers.increases.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-sm font-medium text-[var(--color-danger)] mb-1">
                  <TrendingUp className="w-3 h-3" />
                  Increases
                </div>
                <ul className="space-y-1">
                  {issueConfig.severity_modifiers.increases.map((mod, i) => (
                    <li key={i} className="text-sm text-[var(--color-text-secondary)] pl-4">
                      {mod}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {issueConfig.severity_modifiers.decreases.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-sm font-medium text-[var(--color-success)] mb-1">
                  <TrendingDown className="w-3 h-3" />
                  Decreases
                </div>
                <ul className="space-y-1">
                  {issueConfig.severity_modifiers.decreases.map((mod, i) => (
                    <li key={i} className="text-sm text-[var(--color-text-secondary)] pl-4">
                      {mod}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* Examples */}
        <AccordionSection
          title="Examples"
          icon={<FileText className="w-4 h-4 text-[var(--color-primary)]" />}
          badge={
            <span className="text-xs text-[var(--color-text-muted)]">
              {exampleCounts.truePositives + exampleCounts.falsePositives + exampleCounts.justified} total
            </span>
          }
        >
          <div className="space-y-4">
            {/* True Positives */}
            {exampleCounts.truePositives > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--color-success)] mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  True Positives ({exampleCounts.truePositives})
                </h4>
                <div className="space-y-2">
                  {issueConfig.examples.true_positives.slice(0, 2).map((ex, i) => (
                    <div key={i} className="text-xs p-2 bg-[var(--color-success-bg)] rounded-[var(--radius-sm)]">
                      <div className="font-medium text-[var(--color-text)]">{ex.citation}</div>
                      <div className="text-[var(--color-text-secondary)] italic mt-1">&quot;{ex.quote}&quot;</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* False Positives */}
            {exampleCounts.falsePositives > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--color-danger)] mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  False Positives ({exampleCounts.falsePositives})
                </h4>
                <div className="space-y-2">
                  {issueConfig.examples.false_positives.slice(0, 2).map((ex, i) => (
                    <div key={i} className="text-xs p-2 bg-[var(--color-danger-bg)] rounded-[var(--radius-sm)]">
                      <div className="font-medium text-[var(--color-text)]">{ex.citation}</div>
                      <div className="text-[var(--color-text-secondary)] italic mt-1">&quot;{ex.quote}&quot;</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Justified */}
            {exampleCounts.justified > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--color-warning)] mb-2">
                  Justified ({exampleCounts.justified})
                </h4>
                <div className="space-y-2">
                  {issueConfig.examples.justified.slice(0, 2).map((ex, i) => (
                    <div key={i} className="text-xs p-2 bg-[var(--color-warning-bg)] rounded-[var(--radius-sm)]">
                      <div className="font-medium text-[var(--color-text)]">{ex.citation}</div>
                      <div className="text-[var(--color-text-secondary)] italic mt-1">&quot;{ex.quote}&quot;</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* Statistics */}
        <AccordionSection
          title="Statistics"
          icon={<BarChart3 className="w-4 h-4 text-[var(--color-info)]" />}
          badge={
            <span className={`text-xs px-2 py-0.5 rounded ${
              issueConfig.statistics.true_positive_rate >= 70
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                : issueConfig.statistics.true_positive_rate >= 40
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
            }`}>
              {issueConfig.statistics.true_positive_rate.toFixed(0)}% precision
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-sm)]">
              <div className="text-lg font-bold text-[var(--color-text)]">
                {issueConfig.statistics.total_matches.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Total Matches</div>
            </div>
            <div className="p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-sm)]">
              <div className="text-lg font-bold text-[var(--color-success)]">
                {issueConfig.statistics.true_positives.toLocaleString()}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">True Positives</div>
            </div>
          </div>
          {issueConfig.statistics.sample_date && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Sample date: {issueConfig.statistics.sample_date}
            </p>
          )}
        </AccordionSection>

        {/* Detection Patterns */}
        <AccordionSection
          title="Detection Patterns"
          icon={<Code className="w-4 h-4 text-[var(--color-text-muted)]" />}
          badge={
            <span className="text-xs text-[var(--color-text-muted)]">
              {issueConfig.patterns.length} patterns
            </span>
          }
        >
          <div className="space-y-2">
            {issueConfig.patterns.map((pattern, i) => (
              <code
                key={i}
                className="block text-xs p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-sm)] font-mono text-[var(--color-text)]"
              >
                {pattern}
              </code>
            ))}
          </div>
        </AccordionSection>
      </div>
    </Card>
  );
}
