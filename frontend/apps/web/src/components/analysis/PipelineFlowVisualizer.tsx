'use client';

import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Play, X } from 'lucide-react';
import {
  PIPELINE_TIERS,
  getClassificationColors,
  getClassificationLabel,
  type PipelineTierData,
} from '@/lib/constants/pipeline';
import { PipelineExampleWalkthrough } from './PipelineExampleWalkthrough';

interface TierCardProps {
  tier: PipelineTierData;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function ClassificationBadge({ classification }: { classification: string }) {
  const colors = getClassificationColors(classification);
  const label = getClassificationLabel(classification);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {label}
    </span>
  );
}

function TierCard({ tier, isLast, isExpanded, onToggle }: TierCardProps) {
  return (
    <div className="flex flex-1 items-stretch group">
      <div className="flex flex-col flex-1 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden hover:border-[var(--color-primary)] transition-all">
        {/* Header */}
        <button
          onClick={onToggle}
          className="flex items-center justify-between gap-2 p-3 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-100)] transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded bg-[var(--color-primary)] text-white text-xs font-bold">
              T{tier.number}
            </span>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text)]">{tier.title}</h4>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
        </button>

        {/* Content */}
        <div className={`flex-1 ${isExpanded ? '' : 'hidden'}`}>
          {/* Description */}
          <div className="p-3 border-b border-[var(--color-neutral-100)]">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              {tier.description}
            </p>
          </div>

          {/* Inputs */}
          <div className="p-3 border-b border-[var(--color-neutral-100)]">
            <h5 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Inputs
            </h5>
            <ul className="space-y-1">
              {tier.inputs.map((input, i) => (
                <li key={i} className="text-xs text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-primary)]">•</span>{' '}
                  <span className="font-medium">{input.label}</span>
                  {input.description && (
                    <span className="text-[var(--color-text-muted)]"> - {input.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Outputs */}
          <div className="p-3 border-b border-[var(--color-neutral-100)]">
            <h5 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Outputs
            </h5>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)]">Classifications:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tier.outputs.classifications.map((classification) => (
                    <ClassificationBadge key={classification} classification={classification} />
                  ))}
                </div>
              </div>
              {tier.outputs.additionalOutputs.length > 0 && (
                <ul className="space-y-0.5">
                  {tier.outputs.additionalOutputs.map((output, i) => (
                    <li key={i} className="text-xs text-[var(--color-text-secondary)]">
                      <span className="text-[var(--color-success)]">+</span> {output}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Routing */}
          <div className="p-3">
            <h5 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Routing
            </h5>
            <div className="space-y-1.5">
              {tier.routing.map((route, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                    route.destination === 'STOP'
                      ? 'bg-[var(--color-neutral-50)]'
                      : 'bg-[var(--color-info-bg)]'
                  }`}
                >
                  <span className="text-[var(--color-text-secondary)]">
                    {route.condition}
                  </span>
                  <span
                    className={`font-medium ${
                      route.destination === 'STOP'
                        ? 'text-[var(--color-text-muted)]'
                        : 'text-[var(--color-info)]'
                    }`}
                  >
                    {route.destination === 'STOP' ? (
                      <>STOP {route.percentage && <span className="opacity-70">({route.percentage})</span>}</>
                    ) : (
                      <>→ {route.destination}</>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Collapsed Summary */}
        {!isExpanded && (
          <div className="p-3">
            <div className="flex flex-wrap gap-1">
              {tier.outputs.classifications.map((classification) => (
                <ClassificationBadge key={classification} classification={classification} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Arrow Connector */}
      {!isLast && (
        <div className="mx-2 flex items-center text-[var(--color-neutral-300)] group-hover:text-[var(--color-primary)] transition-colors hidden md:flex">
          <ArrowRight className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

export function PipelineFlowVisualizer() {
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set());
  const [showExample, setShowExample] = useState(false);

  const toggleTier = (tierNumber: number) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tierNumber)) {
        next.delete(tierNumber);
      } else {
        next.add(tierNumber);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTiers(new Set([1, 2, 3, 4]));
  };

  const collapseAll = () => {
    setExpandedTiers(new Set());
  };

  return (
    <div className="bg-[var(--color-neutral-50)]/50 border border-[var(--color-neutral-200)] rounded-[var(--radius-lg)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-neutral-200)] bg-white">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          How the Research Pipeline Works
        </h3>
        <div className="flex items-center gap-2">
          {!showExample && (
            <button
              onClick={expandedTiers.size === 4 ? collapseAll : expandAll}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {expandedTiers.size === 4 ? 'Collapse All' : 'Expand All'}
            </button>
          )}
          <button
            onClick={() => setShowExample(!showExample)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${
              showExample
                ? 'text-[var(--color-text-muted)] bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)]'
                : 'text-[var(--color-primary)] bg-[var(--color-primary-bg)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/10'
            }`}
          >
            {showExample ? (
              <>
                <X className="w-3 h-3" />
                Hide Example
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                See Example
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {showExample ? (
        <div className="p-4">
          <PipelineExampleWalkthrough onClose={() => setShowExample(false)} />
        </div>
      ) : (
        <div className="p-4">
          {/* Flow Diagram */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-0">
            {PIPELINE_TIERS.map((tier, index) => (
              <TierCard
                key={tier.number}
                tier={tier}
                isLast={index === PIPELINE_TIERS.length - 1}
                isExpanded={expandedTiers.has(tier.number)}
                onToggle={() => toggleTier(tier.number)}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-[var(--color-text-muted)] font-medium">Legend:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--color-info-bg)] border border-[var(--color-info)]/30" />
                <span className="text-[var(--color-text-secondary)]">Proceeds to next tier</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--color-success-bg)] border border-[var(--color-success)]/30" />
                <span className="text-[var(--color-text-secondary)]">Justified (terminal)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30" />
                <span className="text-[var(--color-text-secondary)]">Burdensome (terminal)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--color-neutral-100)] border border-[var(--color-neutral-300)]" />
                <span className="text-[var(--color-text-secondary)]">Dismissed/Unrelated</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PipelineFlowVisualizer;
