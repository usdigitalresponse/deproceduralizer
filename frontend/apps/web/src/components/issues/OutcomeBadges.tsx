'use client';

import { Badge, SeverityBadge } from '@/components/ui';
import { TierBadge } from './TierProgressIndicator';
import { ClassificationBadge } from './TierClassificationFlow';
import type { TierAnalysis } from '@deproceduralizer/database';

interface OutcomeBadgesProps {
  analysis: TierAnalysis | null;
  requirementFound: boolean | null;
  requiredByStatute: boolean | null;
  severity: number | null;
  originalSeverity: number | null;
  showTierBadge?: boolean;
  showFinalClassification?: boolean;
  showFederalMandate?: boolean;
  showEasyCleanup?: boolean;
  showSeverity?: boolean;
}

/** Terminal classifications worth displaying as the final verdict. */
const TERMINAL_CLASSIFICATIONS = new Set([
  'burdensome',
  'justified',
  'unrelated',
  'all_false_positives',
]);

function getFinalClassification(analysis: TierAnalysis): string | null {
  const classification =
    analysis.tier3Classification ??
    analysis.tier2Classification ??
    analysis.tier1Classification;
  if (classification && TERMINAL_CLASSIFICATIONS.has(classification)) {
    return classification;
  }
  return null;
}

/**
 * OutcomeBadges — Canonical component for compliance issue outcome display.
 *
 * Renders a consistent set of badges across Review Card, Detail Card, and Developer Card.
 * Each badge can be toggled via props; data availability is also checked automatically.
 */
export function OutcomeBadges({
  analysis,
  requirementFound,
  requiredByStatute,
  severity,
  originalSeverity,
  showTierBadge = true,
  showFinalClassification = true,
  showFederalMandate = true,
  showEasyCleanup = true,
  showSeverity = true,
}: OutcomeBadgesProps) {
  const finalClassification = analysis ? getFinalClassification(analysis) : null;

  return (
    <>
      {/* Final classification (burdensome/justified/unrelated/all_false_positives) */}
      {showFinalClassification && finalClassification && (
        <ClassificationBadge classification={finalClassification} />
      )}

      {/* LLM Confirmed / Rejected */}
      {requirementFound === true && (
        <Badge variant="success" className="text-xs">
          LLM Confirmed
        </Badge>
      )}
      {requirementFound === false && (
        <Badge variant="danger" className="text-xs">
          LLM Rejected
        </Badge>
      )}

      {/* From Statute */}
      {requiredByStatute && (
        <Badge variant="info" className="text-xs">
          From Statute
        </Badge>
      )}

      {/* Severity with override hint */}
      {showSeverity && severity !== null && (
        <span className="inline-flex items-center gap-1">
          <SeverityBadge severity={severity} />
          {originalSeverity !== null && originalSeverity !== severity && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              was {originalSeverity}
            </span>
          )}
        </span>
      )}

      {/* Tier badge */}
      {showTierBadge && analysis && (
        <TierBadge highestTierCompleted={analysis.highestTierCompleted} />
      )}

      {/* Federal mandate */}
      {showFederalMandate && analysis?.federalMandateFound && (
        <Badge variant="danger" className="text-xs">
          Federal Mandate
        </Badge>
      )}

      {/* Easy cleanup */}
      {showEasyCleanup && analysis?.easyCleanupCandidate && (
        <Badge variant="success" className="text-xs">
          {analysis.cleanupEffort === 'trivial' ? 'Easy Fix' : 'Fixable'}
        </Badge>
      )}
    </>
  );
}

export default OutcomeBadges;
