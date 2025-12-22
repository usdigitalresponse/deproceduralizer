'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Archive } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { FeedbackList } from './FeedbackList';
import type { PromptFeedback } from '@deproceduralizer/database';

interface ArchivedFeedbackProps {
  feedback: PromptFeedback[];
  className?: string;
}

/**
 * Groups and displays feedback for prompts that no longer exist in prompts.yaml.
 * This helps preserve feedback when prompts are renamed or deleted.
 */
export function ArchivedFeedback({ feedback, className = '' }: ArchivedFeedbackProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (feedback.length === 0) {
    return null;
  }

  // Group feedback by prompt name
  const groupedFeedback = feedback.reduce(
    (acc, item) => {
      if (!acc[item.promptName]) {
        acc[item.promptName] = [];
      }
      acc[item.promptName].push(item);
      return acc;
    },
    {} as Record<string, PromptFeedback[]>
  );

  const promptNames = Object.keys(groupedFeedback);

  return (
    <div className={className}>
      <Alert variant="warning" className="mb-4">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4" />
          <span>
            Found {feedback.length} feedback item{feedback.length !== 1 ? 's' : ''} for{' '}
            {promptNames.length} prompt{promptNames.length !== 1 ? 's' : ''} that no longer exist
            in prompts.yaml. This may happen when prompts are renamed or deleted.
          </span>
        </div>
      </Alert>

      <Card>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          aria-expanded={isExpanded}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[var(--color-warning)]" />
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              Archived Feedback
            </h3>
            <Badge variant="warning">{feedback.length}</Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)] space-y-6">
            {promptNames.map((promptName) => (
              <div key={promptName}>
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-sm font-mono text-[var(--color-text-muted)] bg-[var(--color-neutral-100)] px-2 py-1 rounded">
                    {promptName}
                  </code>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    ({groupedFeedback[promptName].length} item
                    {groupedFeedback[promptName].length !== 1 ? 's' : ''})
                  </span>
                </div>
                <FeedbackList feedback={groupedFeedback[promptName]} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default ArchivedFeedback;
