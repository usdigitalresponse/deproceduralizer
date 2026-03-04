'use client';

import { useQueryStates } from 'nuqs';
import { BarChart3, Layers, Cpu, Code } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { promptsParsers } from '@/lib/url/parsers';
import type { PromptsTabValue } from '@/lib/constants/values';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';
import type { PromptFeedback } from '@deproceduralizer/database';
import type { IssueTypeOption } from './V5PipelineComposer/types';
import { PromptsOverviewTab } from './PromptsOverviewTab';
import { PromptCatalogTab } from './PromptCatalogTab';
import { ArchivedFeedback } from './ArchivedFeedback';
import { V5PipelineComposer } from './V5PipelineComposer';
import { JenAIPipelineComposer } from './JenAIPipelineComposer';

const TAB_OPTIONS: SegmentedControlOption<PromptsTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'research', label: 'Research', icon: Layers },
  { value: 'jenai', label: 'JenAI', icon: Cpu },
  { value: 'catalog', label: 'Catalog', icon: Code },
];

export interface PromptsClientProps {
  prompts: PromptData[];
  compliancePrompts: CompliancePromptData[];
  jenaiPrompts: PromptData[];
  feedbackCounts: Record<string, number>;
  orphanedFeedback: PromptFeedback[];
  issueTypes: IssueTypeOption[];
}

export function PromptsClient({
  prompts,
  compliancePrompts,
  jenaiPrompts,
  feedbackCounts,
  orphanedFeedback,
  issueTypes,
}: PromptsClientProps) {
  const [params, setParams] = useQueryStates(promptsParsers, { shallow: true });
  const currentTab = params.tab;

  const handleTabChange = (tab: PromptsTabValue) => {
    setParams({ tab });
  };

  const totalFeedback = Object.values(feedbackCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={currentTab}
        onChange={handleTabChange}
      />

      <div className="mt-6">
        {currentTab === 'overview' && (
          <PromptsOverviewTab
            coreCount={prompts.length}
            complianceCount={compliancePrompts.length}
            jenaiCount={jenaiPrompts.length}
            totalFeedback={totalFeedback}
            hasIssueTypes={issueTypes.length > 0}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'research' && issueTypes.length > 0 && (
          <V5PipelineComposer issueTypes={issueTypes} />
        )}

        {currentTab === 'jenai' && (
          <JenAIPipelineComposer />
        )}

        {currentTab === 'catalog' && (
          <PromptCatalogTab
            prompts={prompts}
            compliancePrompts={compliancePrompts}
            jenaiPrompts={jenaiPrompts}
            feedbackCounts={feedbackCounts}
          />
        )}
      </div>

      {orphanedFeedback.length > 0 && (
        <ArchivedFeedback feedback={orphanedFeedback} />
      )}
    </div>
  );
}
