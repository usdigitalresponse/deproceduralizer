'use client';

import { ReactNode } from 'react';
import { Badge, ReviewStatusBadge, SeverityBadge, Tag, Button } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { highlightTerm, highlightContext } from '@/lib/utils/highlight';
import { TierBadge, TierProgressIndicator } from './TierProgressIndicator';
import { EvidenceDisplay } from './EvidenceDisplay';
import type { ContextEntry } from '@deproceduralizer/database';

/** Analysis data from the research pipeline */
interface IssueAnalysis {
  highestTierCompleted: number;
  tier1Classification?: string | null;
  tier2Classification?: string | null;
  tier3Classification?: string | null;
  tier4Classification?: string | null;
  finalSeverity?: number | null;
  verbatimRequirements?: string[];
  argumentForRegulation?: string | null;
  argumentAgainstRegulation?: string | null;
  contextUsed?: ContextEntry[] | null;
  webSearchSummary?: string | null;
  federalMandateFound?: boolean;
  stateHasDiscretion?: boolean;
  isJustified?: boolean;
  pipelineVersion?: string;
  // V5.1: Easy Cleanup Detection
  easyCleanupCandidate?: boolean;
  cleanupType?: string | null;
  cleanupEffort?: string | null;
}

interface ComplianceIssueDisplayCardProps {
  /** The compliance issue data to display */
  issue: {
    issueType: string;
    requirementFound: boolean | null;
    requiredByStatute: boolean | null;
    reviewStatus: string | null;
    // Legacy columns (backwards compatibility)
    matchedPattern?: string | null;
    matchedContext: string;
    requirementText?: string | null;
    impactAssessment?: string | null;
    // New columns (research pipeline)
    regexMatchPattern: string | null;
    regexMatchContext: string | null;
    verbatimSupportingText: string[] | null;
    isVerbatim: boolean | null;
    severity: number | null;
    decisionRationale: string | null;
    statuteCitation: string | null;
    analysis?: IssueAnalysis | null;
  };
  /** Whether to show the review status badge in the header */
  showReviewStatus?: boolean;
  /** Expanded context configuration */
  expandedContext?: {
    isExpanded: boolean;
    expandedText: string | null;
    canExpand: boolean;
    onToggle: () => void;
  };
  /** Optional content to render at the bottom (e.g., review form) */
  children?: ReactNode;
}

/**
 * Display component for a single compliance issue.
 * Uses consistent styling with the review queue - blue LLM Analysis section.
 * Used by ComplianceIssuesList for consistent issue rendering.
 */
export function ComplianceIssueDisplayCard({
  issue,
  showReviewStatus = true,
  expandedContext,
  children,
}: ComplianceIssueDisplayCardProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
  const isExpanded = expandedContext?.isExpanded ?? false;
  const canExpand = expandedContext?.canExpand ?? false;
  const expandedText = expandedContext?.expandedText;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-neutral-200)] p-4 rounded-[var(--radius-md)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="warning" className="font-semibold">
            {issueTypeLabel}
          </Badge>
          {issue.requirementFound === true && (
            <Badge variant="success" className="text-xs">
              LLM Confirmed
            </Badge>
          )}
          {issue.requirementFound === false && (
            <Badge variant="danger" className="text-xs">
              LLM Rejected
            </Badge>
          )}
          {issue.requiredByStatute && (
            <Badge variant="info" className="text-xs">
              From Statute
            </Badge>
          )}
          {issue.severity !== null && (
            <SeverityBadge severity={issue.severity} />
          )}
          {issue.analysis && (
            <TierBadge highestTierCompleted={issue.analysis.highestTierCompleted} />
          )}
          {issue.analysis?.federalMandateFound && (
            <Badge variant="danger" className="text-xs">
              Federal Mandate
            </Badge>
          )}
          {issue.analysis?.easyCleanupCandidate && (
            <Badge variant="success" className="text-xs">
              {issue.analysis.cleanupEffort === 'trivial' ? '🎯 Easy Fix' : '✨ Fixable'}
            </Badge>
          )}
        </div>
        {showReviewStatus && issue.reviewStatus && (
          <ReviewStatusBadge status={issue.reviewStatus} />
        )}
      </div>

      {/* LLM Analysis - Primary content, always visible (matching review queue style) */}
      {((issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0) || issue.decisionRationale) && (
        <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border border-[var(--color-primary)]/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-[var(--color-primary)]">LLM Analysis</span>
            {issue.isVerbatim !== null && (
              <Badge
                variant={issue.isVerbatim ? 'info' : 'default'}
                className="text-[10px] py-0 px-1.5"
              >
                {issue.isVerbatim ? 'Verbatim Quote' : 'Paraphrased'}
              </Badge>
            )}
          </div>

          {/* Verbatim Supporting Text - the key finding(s) */}
          {issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0 && (
            <div className="mb-3 space-y-2">
              {issue.verbatimSupportingText.map((text, index) => (
                <p key={index} className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                  {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">"</span>}
                  {highlightTerm(text, issue.regexMatchPattern)}
                  {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">"</span>}
                </p>
              ))}
            </div>
          )}

          {/* Decision Rationale */}
          {issue.decisionRationale && (
            <div className="pt-3 border-t border-[var(--color-primary)]/10">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Decision Rationale:</span>
              <p className="mt-1 text-sm text-[var(--color-text)]">{issue.decisionRationale}</p>
            </div>
          )}

          {/* Statute Citation */}
          {issue.statuteCitation && (
            <div className="pt-3 border-t border-[var(--color-primary)]/10">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Statute Citation:</span>
              <p className="mt-1 text-sm font-mono text-[var(--color-text)]">{issue.statuteCitation}</p>
            </div>
          )}
        </div>
      )}

      {/* Research Evidence (compact) */}
      {issue.analysis?.contextUsed && issue.analysis.contextUsed.length > 0 && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1 flex items-center gap-2">
            Research Evidence
            <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-neutral-200)] px-1.5 py-0.5 rounded">
              {issue.analysis.contextUsed.length} sources
            </span>
          </summary>
          <div className="mt-2">
            <EvidenceDisplay
              contextUsed={issue.analysis.contextUsed}
              verbatimRequirements={issue.analysis.verbatimRequirements}
              compact
            />
          </div>
        </details>
      )}

      {/* Analysis Details (compact) */}
      {issue.analysis && (issue.analysis.argumentForRegulation || issue.analysis.argumentAgainstRegulation) && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1 flex items-center gap-2">
            Analysis Details
            <TierProgressIndicator
              highestTierCompleted={issue.analysis.highestTierCompleted}
              tier1Classification={issue.analysis.tier1Classification}
              tier2Classification={issue.analysis.tier2Classification}
              tier3Classification={issue.analysis.tier3Classification}
              tier4Classification={issue.analysis.tier4Classification}
              compact
            />
          </summary>
          <div className="mt-2 space-y-2">
            {issue.analysis.argumentForRegulation && (
              <div className="p-2 bg-[var(--color-success-bg)] rounded-[var(--radius-sm)] border-l-2 border-[var(--color-success)]">
                <span className="text-xs font-medium text-[var(--color-success)]">For: </span>
                <span className="text-xs text-[var(--color-text-secondary)]">{issue.analysis.argumentForRegulation}</span>
              </div>
            )}
            {issue.analysis.argumentAgainstRegulation && (
              <div className="p-2 bg-[var(--color-danger-bg)] rounded-[var(--radius-sm)] border-l-2 border-[var(--color-danger)]">
                <span className="text-xs font-medium text-[var(--color-danger)]">Against: </span>
                <span className="text-xs text-[var(--color-text-secondary)]">{issue.analysis.argumentAgainstRegulation}</span>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Context expansion (if available) */}
      {(canExpand || isExpanded) && expandedContext?.onToggle && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={expandedContext.onToggle}
            className="text-xs"
          >
            {isExpanded ? 'Hide Full Section' : 'View Full Section'}
          </Button>
        </div>
      )}

      {/* Expanded Section Text */}
      {isExpanded && expandedText && (
        <div className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
            {highlightContext(expandedText, issue.verbatimSupportingText?.[0] || issue.regexMatchContext || issue.matchedContext, issue.regexMatchPattern ?? issue.matchedPattern ?? null)}
          </p>
        </div>
      )}

      {/* Technical Details - collapsible (regex pattern only) */}
      {(issue.regexMatchPattern || issue.matchedPattern) && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1">
            Technical Details
          </summary>
          <div className="mt-2 pl-2 border-l-2 border-[var(--color-neutral-200)]">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Pattern matched:</span>
            <div className="mt-1">
              <Tag variant="warning" size="sm">
                {issue.regexMatchPattern ?? issue.matchedPattern}
              </Tag>
            </div>
          </div>
        </details>
      )}

      {/* Original Match Context (collapsible, only if different from verbatimSupportingText) */}
      {(() => {
        const matchContext = issue.regexMatchContext ?? issue.matchedContext;
        const matchPattern = issue.regexMatchPattern ?? issue.matchedPattern ?? null;
        return issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0 && matchContext && issue.verbatimSupportingText[0] !== matchContext && (
          <details className="mb-3">
            <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1">
              Original Match Context
            </summary>
            <div className="mt-2 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-2 border-[var(--color-neutral-300)]">
              <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
                {highlightTerm(matchContext, matchPattern)}
              </p>
            </div>
          </details>
        );
      })()}

      {/* Children slot (typically review form) */}
      {children}
    </div>
  );
}

export default ComplianceIssueDisplayCard;
