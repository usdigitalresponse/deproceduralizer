'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui';
import { ComplianceIssueDisplayCard } from './ComplianceIssueDisplayCard';
import ComplianceIssueReviewForm from './ComplianceIssueReviewForm';
import { expandContext } from '@/lib/utils/expandContext';
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
  }) => {
    setIssues((prev) =>
      prev.map((issue) =>
        issue.id === updatedIssue.id
          ? {
              ...issue,
              reviewStatus: updatedIssue.reviewStatus ?? issue.reviewStatus,
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
          const isExpanded = expandedIssues.has(issue.id);

          // Get expanded context if we have regulation content
          const matchContext = issue.regexMatchContext ?? issue.matchedContext;
          const expanded = regulationContent && isExpanded && matchContext
            ? expandContext(regulationContent, matchContext, 800)
            : null;

          const canExpand = Boolean(regulationContent) && !isExpanded;

          return (
            <ComplianceIssueDisplayCard
              key={issue.id}
              issue={issue}
              expandedContext={{
                isExpanded,
                expandedText: expanded?.couldExpand ? expanded.expandedText : null,
                canExpand,
                onToggle: () => toggleExpanded(issue.id),
              }}
            >
              <ComplianceIssueReviewForm
                issue={issue}
                onUpdated={handleIssueUpdated}
              />
            </ComplianceIssueDisplayCard>
          );
        })}
      </div>
    </Card>
  );
}

export default ComplianceIssuesList;
