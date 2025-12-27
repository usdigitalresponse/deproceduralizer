'use client';

import { useState, useMemo } from 'react';
import { Code, MessageSquare, Search, X, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PromptCard } from './PromptCard';
import { CompliancePromptCard } from './CompliancePromptCard';
import { ArchivedFeedback } from './ArchivedFeedback';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';
import type { PromptFeedback } from '@deproceduralizer/database';

interface PromptsListProps {
  prompts: PromptData[];
  compliancePrompts?: CompliancePromptData[];
  feedbackCounts: Record<string, number>;
  orphanedFeedback: PromptFeedback[];
  className?: string;
}

/**
 * Main container for displaying all prompts with their feedback
 */
export function PromptsList({
  prompts,
  compliancePrompts = [],
  feedbackCounts,
  orphanedFeedback,
  className = '',
}: PromptsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const totalFeedback = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);
  const totalPrompts = prompts.length + compliancePrompts.length;

  // Filter core prompts based on search query
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return prompts;
    const query = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }, [prompts, searchQuery]);

  // Filter compliance prompts based on search query
  const filteredCompliancePrompts = useMemo(() => {
    if (!searchQuery.trim()) return compliancePrompts;
    const query = searchQuery.toLowerCase();
    return compliancePrompts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.displayName.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [compliancePrompts, searchQuery]);

  // Group compliance prompts by category
  const complianceByCategory = useMemo(() => {
    const groups: Record<string, CompliancePromptData[]> = {};
    filteredCompliancePrompts.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [filteredCompliancePrompts]);

  const totalFiltered = filteredPrompts.length + filteredCompliancePrompts.length;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {totalPrompts}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Total Prompts</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {prompts.length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Core Prompts</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {compliancePrompts.length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Compliance Prompts</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="flex items-center gap-1 text-2xl font-bold text-[var(--color-primary)]">
              <MessageSquare className="w-5 h-5" />
              {totalFeedback}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Feedback Items</div>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search prompts by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-background)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Showing {totalFiltered} of {totalPrompts} prompts
          </p>
        )}
      </Card>

      {/* Core Analysis Prompts */}
      {filteredPrompts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Code className="w-5 h-5 text-[var(--color-primary)]" />
            Core Analysis Prompts
            <span className="text-sm font-normal text-[var(--color-text-muted)]">
              ({filteredPrompts.length})
            </span>
          </h2>
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.name}
              prompt={prompt}
              feedbackCount={feedbackCounts[prompt.name] || 0}
            />
          ))}
        </div>
      )}

      {/* Compliance Issue Prompts */}
      {filteredCompliancePrompts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--color-primary)]" />
            Compliance Issue Prompts
            <span className="text-sm font-normal text-[var(--color-text-muted)]">
              ({filteredCompliancePrompts.length})
            </span>
          </h2>
          {Object.entries(complianceByCategory).map(([category, categoryPrompts]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] pl-2 border-l-2 border-[var(--color-primary-weak)]">
                {category} ({categoryPrompts.length})
              </h3>
              {categoryPrompts.map((prompt) => (
                <CompliancePromptCard key={prompt.name} prompt={prompt} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {totalFiltered === 0 && searchQuery && (
        <Card>
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-[var(--color-text-muted)]">
              No prompts match &quot;{searchQuery}&quot;
            </p>
          </div>
        </Card>
      )}

      {totalFiltered === 0 && !searchQuery && (
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
