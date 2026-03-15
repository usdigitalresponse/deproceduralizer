'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ReadabilityBadge } from './ReadabilityBadge';
import type { GuidanceDocumentDetail } from '@/lib/actions/guidance-documents';

interface ReadabilityMetricsCardProps {
  doc: GuidanceDocumentDetail;
}

function MetricRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between gap-2 py-1.5">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-medium text-[var(--color-text)]">
        {value !== null ? value.toFixed(1) : '--'}
      </span>
    </div>
  );
}

export function ReadabilityMetricsCard({ doc }: ReadabilityMetricsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (doc.wordCount === null) return null;

  const difficultPct = doc.difficultWordCount !== null && doc.wordCount > 0
    ? Math.round((doc.difficultWordCount / doc.wordCount) * 100)
    : null;

  return (
    <Card padding="lg">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <CardTitle>Readability Metrics</CardTitle>
        <div className="flex items-center gap-2">
          <ReadabilityBadge score={doc.fleschReadingEase} />
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="pt-4 space-y-4">
          {/* Consensus grade level */}
          {doc.readingGradeLevel && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Grade Level</span>
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {doc.readingGradeLevel}
              </span>
            </div>
          )}

          {/* Key metrics in a 2-column grid */}
          <div className="border-t border-[var(--color-neutral-100)] pt-3">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Detailed Scores</p>
            <div className="grid grid-cols-2 gap-x-4">
              <MetricRow label="FK Grade" value={doc.fleschKincaidGrade} />
              <MetricRow label="Gunning Fog" value={doc.gunningFog} />
              <MetricRow label="ARI" value={doc.automatedReadabilityIndex} />
              <MetricRow label="Coleman-Liau" value={doc.colemanLiauIndex} />
              <MetricRow label="SMOG" value={doc.smogIndex} />
              <MetricRow label="Dale-Chall" value={doc.daleChallReadabilityScore} />
              <MetricRow label="Linsear Write" value={doc.linsearWriteFormula} />
            </div>
          </div>

          {/* Word count, sentence count, difficult word % */}
          <div className="border-t border-[var(--color-neutral-100)] pt-3">
            <div className="flex justify-between py-1">
              <span className="text-xs text-[var(--color-text-muted)]">Words</span>
              <span className="text-xs font-medium text-[var(--color-text)]">
                {doc.wordCount?.toLocaleString() ?? '--'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-xs text-[var(--color-text-muted)]">Sentences</span>
              <span className="text-xs font-medium text-[var(--color-text)]">
                {doc.sentenceCount?.toLocaleString() ?? '--'}
              </span>
            </div>
            {difficultPct !== null && (
              <div className="flex justify-between py-1">
                <span className="text-xs text-[var(--color-text-muted)]">Difficult Words</span>
                <span className="text-xs font-medium text-[var(--color-text)]">
                  {doc.difficultWordCount?.toLocaleString()} ({difficultPct}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
