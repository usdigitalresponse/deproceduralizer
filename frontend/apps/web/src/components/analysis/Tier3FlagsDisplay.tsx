'use client';

import { useState } from 'react';
import type { Tier3Flags, EvidencedFlag } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { usePrintMode } from './PrintModeContext';

interface Tier3FlagsDisplayProps {
  flags: Tier3Flags;
  evidenceGap?: boolean;
}

interface FlagConfig {
  key: keyof Tier3Flags;
  labelTrue: string;
  labelFalse: string;
  variantTrue: 'danger' | 'success' | 'warning' | 'info';
  variantFalse: 'success' | 'danger' | 'default';
  icon: string;
}

const FLAG_CONFIGS: FlagConfig[] = [
  {
    key: 'federal_mandate_confirmed',
    labelTrue: 'Federal Mandate Confirmed',
    labelFalse: 'No Federal Mandate',
    variantTrue: 'danger',
    variantFalse: 'success',
    icon: '🏛️',
  },
  {
    key: 'state_discretion_found',
    labelTrue: 'State Has Discretion',
    labelFalse: 'No State Discretion',
    variantTrue: 'success',
    variantFalse: 'danger',
    icon: '🗽',
  },
  {
    key: 'superseded_by_law',
    labelTrue: 'Superseded by Law',
    labelFalse: 'Not Superseded',
    variantTrue: 'warning',
    variantFalse: 'default',
    icon: '📜',
  },
  {
    key: 'modernized_alternative_found',
    labelTrue: 'Modernized Alternative Found',
    labelFalse: 'No Modern Alternative',
    variantTrue: 'info',
    variantFalse: 'default',
    icon: '💡',
  },
];

/**
 * Tier3FlagsDisplay - Show structured V5 Tier 3 flags with evidence
 *
 * Displays badges for each flag (federal mandate, state discretion, etc.)
 * with expandable evidence sections showing sources and quotes.
 *
 * In print mode, all flags with evidence are expanded.
 */
export function Tier3FlagsDisplay({ flags, evidenceGap }: Tier3FlagsDisplayProps) {
  const { isPrintMode } = usePrintMode();
  const [expandedFlag, setExpandedFlag] = useState<keyof Tier3Flags | null>(null);

  const hasAnyFlag = FLAG_CONFIGS.some(config => flags[config.key]);

  if (!hasAnyFlag && !evidenceGap) {
    return null;
  }

  // Get all flags with evidence for print mode
  const flagsWithEvidence = FLAG_CONFIGS.filter(config => {
    const flag = flags[config.key];
    return flag && flag.evidence && flag.evidence.length > 0;
  });

  return (
    <div className="space-y-3">
      <h5 className="text-xs font-medium text-[var(--color-text-muted)]">
        Web Search Findings
      </h5>

      {/* Evidence gap warning */}
      {evidenceGap && (
        <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 rounded-[var(--radius-sm)] px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-[var(--color-warning)]">
            <span>⚠️</span>
            <span className="font-medium">Evidence Gap</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Web search did not find relevant evidence for this regulation. Classification based on available context.
          </p>
        </div>
      )}

      {/* Flag badges */}
      <div className="flex flex-wrap gap-2">
        {FLAG_CONFIGS.map(config => {
          const flag = flags[config.key];
          if (!flag) return null;

          const variant = flag.value ? config.variantTrue : config.variantFalse;
          const label = flag.value ? config.labelTrue : config.labelFalse;
          const hasEvidence = flag.evidence && flag.evidence.length > 0;

          // In print mode, render static badges without click handlers
          if (isPrintMode) {
            return (
              <Badge key={config.key} variant={variant}>
                <span className="mr-1">{config.icon}</span>
                {label}
              </Badge>
            );
          }

          return (
            <button
              key={config.key}
              type="button"
              onClick={() => setExpandedFlag(expandedFlag === config.key ? null : config.key)}
              className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 rounded"
            >
              <Badge
                variant={variant}
                className={`cursor-pointer ${hasEvidence ? 'pr-1' : ''}`}
              >
                <span className="mr-1">{config.icon}</span>
                {label}
                {hasEvidence && (
                  <span className="ml-1 opacity-70">
                    {expandedFlag === config.key ? '▼' : '▶'}
                  </span>
                )}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* In print mode, show all evidence panels */}
      {isPrintMode && flagsWithEvidence.map(config => (
        <FlagEvidencePanel
          key={config.key}
          flag={flags[config.key]!}
          flagKey={config.key}
        />
      ))}

      {/* In normal mode, show only the expanded flag's evidence */}
      {!isPrintMode && expandedFlag && flags[expandedFlag] && (
        <FlagEvidencePanel
          flag={flags[expandedFlag]!}
          flagKey={expandedFlag}
        />
      )}
    </div>
  );
}

interface FlagEvidencePanelProps {
  flag: EvidencedFlag;
  flagKey: keyof Tier3Flags;
}

function FlagEvidencePanel({ flag, flagKey }: FlagEvidencePanelProps) {
  const config = FLAG_CONFIGS.find(c => c.key === flagKey);

  return (
    <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3 space-y-3">
      {/* Reason */}
      <div>
        <span className="text-xs text-[var(--color-text-muted)]">Reason:</span>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {flag.reason}
        </p>
      </div>

      {/* Scope */}
      {flag.scope && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">Scope:</span>
          <Badge variant="default" className="text-xs">
            {flag.scope === 'reg-specific' ? 'Regulation-specific' : 'Issue type/Domain'}
          </Badge>
        </div>
      )}

      {/* Evidence sources */}
      {flag.evidence && flag.evidence.length > 0 && (
        <div>
          <span className="text-xs text-[var(--color-text-muted)]">
            Evidence ({flag.evidence.length} source{flag.evidence.length !== 1 ? 's' : ''}):
          </span>
          <div className="mt-2 space-y-2">
            {flag.evidence.map((source, idx) => (
              <div
                key={idx}
                className="bg-white border border-[var(--color-neutral-200)] rounded p-2 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  {source.source_type && <SourceTypeBadge type={source.source_type} />}
                  {/* URL may be in 'url' field or 'identifier' field depending on pipeline version */}
                  {(() => {
                    const sourceUrl = source.url || source.identifier;
                    if (!sourceUrl) return null;
                    let displayText = sourceUrl;
                    try {
                      displayText = new URL(sourceUrl).hostname;
                    } catch {
                      // Keep full URL if parsing fails
                    }
                    return (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] hover:underline truncate max-w-[300px]"
                      >
                        {displayText}
                      </a>
                    );
                  })()}
                </div>
                {source.quote && (
                  <blockquote className="border-l-2 border-[var(--color-neutral-300)] pl-2 text-[var(--color-text-secondary)] italic mt-1">
                    &ldquo;{source.quote}&rdquo;
                  </blockquote>
                )}
                <p className="text-[var(--color-text-muted)] mt-1">
                  {source.relevance}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    government: { label: 'Gov', color: 'var(--color-info)' },
    academic: { label: 'Academic', color: 'var(--color-primary)' },
    journalism: { label: 'News', color: 'var(--color-neutral-600)' },
    advocacy: { label: 'Advocacy', color: 'var(--color-warning)' },
  };

  const { label, color } = config[type] || { label: type, color: 'var(--color-neutral-500)' };

  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

export default Tier3FlagsDisplay;
