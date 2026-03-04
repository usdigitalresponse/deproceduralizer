'use client';

import { Code, Shield, Cpu, MessageSquare, Layers, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArchivedFeedback } from './ArchivedFeedback';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';
import type { PromptFeedback } from '@deproceduralizer/database';
import type { PromptsTabValue } from '@/lib/constants/values';

interface PromptsOverviewTabProps {
  prompts: PromptData[];
  compliancePrompts: CompliancePromptData[];
  jenaiPrompts: PromptData[];
  feedbackCounts: Record<string, number>;
  orphanedFeedback: PromptFeedback[];
  hasIssueTypes: boolean;
  onNavigateTab: (tab: PromptsTabValue) => void;
}

export function PromptsOverviewTab({
  prompts,
  compliancePrompts,
  jenaiPrompts,
  feedbackCounts,
  orphanedFeedback,
  hasIssueTypes,
  onNavigateTab,
}: PromptsOverviewTabProps) {
  const totalPrompts = prompts.length + compliancePrompts.length + jenaiPrompts.length;
  const totalFeedback = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-4">
          <div className="text-2xl font-bold text-[var(--color-primary)]">{totalPrompts}</div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Prompts</div>
        </div>
        <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-4">
          <div className="flex items-center gap-1.5">
            <Code className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-2xl font-bold text-[var(--color-primary)]">{prompts.length}</span>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Core</div>
        </div>
        <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-4">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-2xl font-bold text-[var(--color-primary)]">{compliancePrompts.length}</span>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Compliance</div>
        </div>
        <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-4">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-2xl font-bold text-[var(--color-primary)]">{jenaiPrompts.length}</span>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">JenAI</div>
        </div>
        <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-4">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-2xl font-bold text-[var(--color-primary)]">{totalFeedback}</span>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Feedback Items</div>
        </div>
      </div>

      {/* Pipeline composer cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {hasIssueTypes && (
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <Layers className="w-5 h-5 text-[var(--color-primary)]" />
              <h3 className="text-base font-semibold text-[var(--color-text)]">Research Pipeline Composer</h3>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Compose and preview prompts for the 3-tier compliance research pipeline. Select an issue type to see the full prompt sent at each tier.
            </p>
            <Button variant="secondary" size="sm" onClick={() => onNavigateTab('research')}>
              Open Composer
            </Button>
          </Card>
        )}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Cpu className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="text-base font-semibold text-[var(--color-text)]">JenAI Pipeline Composer</h3>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Preview and compose prompts for the JenAI single-pass regulatory implementation analysis pipeline.
          </p>
          <Button variant="secondary" size="sm" onClick={() => onNavigateTab('jenai')}>
            Open Composer
          </Button>
        </Card>
      </div>

      {/* Prompt catalog summary */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text)]">Prompt Catalog</h3>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Browse all {totalPrompts} prompts used by the regulatory analysis system. Search by name or description, and submit feedback to help improve prompt quality.
        </p>
        <Button variant="secondary" size="sm" onClick={() => onNavigateTab('catalog')}>
          Browse All Prompts
        </Button>
      </Card>

      {/* Archived feedback */}
      {orphanedFeedback.length > 0 && (
        <ArchivedFeedback feedback={orphanedFeedback} />
      )}
    </div>
  );
}
