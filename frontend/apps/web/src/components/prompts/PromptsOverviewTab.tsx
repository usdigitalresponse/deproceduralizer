'use client';

import { Code, Shield, Cpu, MessageSquare, Layers, BookOpen } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { PromptsTabValue } from '@/lib/constants/values';

interface PromptsOverviewTabProps {
  coreCount: number;
  complianceCount: number;
  jenaiCount: number;
  totalFeedback: number;
  hasIssueTypes: boolean;
  onNavigateTab: (tab: PromptsTabValue) => void;
}

export function PromptsOverviewTab({
  coreCount,
  complianceCount,
  jenaiCount,
  totalFeedback,
  hasIssueTypes,
  onNavigateTab,
}: PromptsOverviewTabProps) {
  const totalPrompts = coreCount + complianceCount + jenaiCount;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Prompts" value={totalPrompts} icon={Code} />
        <StatCard label="Core" value={coreCount} icon={Code} />
        <StatCard label="Compliance" value={complianceCount} icon={Shield} />
        <StatCard label="JenAI" value={jenaiCount} icon={Cpu} />
        <StatCard label="Feedback Items" value={totalFeedback} icon={MessageSquare} />
      </div>

      {/* Pipeline composer cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {hasIssueTypes && (
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <Layers className="w-5 h-5 text-[var(--color-primary)]" />
              <h3 className="text-base font-semibold text-[var(--color-text)]">Compliance/Research Pipeline Composer</h3>
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
    </div>
  );
}
