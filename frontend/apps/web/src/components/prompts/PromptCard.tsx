'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Code } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PromptVariables } from './PromptVariables';
import { PromptTemplate } from './PromptTemplate';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackList } from './FeedbackList';
import { getFeedbackByPrompt } from '@/lib/actions/prompt-feedback';
import type { PromptData } from '@/lib/actions/prompts';
import type { PromptFeedback } from '@deproceduralizer/database';

interface PromptCardProps {
  prompt: PromptData;
  feedbackCount?: number;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Expandable card displaying a prompt with its details and feedback
 */
export function PromptCard({
  prompt,
  feedbackCount = 0,
  defaultExpanded = false,
  className = '',
}: PromptCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showFeedbackList, setShowFeedbackList] = useState(false);
  const [feedback, setFeedback] = useState<PromptFeedback[]>([]);
  const [localFeedbackCount, setLocalFeedbackCount] = useState(feedbackCount);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Load feedback when list is shown
  useEffect(() => {
    if (showFeedbackList && feedback.length === 0) {
      loadFeedback();
    }
  }, [showFeedbackList]);

  const loadFeedback = async () => {
    setIsLoadingFeedback(true);
    const result = await getFeedbackByPrompt(prompt.name);
    if (result.success) {
      setFeedback(result.data);
      setLocalFeedbackCount(result.data.length);
    }
    setIsLoadingFeedback(false);
  };

  const handleFeedbackSuccess = () => {
    loadFeedback();
    setShowFeedbackForm(false);
    setShowFeedbackList(true);
  };

  return (
    <Card
      padding="md"
      className={`hover:border-[var(--color-primary-weak)] transition-colors ${className}`}
    >
      {/* Header - always visible */}
      <div
        className="flex items-start justify-between gap-4 cursor-pointer"
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Code className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-base font-semibold text-[var(--color-text)] font-mono">
              {prompt.name}
            </h3>
            {localFeedbackCount > 0 && (
              <Badge variant="default">
                <MessageSquare className="w-3 h-3 mr-1" />
                {localFeedbackCount}
              </Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
            {prompt.description.split('\n')[0]}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)] space-y-4">
          {/* Full description */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
              Description
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {prompt.description}
            </p>
          </div>

          {/* Variables */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
              Variables ({prompt.variables.length})
            </h4>
            <PromptVariables variables={prompt.variables} />
          </div>

          {/* Template */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
              Template
            </h4>
            <PromptTemplate template={prompt.template} />
          </div>

          {/* Feedback section */}
          <div className="pt-4 border-t border-[var(--color-neutral-100)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-[var(--color-text)]">
                Feedback
              </h4>
              <div className="flex gap-2">
                {localFeedbackCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedbackList(!showFeedbackList)}
                    className="text-xs"
                  >
                    {showFeedbackList ? 'Hide' : 'View'} ({localFeedbackCount})
                  </Button>
                )}
                <Button
                  type="button"
                  variant={showFeedbackForm ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                  className="text-xs"
                >
                  {showFeedbackForm ? 'Cancel' : 'Submit Feedback'}
                </Button>
              </div>
            </div>

            {/* Feedback form */}
            {showFeedbackForm && (
              <FeedbackForm
                promptName={prompt.name}
                onSuccess={handleFeedbackSuccess}
                className="mb-4"
              />
            )}

            {/* Feedback list */}
            {showFeedbackList && (
              <>
                {isLoadingFeedback ? (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                    Loading feedback...
                  </p>
                ) : (
                  <FeedbackList feedback={feedback} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default PromptCard;
