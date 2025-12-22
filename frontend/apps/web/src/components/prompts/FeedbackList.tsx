'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MessageSquare, User, Calendar } from 'lucide-react';
import type { PromptFeedback, FeedbackType } from '@deproceduralizer/database';

interface FeedbackListProps {
  feedback: PromptFeedback[];
  className?: string;
}

const FEEDBACK_TYPE_BADGE_VARIANT: Record<FeedbackType, 'info' | 'warning' | 'default' | 'success'> = {
  suggestion: 'info',
  bug: 'warning',
  question: 'default',
  other: 'default',
};

const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  suggestion: 'Suggestion',
  bug: 'Bug',
  question: 'Question',
  other: 'Other',
};

function formatDate(date: Date | null): string {
  if (!date) return 'Unknown date';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Displays a list of feedback items for a prompt
 */
export function FeedbackList({ feedback, className = '' }: FeedbackListProps) {
  if (feedback.length === 0) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <MessageSquare className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
        <p className="text-sm text-[var(--color-text-muted)]">
          No feedback yet. Be the first to share your thoughts!
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {feedback.map((item) => (
        <Card
          key={item.id}
          padding="sm"
          className="border-l-4 border-l-[var(--color-neutral-300)]"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <Badge variant={FEEDBACK_TYPE_BADGE_VARIANT[item.feedbackType]}>
              {FEEDBACK_TYPE_LABEL[item.feedbackType]}
            </Badge>
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
              {item.authorName && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.authorName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(item.createdAt)}
              </span>
            </div>
          </div>

          {item.highlightedText && (
            <blockquote className="mb-2 pl-3 border-l-2 border-[var(--color-neutral-300)] text-sm text-[var(--color-text-muted)] italic">
              &ldquo;{item.highlightedText}&rdquo;
            </blockquote>
          )}

          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {item.content}
          </p>
        </Card>
      ))}
    </div>
  );
}

export default FeedbackList;
