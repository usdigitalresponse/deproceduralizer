'use client';

import { forwardRef } from 'react';
import { usePathname } from 'next/navigation';
import { CopyLinkButton } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { formatStateCitation } from '@/lib/formatters/citations';
import { CardWrapper } from '../shared';
import { getStateFromPathname } from '@/hooks/useStateFromPath';
import { Header } from './Header';
import { TierClassificationSection } from './TierClassificationSection';
import { SummaryContext } from './SummaryContext';
import { LLMAnalysisSection } from './LLMAnalysisSection';
import { EvidenceSection } from './EvidenceSection';
import { AnalysisDetailsSection } from './AnalysisDetailsSection';
import { RegulationActions } from './RegulationActions';
import { TechnicalDetailsSection } from './TechnicalDetailsSection';
import { ReviewForm } from './ReviewForm';
import type { ComplianceIssueCardProps } from './types';

export const ComplianceIssueCard = forwardRef<HTMLDivElement, ComplianceIssueCardProps>(
  ({ issue, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    const pathname = usePathname();
    const stateCode = getStateFromPathname(pathname);

    const citation = formatStateCitation(issue.state, issue.regulation);

    const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;

    return (
      <CardWrapper
        ref={ref}
        id={`compliance-${issue.id}`}
        isFocused={isFocused}
        data-testid="compliance-issue-card"
      >
        {/* Header with copy link button */}
        <div className="flex items-start gap-3 mb-4">
          <CopyLinkButton anchor={`compliance-${issue.id}`} />
          <div className="flex-1">
            <Header issue={issue} issueTypeLabel={issueTypeLabel} />
          </div>
        </div>

        {/* Tier Classification Flow */}
        {issue.analysis && (
          <TierClassificationSection analysis={issue.analysis} />
        )}

        {/* Summary context, breadcrumbs, and citation */}
        <SummaryContext
          regulation={issue.regulation}
          state={issue.state ?? 'nj'}
          citation={citation ?? ''}
        />

        {/* LLM Analysis */}
        <LLMAnalysisSection
          decisionRationale={issue.decisionRationale}
          verbatimSupportingText={issue.verbatimSupportingText}
          isVerbatim={issue.isVerbatim}
          statuteCitation={issue.statuteCitation}
        />

        {/* Evidence from Research Pipeline */}
        {issue.analysis?.contextUsed && issue.analysis.contextUsed.length > 0 && (
          <EvidenceSection
            contextUsed={issue.analysis.contextUsed}
            verbatimRequirements={issue.analysis.verbatimRequirements ?? undefined}
          />
        )}

        {/* Analysis Details - Steelman Arguments */}
        {issue.analysis && (
          <AnalysisDetailsSection analysis={issue.analysis} />
        )}

        {/* Regulation Actions */}
        <RegulationActions
          regulation={issue.regulation}
          stateCode={stateCode}
          verbatimSupportingText={issue.verbatimSupportingText}
          regexMatchPattern={issue.regexMatchPattern}
          isVerbatim={issue.isVerbatim}
        />

        {/* Technical Details */}
        {issue.regexMatchPattern && (
          <TechnicalDetailsSection regexMatchPattern={issue.regexMatchPattern} />
        )}

        {/* Review Form */}
        <ReviewForm issue={issue} onUpdated={onUpdated} />
      </CardWrapper>
    );
  }
);

ComplianceIssueCard.displayName = 'ComplianceIssueCard';
