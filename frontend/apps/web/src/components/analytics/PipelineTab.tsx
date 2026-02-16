'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import type { StateCode } from '@/types/state';
import type {
  PipelineAnalyticsData,
  PipelineFunnelData,
  Tier1ContextRequestStats,
  TierTransitionData,
  Tier3EvidenceStats,
} from '@/lib/actions/pipeline-analytics';
import {
  getPipelineFunnelStats,
  getTier1ContextRequestStats,
  getTierTransitionStats,
  getTier3EvidenceStats,
} from '@/lib/actions/pipeline-analytics';
import { analyticsParsers } from '@/lib/url/parsers';
import { Card } from '@/components/ui';
import { PipelineFunnel } from './pipeline/PipelineFunnel';
import { Tier1ContextPanel } from './pipeline/Tier1ContextPanel';
import { TierTransitionPanel } from './pipeline/TierTransitionPanel';
import { Tier3EvidencePanel } from './pipeline/Tier3EvidencePanel';
import { PipelineFilters } from './pipeline/PipelineFilters';

interface PipelineTabProps {
  state: StateCode;
  data: PipelineAnalyticsData | null;
}

export function PipelineTab({ state, data: initialData }: PipelineTabProps) {
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: true });
  const issueType = params.pIssueType;

  // Filtered data state (null = use initialData)
  const [filteredFunnel, setFilteredFunnel] = useState<PipelineFunnelData | null>(null);
  const [filteredTier1, setFilteredTier1] = useState<Tier1ContextRequestStats | null>(null);
  const [filteredTransitions, setFilteredTransitions] = useState<TierTransitionData | null>(null);
  const [filteredEvidence, setFilteredEvidence] = useState<Tier3EvidenceStats | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  // Derive available issue types from funnel data
  // (We don't have a separate list — issue types come from the overall data)
  const availableIssueTypes = useMemo(() => {
    if (!initialData) return [];
    // Get unique issue types from tier1 context data
    const types = new Set<string>();
    for (const entry of initialData.tier1Context.byIssueType) {
      types.add(entry.issueType);
    }
    return Array.from(types).sort();
  }, [initialData]);

  // Re-fetch when issue type filter changes
  useEffect(() => {
    if (!issueType) {
      // Clear filtered data, use server-side initial data
      setFilteredFunnel(null);
      setFilteredTier1(null);
      setFilteredTransitions(null);
      setFilteredEvidence(null);
      return;
    }

    let cancelled = false;
    setIsFiltering(true);

    async function fetchFiltered() {
      const [funnelResult, tier1Result, transitionsResult, evidenceResult] = await Promise.all([
        getPipelineFunnelStats(state, issueType!),
        getTier1ContextRequestStats(state, issueType!),
        getTierTransitionStats(state, issueType!),
        getTier3EvidenceStats(state, issueType!),
      ]);

      if (cancelled) return;

      setFilteredFunnel(funnelResult.success ? funnelResult.data : null);
      setFilteredTier1(tier1Result.success ? tier1Result.data : null);
      setFilteredTransitions(transitionsResult.success ? transitionsResult.data : null);
      setFilteredEvidence(evidenceResult.success ? evidenceResult.data : null);
      setIsFiltering(false);
    }

    fetchFiltered();
    return () => { cancelled = true; };
  }, [state, issueType]);

  // Use filtered data when a filter is active, otherwise use initial data
  const funnel = issueType ? filteredFunnel : initialData?.funnel ?? null;
  const tier1Context = issueType ? filteredTier1 : initialData?.tier1Context ?? null;
  const tierTransitions = issueType ? filteredTransitions : initialData?.tierTransitions ?? null;
  const tier3Evidence = issueType ? filteredEvidence : initialData?.tier3Evidence ?? null;

  const handleIssueTypeChange = (value: string | null) => {
    setParams({ pIssueType: value });
  };

  if (!initialData) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)]">
        No pipeline data available for this state.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PipelineFilters
        issueType={issueType}
        onIssueTypeChange={handleIssueTypeChange}
        availableIssueTypes={availableIssueTypes}
      />

      {isFiltering && (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-2 animate-pulse">
          Updating pipeline data...
        </div>
      )}

      <PipelineFunnel data={funnel} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tier1ContextPanel data={tier1Context} />
        <TierTransitionPanel data={tierTransitions} />
      </div>

      <Tier3EvidencePanel data={tier3Evidence} />
    </div>
  );
}
