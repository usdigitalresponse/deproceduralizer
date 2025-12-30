'use client';

import { useState, useTransition, forwardRef } from 'react';
import { updateRedFlagReview } from '@/lib/actions/red-flags';
import { updateComplianceIssueReview } from '@/lib/actions/compliance-issues';
import type { DeveloperItem } from '@/lib/actions/developer';
import { Button, Textarea, Badge, Tag, CopyLinkButton } from '@/components/ui';
import { ISSUE_TYPE_LABELS, formatLabel } from '@/types/regulation';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { CardWrapper, CornellLink, RegulationTextViewer, HierarchyTreeView } from './shared';
import { Flag, FileWarning, MessageCircleQuestion, ExternalLink } from 'lucide-react';

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
  ({ item, isOwner, onUpdated, onViewRegulation, isFocused = false, state = 'nj' }, ref) => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [responseNotes, setResponseNotes] = useState(item.teamNotes || '');

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
              teamNotes: responseNotes,
            });
          } else {
            await updateComplianceIssueReview({
              id: item.id,
              reviewStatus: item.reviewStatus || 'unreviewed',
              reviewedBy: item.reviewedBy || '',
              teamNotes: responseNotes,
            });
          }

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
              <span className="font-semibold">{formatLabel(flag.category)}</span>
              {nycrrCitation && (
                <span className="text-[var(--color-text-muted)] ml-2 font-mono">{nycrrCitation}</span>
              )}
            </div>
            {/* Explanation */}
            <div className="mb-4">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Why Flagged:</span>
              <p className="mt-1 text-sm text-[var(--color-text)]">{flag.explanation}</p>
            </div>
            {/* Full Regulation Text Viewer */}
            {(flag.regulation as unknown as { content?: string }).content && (
              <RegulationTextViewer
                content={(flag.regulation as unknown as { content: string }).content}
                scrollToText={flag.explanation}
                highlightPattern={flag.matchedPhrases?.length ? flag.matchedPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : undefined}
                label="Show Regulation Text"
              />
            )}
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
              <Badge variant="warning" className="mr-2">{ISSUE_TYPE_LABELS[issue.issueType] || formatLabel(issue.issueType)}</Badge>
              {issue.matchedPattern && <Tag variant="primary" size="sm">{issue.matchedPattern}</Tag>}
              {nycrrCitation && (
                <span className="text-[var(--color-text-muted)] ml-2 font-mono">{nycrrCitation}</span>
              )}
            </div>
            {/* Regulation Text */}
            {issue.requirementText && (
              <div className="mb-4">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Regulation Text:</span>
                <p className="mt-1 text-sm text-[var(--color-text)]">{issue.requirementText}</p>
              </div>
            )}
            {/* Full Regulation Text Viewer */}
            {(issue.regulation as unknown as { content?: string }).content && (
              <RegulationTextViewer
                content={(issue.regulation as unknown as { content: string }).content}
                scrollToText={issue.requirementText}
                highlightPattern={issue.matchedPattern}
                isVerbatim={issue.isVerbatim ?? false}
                label="Show Regulation Text"
              />
            )}
          </div>
        );
      }

      return null;
    };

    const anchor = item.type === 'red_flag' ? `flag-${item.id}` : `compliance-${item.id}`;

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
          defaultExpanded
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
