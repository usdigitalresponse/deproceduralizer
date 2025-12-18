'use client';

import { useState, useTransition, forwardRef } from 'react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import type { DeveloperItem } from '@/lib/actions/developer';
import { Button, Textarea, Badge, Card, Tag } from '@/components/ui';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { ExpandableRegulationQuote } from './ExpandableRegulationQuote';
import { Flag, FileWarning, MessageCircleQuestion } from 'lucide-react';

interface NeedMoreInfoCardProps {
  item: DeveloperItem;
  isOwner: boolean; // true if current reviewer created this item
  onUpdated: (updatedItem: DeveloperItem) => void;
  onViewRegulation: (regulationId: number) => void;
  isFocused?: boolean;
}

export const NeedMoreInfoCard = forwardRef<HTMLDivElement, NeedMoreInfoCardProps>(
  ({ item, isOwner, onUpdated, onViewRegulation, isFocused = false }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [responseNotes, setResponseNotes] = useState(item.reviewerNotes || '');

    const handleSubmitResponse = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      startTransition(async () => {
        try {
          if (item.type === 'red_flag') {
            await updateRedFlagReview({
              id: item.id,
              reviewStatus: item.reviewStatus || 'unreviewed',
              reviewedBy: item.reviewedBy || '',
              reviewerNotes: responseNotes,
            });
          } else {
            await updateComplianceIssueReview({
              id: item.id,
              reviewStatus: item.reviewStatus || 'unreviewed',
              reviewedBy: item.reviewedBy || '',
              reviewerNotes: responseNotes,
            });
          }

          onUpdated({
            ...item,
            reviewerNotes: responseNotes,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update response');
        }
      });
    };

    // Render type-specific summary
    const renderItemSummary = () => {
      if (item.type === 'red_flag' && item.redFlagData) {
        const flag = item.redFlagData;
        const nycrrCitation = formatNycrrCitation(
          flag.regulation.nycrrTitle,
          flag.regulation.nycrrPart,
          flag.regulation.nycrrSection
        );

        return (
          <div className="text-sm">
            <div className="mb-2">
              <span className="font-semibold">{flag.category}</span>
              {nycrrCitation && (
                <span className="text-[var(--color-text-muted)] ml-2 font-mono">{nycrrCitation}</span>
              )}
            </div>
            <ExpandableRegulationQuote
              text={flag.explanation}
              label="Regulation Text"
              documentId={flag.regulation.id}
              variant="default"
            />
          </div>
        );
      }

      if (item.type === 'compliance_issue' && item.complianceIssueData) {
        const issue = item.complianceIssueData;
        const nycrrCitation = issue.state === 'NY'
          ? formatNycrrCitation(
              issue.regulation.nycrrTitle,
              issue.regulation.nycrrPart,
              issue.regulation.nycrrSection
            )
          : null;

        return (
          <div className="text-sm">
            <div className="mb-2">
              <Badge variant="warning" className="mr-2">{issue.issueType.replace(/_/g, ' ')}</Badge>
              {issue.termMatched && <Tag variant="primary" size="sm">{issue.termMatched}</Tag>}
              {nycrrCitation && (
                <span className="text-[var(--color-text-muted)] ml-2 font-mono">{nycrrCitation}</span>
              )}
            </div>
            <ExpandableRegulationQuote
              text={issue.requirementQuote}
              label="Regulation Text"
              documentId={issue.regulation.id}
              highlightTerm={issue.termMatched}
              variant="warning"
            />
          </div>
        );
      }

      return null;
    };

    return (
      <Card
        ref={ref}
        className={`
          transition-shadow duration-[var(--duration-fast)]
          ${isFocused ? 'ring-2 ring-[var(--color-focus)] ring-offset-2' : ''}
          ${isOwner ? 'border-l-4 border-l-[var(--color-info)]' : ''}
        `}
        tabIndex={0}
      >
        {/* Header with type badge and owner indicator */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            {item.type === 'red_flag' ? (
              <Badge variant="danger" className="flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Red Flag
              </Badge>
            ) : (
              <Badge variant="warning" className="flex items-center gap-1">
                <FileWarning className="w-3 h-3" />
                Compliance Issue
              </Badge>
            )}
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
        {item.reviewerNotes && (
          <div className="mb-4 text-sm">
            <span className="font-medium text-[var(--color-text-secondary)]">Current Notes:</span>
            <p className="text-[var(--color-text)] mt-1">{item.reviewerNotes}</p>
          </div>
        )}

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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewRegulation(item.regulation.id)}
              >
                View Regulation
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
                {isPending ? 'Saving...' : 'Update Notes'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="pt-4 border-t border-[var(--color-neutral-200)]">
            <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
              <span>Reviewed by: {item.reviewedBy}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewRegulation(item.regulation.id)}
              >
                View Regulation
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }
);

NeedMoreInfoCard.displayName = 'NeedMoreInfoCard';

export default NeedMoreInfoCard;
