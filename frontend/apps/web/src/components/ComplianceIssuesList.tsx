'use client';

import { useState, useCallback, useMemo } from 'react';
import { Badge, ReviewStatusBadge, Card, Tag, Button } from '@/components/ui';
import ComplianceIssueReviewForm from '@/components/ComplianceIssueReviewForm';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { expandContext } from '@/lib/utils/expandContext';
import { highlightTerm, highlightContext } from '@/lib/utils/highlight';
import type { ComplianceIssue } from '@deproceduralizer/database';

interface ComplianceIssuesListProps {
  initialIssues: ComplianceIssue[];
  regulationContent?: string | null;
}

export function ComplianceIssuesList({ initialIssues, regulationContent }: ComplianceIssuesListProps) {
  const [issues, setIssues] = useState(initialIssues);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  const handleIssueUpdated = useCallback((updatedIssue: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewerNotes?: string;
    priority?: number;
    impactType?: string;
  }) => {
    setIssues((prev) =>
      prev.map((issue) =>
        issue.id === updatedIssue.id
          ? {
              ...issue,
              reviewStatus: updatedIssue.reviewStatus ?? issue.reviewStatus,
              reviewedBy: updatedIssue.reviewedBy ?? issue.reviewedBy,
              reviewedAt: updatedIssue.reviewedAt ? new Date(updatedIssue.reviewedAt) : issue.reviewedAt,
              reviewerNotes: updatedIssue.reviewerNotes ?? issue.reviewerNotes,
              priority: updatedIssue.priority ?? issue.priority,
              impactType: updatedIssue.impactType ?? issue.impactType,
            }
          : issue
      )
    );
  }, []);

  const toggleExpanded = useCallback((issueId: number) => {
    setExpandedIssues((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(issueId)) {
        newSet.delete(issueId);
      } else {
        newSet.add(issueId);
      }
      return newSet;
    });
  }, []);


  if (issues.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-text)] mb-3">
        Compliance Issues ({issues.length})
      </h2>
      <div className="space-y-4">
        {issues.map((issue) => {
          const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
          const isExpanded = expandedIssues.has(issue.id);

          // Get expanded context if we have regulation content
          const expanded = regulationContent && isExpanded
            ? expandContext(regulationContent, issue.context, 800)
            : null;

          const canExpand = regulationContent && !isExpanded;

          return (
            <div
              key={issue.id}
              className="bg-[var(--color-warning-bg)] border-l-4 border-[var(--color-warning)] p-4 rounded-[var(--radius-md)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="font-semibold">
                    {issueTypeLabel}
                  </Badge>
                  {issue.llmConfirmed && (
                    <Badge variant="success" className="text-xs">
                      LLM Confirmed
                    </Badge>
                  )}
                  {issue.fromStatute && (
                    <Badge variant="info" className="text-xs">
                      From Statute
                    </Badge>
                  )}
                </div>
                {issue.reviewStatus && (
                  <ReviewStatusBadge status={issue.reviewStatus} />
                )}
              </div>

              {/* Term matched */}
              {issue.termMatched && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Term matched:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Tag variant="warning" size="sm">
                      {issue.termMatched}
                    </Tag>
                  </div>
                </div>
              )}

              {/* Context with highlighted term - either expanded or original */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {isExpanded ? 'Expanded context:' : 'Context:'}
                  </span>
                  {(canExpand || isExpanded) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(issue.id)}
                      className="text-xs py-0.5 px-2 h-auto"
                    >
                      {isExpanded ? 'Show less' : 'Show more context'}
                    </Button>
                  )}
                </div>
                <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 border-[var(--color-warning)]">
                  <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
                    {isExpanded && expanded?.couldExpand
                      ? highlightContext(expanded.expandedText, issue.context, issue.termMatched)
                      : highlightTerm(issue.context, issue.termMatched)}
                  </p>
                </div>
              </div>

              {/* Requirement quote */}
              {issue.requirementQuote && issue.requirementQuote !== issue.context && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Requirement:
                  </span>
                  <blockquote className="mt-1 pl-3 border-l-2 border-[var(--color-neutral-300)] text-sm text-[var(--color-text)] italic">
                    &ldquo;{issue.requirementQuote}&rdquo;
                  </blockquote>
                </div>
              )}

              {/* Statute citation */}
              {issue.statuteCitation && (
                <div className="mb-3 text-sm">
                  <span className="font-medium text-[var(--color-text-secondary)]">Statute:</span>
                  <span className="ml-2 font-mono text-[var(--color-text)]">
                    {issue.statuteCitation}
                  </span>
                </div>
              )}

              {/* Review Form */}
              <ComplianceIssueReviewForm
                issue={issue}
                onUpdated={handleIssueUpdated}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default ComplianceIssuesList;
