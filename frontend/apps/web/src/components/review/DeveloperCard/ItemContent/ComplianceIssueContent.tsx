import { Badge, SeverityBadge, Tag } from '@/components/ui';
import { ISSUE_TYPE_LABELS, formatLabel } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatNjacCitation } from '@/lib/formatters/njac';
import { HierarchyBreadcrumbsInline, RegulationTextViewer } from '../../shared';
import type { ComplianceIssueContentProps } from '../types';

export function ComplianceIssueContent({ item, state }: ComplianceIssueContentProps) {
  if (!item.complianceIssueData) return null;

  const issue = item.complianceIssueData;
  const citation = issue.state === 'NJ'
    ? formatNjacCitation(
        issue.regulation.njacTitle,
        issue.regulation.njacChapter,
        issue.regulation.njacSubchapter
      )
    : formatNycrrCitation(
        issue.regulation.nycrrTitle,
        issue.regulation.nycrrPart,
        issue.regulation.nycrrSection
      );

  return (
    <>
      {/* Header badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant="warning">{ISSUE_TYPE_LABELS[issue.issueType] || formatLabel(issue.issueType)}</Badge>
        {issue.requirementFound === true && <Badge variant="success" className="text-xs">LLM Confirmed</Badge>}
        {issue.requirementFound === false && <Badge variant="danger" className="text-xs">LLM Rejected</Badge>}
        {issue.requiredByStatute && <Badge variant="info" className="text-xs">From Statute</Badge>}
        {issue.severity !== null && <SeverityBadge severity={issue.severity} />}
      </div>

      {/* Hierarchy breadcrumb */}
      <div className="mb-1">
        <HierarchyBreadcrumbsInline
          documentId={issue.regulation.id}
          state={issue.state || state}
        />
      </div>

      {/* Regulation citation */}
      <div className="text-sm text-[var(--color-text-muted)] mb-4">
        {citation && <span className="font-mono">{citation}</span>}
        {citation && issue.regulation.title && ' - '}
        <span className="text-[var(--color-text-secondary)]">{issue.regulation.title}</span>
      </div>

      {/* LLM Analysis box */}
      {(issue.decisionRationale || (issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0)) && (
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

      {/* Full Regulation Text Viewer */}
      {(issue.regulation as unknown as { content?: string }).content && (
        <RegulationTextViewer
          content={(issue.regulation as unknown as { content: string }).content}
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
