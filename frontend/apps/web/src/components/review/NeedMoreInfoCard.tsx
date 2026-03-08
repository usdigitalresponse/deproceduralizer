'use client';

import { useState, useTransition, forwardRef } from 'react';
import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import type { DeveloperItem } from '@/lib/actions/developer';
import { Button, Textarea, Badge, Tag, CopyLinkButton } from '@/components/ui';
import { ISSUE_TYPE_LABELS, formatLabel } from '@/types/regulation';
import { formatStateCitation } from '@/lib/formatters/citations';
import { CardWrapper, CornellLink, RegulationTextViewer, HierarchyTreeView } from './shared';
import { FileWarning, MessageCircleQuestion, ExternalLink } from 'lucide-react';

interface NeedMoreInfoCardProps {
  item: DeveloperItem;
  isOwner: boolean; // true if current reviewer created this item
  onUpdated: (updatedItem: DeveloperItem) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
  /** State code for regulation links */
  state?: string;
}

export const NeedMoreInfoCard = forwardRef<HTMLDivElement, NeedMoreInfoCardProps>(
  ({ item, isOwner, onUpdated, onViewRegulation, isFocused = false, state = 'ny' }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [responseNotes, setResponseNotes] = useState(item.teamNotes || '');

    const handleSubmitResponse = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      startTransition(async () => {
        try {
          await updateComplianceIssueReview({
            id: item.id,
            reviewStatus: item.reviewStatus || 'unreviewed',
            reviewedBy: item.reviewedBy || '',
            teamNotes: responseNotes,
          });

          onUpdated({
            ...item,
            teamNotes: responseNotes,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update response');
        }
      });
    };

    // Render type-specific summary
    const renderItemSummary = () => {
      if (item.type === 'compliance_issue' && item.complianceIssueData) {
        const issue = item.complianceIssueData;
        const issueCitation = formatStateCitation(issue.jurisdiction || state, issue.regulation);

        return (
          <div className="text-sm">
            <div className="mb-2">
              <Badge variant="warning" className="mr-2">{ISSUE_TYPE_LABELS[issue.issueType] || formatLabel(issue.issueType)}</Badge>
              {issue.regexMatchPattern && <Tag variant="primary" size="sm">{issue.regexMatchPattern}</Tag>}
              {issueCitation && (
                <span className="text-[var(--color-text-muted)] ml-2 font-mono">{issueCitation}</span>
              )}
            </div>
            {/* Verbatim Supporting Text */}
            {issue.verbatimSupportingText && issue.verbatimSupportingText.length > 0 && (
              <div className="mb-4">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Supporting Text:</span>
                <div className="mt-1 space-y-1">
                  {issue.verbatimSupportingText.map((text, index) => (
                    <p key={index} className="text-sm text-[var(--color-text)]">{text}</p>
                  ))}
                </div>
              </div>
            )}
            {/* Full Regulation Text Viewer */}
            {issue.regulation.content && (
              <RegulationTextViewer
                content={issue.regulation.content}
                documentId={issue.regulation.id}
                state={state}
                scrollToText={issue.verbatimSupportingText?.[0]}
                highlightPattern={issue.regexMatchPattern}
                isVerbatim={issue.isVerbatim ?? false}
                label="Show Regulation Text"
              />
            )}
          </div>
        );
      }

      return null;
    };

    const anchor = `compliance-${item.id}`;

    return (
      <CardWrapper
        ref={ref}
        id={anchor}
        isFocused={isFocused}
        className={isOwner ? 'border-l-4 border-l-[var(--color-info)]' : ''}
      >
        {/* Header with type badge and owner indicator */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <CopyLinkButton anchor={anchor} />
            <Badge variant="warning" className="flex items-center gap-1">
              <FileWarning className="w-3 h-3" />
              Compliance Issue
            </Badge>
            {isOwner && (
              <Badge variant="info">Your Review</Badge>
            )}
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            From: {item.developerAssigned}
          </span>
        </div>

        {/* Developer's question */}
        <div className="mb-4 p-4 bg-[var(--color-info-bg)] rounded-[var(--radius-md)] border border-[var(--color-info)]/30">
          <div className="flex items-center gap-2 mb-2 text-[var(--color-info)]">
            <MessageCircleQuestion className="w-4 h-4" />
            <span className="text-sm font-medium">Developer Question</span>
          </div>
          <p className="text-sm text-[var(--color-text)]">
            {item.developerQuestion || 'No specific question provided.'}
          </p>
        </div>

        {/* Item summary */}
        <div className="mb-4">
          {renderItemSummary()}
        </div>

        {/* Original review notes */}
        {(item.justificationNotes || item.teamNotes) && (
          <div className="mb-4 text-sm space-y-2">
            {item.justificationNotes && (
              <div>
                <span className="font-medium text-[var(--color-text-secondary)]">Justification:</span>
                <p className="text-[var(--color-text)] mt-1">{item.justificationNotes}</p>
              </div>
            )}
            {item.teamNotes && (
              <div>
                <span className="font-medium text-[var(--color-text-secondary)]">Team Notes:</span>
                <p className="text-[var(--color-text)] mt-1">{item.teamNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Hierarchy Tree View */}
        <HierarchyTreeView
          documentId={item.regulation.id}
          state={state}
        />

        {/* Response form (if owner) */}
        {isOwner ? (
          <form onSubmit={handleSubmitResponse} className="pt-4 border-t border-[var(--color-neutral-200)]">
            {error && (
              <div className="mb-3 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm rounded-[var(--radius-md)]">
                {error}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Your Response / Updated Notes
              </label>
              <Textarea
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                rows={3}
                placeholder="Provide additional context or answer the developer's question..."
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/${state.toLowerCase()}/regulations/${item.regulation.id}`, '_blank')}
                >
                  View Full Regulation Page
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
                <CornellLink url={item.regulation.url} />
              </div>
              <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
                {isPending ? 'Saving...' : 'Update Notes'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="pt-4 border-t border-[var(--color-neutral-200)]">
            <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
              <span>Reviewed by: {item.reviewedBy}</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/${state.toLowerCase()}/regulations/${item.regulation.id}`, '_blank')}
                >
                  View Full Regulation Page
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
                <CornellLink url={item.regulation.url} />
              </div>
            </div>
          </div>
        )}
      </CardWrapper>
    );
  }
);

NeedMoreInfoCard.displayName = 'NeedMoreInfoCard';

export default NeedMoreInfoCard;
