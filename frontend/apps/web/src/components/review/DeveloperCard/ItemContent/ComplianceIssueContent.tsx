import { Badge, Tag } from '@/components/ui';
import { ISSUE_TYPE_LABELS, formatLabel } from '@/types/regulation';
import { formatStateCitation } from '@/lib/formatters/citations';
import { OutcomeBadges } from '@/components/issues/OutcomeBadges';
import { DecisionRationale } from '@/components/issues/DecisionRationale';
import { HierarchyBreadcrumbsInline, LazyDocumentTextViewer } from '../../shared';
import type { ComplianceIssueContentProps } from '../types';

export function ComplianceIssueContent({ item, state }: ComplianceIssueContentProps) {
  if (!item.complianceIssueData) return null;

  const issue = item.complianceIssueData;
  const isGuidance = !!item.guidance;
  const citation = formatStateCitation(issue.jurisdiction || state, issue.regulation);

  return (
    <>
      {/* Header badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant="warning">{ISSUE_TYPE_LABELS[issue.issueType] || formatLabel(issue.issueType)}</Badge>
        <OutcomeBadges
          analysis={issue.analysis}
          requirementFound={issue.requirementFound}
          requiredByStatute={issue.requiredByStatute}
          severity={issue.severity}
          originalSeverity={issue.originalSeverity}
          showTierBadge
          showFinalClassification
          showFederalMandate
          showEasyCleanup={false}
          showSeverity
        />
      </div>

      {/* Review Summary — highest-value quick triage text */}
      {issue.analysis?.reviewSummary && (
        <div className="mb-3 pl-3 border-l-[3px] border-[var(--color-neutral-200)]">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {issue.analysis.reviewSummary}
          </p>
        </div>
      )}

      {/* Guidance document context */}
      {isGuidance && item.guidance && (
        <div className="bg-[var(--color-warning-bg)] rounded p-2 mb-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {item.guidance.agency && <span className="text-xs font-medium text-[var(--color-text-secondary)]">{item.guidance.agency}</span>}
            {item.guidance.docType && <Badge variant="default" className="text-xs">{item.guidance.docType}</Badge>}
            {item.guidance.year && <span className="text-xs text-[var(--color-text-muted)]">{item.guidance.year}</span>}
          </div>
          {item.guidance.title && <p className="text-sm text-[var(--color-text)]">{item.guidance.title}</p>}
        </div>
      )}

      {/* Hierarchy breadcrumb (only for regulation-sourced issues) */}
      {!isGuidance && (
        <div className="mb-1">
          <HierarchyBreadcrumbsInline
            documentId={issue.regulation.id}
            state={issue.jurisdiction || state}
          />
        </div>
      )}

      {/* Regulation citation (only for regulation-sourced issues) */}
      {!isGuidance && (
        <div className="text-sm text-[var(--color-text-muted)] mb-4">
          {citation && <span className="font-mono">{citation}</span>}
          {citation && issue.regulation.title && ' - '}
          <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
        </div>
      )}

      {/* LLM Analysis box */}
      {(issue.tier1Reasoning || issue.tier2Reasoning || issue.tier3Reasoning || (issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0)) && (
        <div className="mb-4 p-4 bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border border-[var(--color-primary)]/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-[var(--color-primary)]">LLM Analysis</span>
            {issue.isVerbatim !== null && (
              <Badge
                variant={issue.isVerbatim ? 'info' : 'default'}
                className="text-xs"
              >
                {issue.isVerbatim ? 'Verbatim Quote' : 'Paraphrased'}
              </Badge>
            )}
          </div>

          {/* Verbatim Supporting Text */}
          {issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0 && (
            <div className="mb-3 space-y-2">
              {issue.verbatimSupportingText.map((text, index) => (
                <p key={index} className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                  {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">&quot;</span>}
                  {text}
                  {issue.isVerbatim && <span className="text-[var(--color-text-muted)]">&quot;</span>}
                </p>
              ))}
            </div>
          )}

          <DecisionRationale
            tier1Reasoning={issue.tier1Reasoning}
            tier2Reasoning={issue.tier2Reasoning}
            tier3Reasoning={issue.tier3Reasoning}
          />

          {/* Statute Citation */}
          {issue.statuteCitation && (
            <div className="pt-3 border-t border-[var(--color-primary)]/10">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Statute Citation:</span>
              <p className="mt-1 text-sm font-mono text-[var(--color-text)]">{issue.statuteCitation}</p>
            </div>
          )}
        </div>
      )}

      {/* Full Regulation Text Viewer (lazy-loaded for list views) */}
      {!isGuidance && (
        <LazyDocumentTextViewer
          documentId={issue.regulation.id}
          state={state}
          scrollToText={issue.verbatimSupportingText?.[0]}
          highlightPattern={issue.regexMatchPattern}
          isVerbatim={issue.isVerbatim ?? false}
          label="Show Regulation Text"
        />
      )}

      {/* Technical Details (collapsible) */}
      {issue.regexMatchPattern && (
        <details className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] group">
          <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Technical Details
          </summary>
          <div className="mt-3 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Pattern matched:</span>
            <div className="mt-1">
              <Tag variant="warning" size="sm">{issue.regexMatchPattern}</Tag>
            </div>
          </div>
        </details>
      )}
    </>
  );
}
