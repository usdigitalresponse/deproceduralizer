'use client';

import { Code, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PromptCard } from './PromptCard';
import { ArchivedFeedback } from './ArchivedFeedback';
import type { PromptData } from '@/lib/actions/prompts';
import type { PromptFeedback } from '@deproceduralizer/database';

interface PromptsListProps {
  prompts: PromptData[];
  feedbackCounts: Record<string, number>;
  orphanedFeedback: PromptFeedback[];
  className?: string;
}

/**
 * Main container for displaying all prompts with their feedback
 */
export function PromptsList({
  prompts,
  feedbackCounts,
  orphanedFeedback,
  className = '',
}: PromptsListProps) {
  const totalFeedback = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats header */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Code className="w-6 h-6 text-[var(--color-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            LLM Prompts
          </h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          These prompts are used by the backend analysis scripts to analyze regulations.
          You can view each prompt&apos;s structure and provide feedback for improvements.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {prompts.length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Total Prompts</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {prompts.reduce((sum, p) => sum + p.variables.length, 0)}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Total Variables</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="flex items-center gap-1 text-2xl font-bold text-[var(--color-primary)]">
              <MessageSquare className="w-5 h-5" />
              {totalFeedback}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Feedback Items</div>
          </div>
        </div>
      </Card>

      {/* Prompt cards */}
      {prompts.length > 0 ? (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.name}
              prompt={prompt}
              feedbackCount={feedbackCounts[prompt.name] || 0}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8">
            <Code className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-[var(--color-text-muted)]">
              No prompts found. Check that prompts.yaml exists and is properly formatted.
            </p>
          </div>
        </Card>
      )}

      {/* Archived/orphaned feedback */}
      {orphanedFeedback.length > 0 && (
        <ArchivedFeedback feedback={orphanedFeedback} />
      )}
    </div>
  );
}

export default PromptsList;
