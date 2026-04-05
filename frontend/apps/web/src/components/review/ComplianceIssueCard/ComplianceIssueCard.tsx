'use client';

import { forwardRef } from 'react';
import { usePathname } from 'next/navigation';
import { CopyLinkButton, ReviewSummaryText } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { formatStateCitation } from '@/lib/formatters/citations';
import { CardWrapper } from '../shared';
import { getJurisdictionFromPathname } from '@/hooks/useStateFromPath';
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
    const jurisdictionCode = getJurisdictionFromPathname(pathname);

    const citation = formatStateCitation(issue.jurisdiction || jurisdictionCode, issue.regulation);

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

        <ReviewSummaryText summary={issue.analysis?.reviewSummary} className="mb-4" />

        {/* Tier Classification Flow */}
        {issue.analysis && (
          <TierClassificationSection analysis={issue.analysis} />
        )}

        {/* Summary context, breadcrumbs, and citation */}
        <SummaryContext
          regulation={issue.regulation}
          state={issue.jurisdiction ?? 'ny'}
          citation={citation ?? ''}
          guidance={issue.guidance}
        />

        {/* LLM Analysis */}
        <LLMAnalysisSection
          tier1Reasoning={issue.tier1Reasoning}
          tier2Reasoning={issue.tier2Reasoning}
          tier3Reasoning={issue.tier3Reasoning}
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
          stateCode={jurisdictionCode}
          verbatimSupportingText={issue.verbatimSupportingText}
          regexMatchPattern={issue.regexMatchPattern}
          isVerbatim={issue.isVerbatim}
          guidance={issue.guidance}
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
