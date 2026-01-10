'use client';

import { useState } from 'react';

// High-risk issue types that trigger T3
const HIGH_RISK_ISSUE_TYPES = [
  'wet_signature',
  'notarization',
  'in_person_appearance',
  'original_document',
];

interface RoutingDecisionProps {
  tier: 1 | 2 | 3;
  classification: string | null;
  // Tier 1 specific
  relevantMatchCount?: number;
  // Tier 2 specific
  severity?: number | null;
  issueType?: string;
  citesFederalStatute?: boolean;
  federalCitation?: string | null;
  claimsNoAlternative?: boolean;
  potentiallyControversial?: boolean;
  federalMandateSuspected?: boolean;
  needsWebSearch?: boolean;
  // Tier 3 specific
  evidenceGap?: boolean;
  // Outcome
  advancedToNextTier: boolean;
}

interface ConditionCheck {
  label: string;
  matched: boolean;
  detail?: string;
}

/**
 * RoutingDecision - Collapsible section explaining why pipeline advanced or stopped
 */
export function RoutingDecision({
  tier,
  classification,
  relevantMatchCount,
  severity,
  issueType,
  citesFederalStatute,
  federalCitation,
  claimsNoAlternative,
  potentiallyControversial,
  federalMandateSuspected,
  needsWebSearch,
  evidenceGap,
  advancedToNextTier,
}: RoutingDecisionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate routing explanation based on tier
  const getRoutingExplanation = (): { icon: string; message: string } => {
    if (tier === 1) {
      if (classification === 'all_false_positives') {
        return {
          icon: '⛔',
          message: 'Stopped: All matches were false positives',
        };
      }
      if (classification === 'needs_research') {
        return {
          icon: '➡️',
          message: `Advanced to T2: ${relevantMatchCount || 0} valid matches found requiring research`,
        };
      }
      return { icon: '❓', message: 'Classification incomplete' };
    }

    if (tier === 2) {
      if (advancedToNextTier) {
        return {
          icon: '➡️',
          message: 'Advanced to T3: Web verification required',
        };
      }
      return {
        icon: '⛔',
        message: `Stopped: Final classification at T2 (${classification || 'unknown'})`,
      };
    }

    if (tier === 3) {
      if (evidenceGap) {
        return {
          icon: '⚠️',
          message: `Final: Web search found no relevant evidence (${classification || 'unknown'})`,
        };
      }
      return {
        icon: '✅',
        message: `Final: Classification after web verification (${classification || 'unknown'})`,
      };
    }

    return { icon: '❓', message: 'Unknown tier' };
  };

  // Get conditions checked for Tier 2 routing
  const getTier2Conditions = (): ConditionCheck[] => {
    if (tier !== 2) return [];

    const isHighRisk = issueType && HIGH_RISK_ISSUE_TYPES.includes(issueType);
    const hasNoAlternativeWithSeverity = claimsNoAlternative && (severity ?? 0) >= 7;
    const isBurdensomeWithHighSeverity = classification === 'burdensome' && (severity ?? 0) >= 8;
    const isControversialJustified = potentiallyControversial && classification === 'justified';

    return [
      {
        label: 'High-risk issue type',
        matched: !!isHighRisk,
        detail: isHighRisk ? issueType : undefined,
      },
      {
        label: 'Federal statute cited',
        matched: !!citesFederalStatute,
        detail: federalCitation || undefined,
      },
      {
        label: 'Claims no alternative + severity ≥ 7',
        matched: !!hasNoAlternativeWithSeverity,
        detail: hasNoAlternativeWithSeverity ? `severity: ${severity}` : undefined,
      },
      {
        label: 'Burdensome + severity ≥ 8',
        matched: !!isBurdensomeWithHighSeverity,
        detail: isBurdensomeWithHighSeverity ? `severity: ${severity}` : undefined,
      },
      {
        label: 'Controversial justified',
        matched: !!isControversialJustified,
      },
      {
        label: 'Federal mandate suspected',
        matched: !!federalMandateSuspected,
      },
      {
        label: 'Needs web search flag',
        matched: !!needsWebSearch,
      },
    ];
  };

  const { icon, message } = getRoutingExplanation();
  const tier2Conditions = getTier2Conditions();

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-neutral-200)]">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className={`transform transition-transform duration-200 text-xs text-[var(--color-text-muted)] ${isExpanded ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Routing Decision
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span>{icon}</span>
          <span className={`${advancedToNextTier ? 'text-[var(--color-info)]' : 'text-[var(--color-text-muted)]'}`}>
            {advancedToNextTier ? 'Advanced' : 'Stopped'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 pl-4 space-y-3">
          {/* Main message */}
          <div className="text-sm text-[var(--color-text)]">
            {icon} {message}
          </div>

          {/* Tier 2 conditions checklist */}
          {tier === 2 && tier2Conditions.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-[var(--color-text-muted)]">
                Conditions checked:
              </span>
              <div className="space-y-1 pl-2">
                {tier2Conditions.map((condition, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs ${
                      condition.matched
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>{condition.matched ? '✅' : '❌'}</span>
                    <span>{condition.label}</span>
                    {condition.detail && (
                      <span className="text-[var(--color-text-secondary)]">
                        ({condition.detail})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier 3 evidence gap warning */}
          {tier === 3 && evidenceGap && (
            <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 rounded px-2 py-1.5 text-xs text-[var(--color-warning)]">
              ⚠️ Web search returned no relevant evidence for this regulation
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RoutingDecision;
