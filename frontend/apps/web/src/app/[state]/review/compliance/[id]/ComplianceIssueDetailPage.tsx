'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { formatStateCitation } from '@/lib/formatters/citations';
import { Header } from '@/components/review/ComplianceIssueCard/Header';
import { TierClassificationSection } from '@/components/review/ComplianceIssueCard/TierClassificationSection';
import { SummaryContext } from '@/components/review/ComplianceIssueCard/SummaryContext';
import { LLMAnalysisSection } from '@/components/review/ComplianceIssueCard/LLMAnalysisSection';
import { EvidenceSection } from '@/components/review/ComplianceIssueCard/EvidenceSection';
import { AnalysisDetailsSection } from '@/components/review/ComplianceIssueCard/AnalysisDetailsSection';
import { RegulationActions } from '@/components/review/ComplianceIssueCard/RegulationActions';
import { TechnicalDetailsSection } from '@/components/review/ComplianceIssueCard/TechnicalDetailsSection';
import { ReviewForm } from '@/components/review/ComplianceIssueCard/ReviewForm';
import type { ComplianceIssueWithAnalysis } from '@deproceduralizer/database';

interface ComplianceIssueDetailPageProps {
  issue: ComplianceIssueWithAnalysis;
  state: string;
}

export function ComplianceIssueDetailPage({ issue: initialIssue, state }: ComplianceIssueDetailPageProps) {
  const [issue, setIssue] = useState(initialIssue);

  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
  const citation = formatStateCitation(issue.jurisdiction || state, issue.regulation);

  const handleUpdated = useCallback((updatedIssue: ComplianceIssueWithAnalysis) => {
    setIssue(updatedIssue);
  }, []);

  // Determine back-to-source link
  const sourceLink = issue.documentId
    ? `/${state}/regulations/${issue.documentId}`
    : issue.guidanceDocumentId
    ? `/${state}/guidance/${issue.guidanceDocumentId}`
    : null;

  const sourceLabel = issue.documentId
    ? 'Back to Regulation'
    : issue.guidanceDocumentId
    ? 'Back to Guidance'
    : null;

  // Pipeline analysis link
  const pipelineLink = issue.guidanceDocumentId
    ? `/${state}/pipeline/guidance/${issue.guidanceDocumentId}/${issue.issueType}`
    : issue.documentId
    ? `/${state}/pipeline/${issue.documentId}/${issue.issueType}`
    : null;

  // Check if LLM analysis has content
  const hasLLMContent = issue.tier1Reasoning || issue.tier2Reasoning || issue.tier3Reasoning
    || (issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0);

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4 flex-wrap">
        {sourceLink && sourceLabel && (
          <Link href={sourceLink}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {sourceLabel}
            </Button>
          </Link>
        )}
        <Link href={`/${state}/review`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Review Queue
          </Button>
        </Link>
        {pipelineLink && (
          <Link href={pipelineLink}>
            <Button variant="ghost" size="sm">
              View Pipeline Analysis
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </div>

      {/* Header + Badges */}
      <Card>
        <Header issue={issue} issueTypeLabel={issueTypeLabel} />
      </Card>

      {/* Tier Classification */}
      {issue.analysis && (
        <Card>
          <TierClassificationSection analysis={issue.analysis} />
        </Card>
      )}

      {/* Summary Context */}
      <Card>
        <SummaryContext
          regulation={issue.regulation}
          state={issue.jurisdiction ?? state}
          citation={citation ?? ''}
          guidance={issue.guidance}
        />
      </Card>

      {/* LLM Analysis */}
      {hasLLMContent && (
        <Card>
          <LLMAnalysisSection
            tier1Reasoning={issue.tier1Reasoning}
            tier2Reasoning={issue.tier2Reasoning}
            tier3Reasoning={issue.tier3Reasoning}
            verbatimSupportingText={issue.verbatimSupportingText}
            isVerbatim={issue.isVerbatim}
            statuteCitation={issue.statuteCitation}
          />
        </Card>
      )}

      {/* Evidence */}
      {issue.analysis?.contextUsed && issue.analysis.contextUsed.length > 0 && (
        <Card>
          <EvidenceSection
            contextUsed={issue.analysis.contextUsed}
            verbatimRequirements={issue.analysis.verbatimRequirements ?? undefined}
          />
        </Card>
      )}

      {/* Analysis Details */}
      {issue.analysis && (issue.analysis.argumentForRegulation || issue.analysis.argumentAgainstRegulation) && (
        <Card>
          <AnalysisDetailsSection analysis={issue.analysis} />
        </Card>
      )}

      {/* Regulation/Guidance Actions */}
      <Card>
        <RegulationActions
          regulation={issue.regulation}
          stateCode={state}
          verbatimSupportingText={issue.verbatimSupportingText}
          regexMatchPattern={issue.regexMatchPattern}
          isVerbatim={issue.isVerbatim}
          guidance={issue.guidance}
        />
      </Card>

      {/* Technical Details */}
      {issue.regexMatchPattern && (
        <Card>
          <TechnicalDetailsSection regexMatchPattern={issue.regexMatchPattern} />
        </Card>
      )}

      {/* Review Form */}
      <Card>
        <ReviewForm issue={issue} onUpdated={handleUpdated} />
      </Card>
    </div>
  );
}
