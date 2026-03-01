'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { BarChart3, Search, ShieldCheck } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import type { JurisdictionCode } from '@/types/state';
import type {
  PipelineAnalyticsData,
  PipelineContextData,
  PipelineFunnelData,
  Tier1ContextRequestStats,
  TierTransitionData,
  TransitionReasonData,
  Tier3EvidenceStats,
  ConfidenceByClassificationData,
} from '@/lib/actions/pipeline-analytics';
import {
  getPipelineAnalyticsBundle,
  getPipelineContextData,
} from '@/lib/actions/pipeline-analytics';
import { analyticsParsers } from '@/lib/url/parsers';
import type { PipelineSubTabValue } from '@/lib/constants/values';
import { Card, SegmentedControl, type SegmentedControlOption } from '@/components/ui';
import { PipelineFilters } from './pipeline/PipelineFilters';
import { OverviewSubtab, ContextResearchSubtab, VerificationSubtab } from './pipeline/subtabs';

const SUBTAB_OPTIONS: SegmentedControlOption<PipelineSubTabValue>[] = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'context', label: 'Context & Research', icon: Search },
  { value: 'verification', label: 'Verification', icon: ShieldCheck },
];

interface PipelineTabProps {
  jurisdiction: JurisdictionCode;
  data: PipelineAnalyticsData | null;
}

export function PipelineTab({ jurisdiction, data: initialData }: PipelineTabProps) {
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: true });
  const issueType = params.pIssueType;
  const subTab = params.pSubTab as PipelineSubTabValue;

  // ── Core data state (overview + verification) ──────────────────
  const [filteredFunnel, setFilteredFunnel] = useState<PipelineFunnelData | null>(null);
  const [filteredTier1, setFilteredTier1] = useState<Tier1ContextRequestStats | null>(null);
  const [filteredTransitions, setFilteredTransitions] = useState<TierTransitionData | null>(null);
  const [filteredEvidence, setFilteredEvidence] = useState<Tier3EvidenceStats | null>(null);
  const [filteredConfByClass, setFilteredConfByClass] = useState<ConfidenceByClassificationData | null>(null);
  const [filteredTransitionReasons, setFilteredTransitionReasons] = useState<TransitionReasonData | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  // ── Context subtab data (lazy-loaded) ──────────────────────────
  const [contextData, setContextData] = useState<PipelineContextData | null>(null);
  const [filteredContextData, setFilteredContextData] = useState<PipelineContextData | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const contextLoadedRef = useRef<string | null>(null);

  // ── Derive available issue types ───────────────────────────────
  const availableIssueTypes = useMemo(() => {
    if (!initialData) return [];
    const types = new Set<string>();
    for (const entry of initialData.tier1Context.byIssueType) {
      types.add(entry.issueType);
    }
    return Array.from(types).sort();
  }, [initialData]);

  // ── Re-fetch core data when issue type filter changes ──────────
  useEffect(() => {
    if (!issueType) {
      setFilteredFunnel(null);
      setFilteredTier1(null);
      setFilteredTransitions(null);
      setFilteredEvidence(null);
      setFilteredConfByClass(null);
      setFilteredTransitionReasons(null);
      return;
    }

    let cancelled = false;
    setIsFiltering(true);

    async function fetchFiltered() {
      const result = await getPipelineAnalyticsBundle(jurisdiction, issueType!);

      if (cancelled) return;

      if (result.success) {
        setFilteredFunnel(result.data.funnel);
        setFilteredTier1(result.data.tier1Context);
        setFilteredTransitions(result.data.tierTransitions);
        setFilteredEvidence(result.data.tier3Evidence);
        setFilteredConfByClass(result.data.confidenceByClassification);
        setFilteredTransitionReasons(result.data.transitionReasons);
      } else {
        setFilteredFunnel(null);
        setFilteredTier1(null);
        setFilteredTransitions(null);
        setFilteredEvidence(null);
        setFilteredConfByClass(null);
        setFilteredTransitionReasons(null);
      }
      setIsFiltering(false);
    }

    fetchFiltered();
    return () => { cancelled = true; };
  }, [jurisdiction, issueType]);

  // ── Lazy-load context data when subtab is active ───────────────
  useEffect(() => {
    if (subTab !== 'context') return;

    const cacheKey = `${jurisdiction}-${issueType ?? 'all'}`;
    if (issueType) {
      // Filtered context: always refetch when issueType changes
    } else if (contextLoadedRef.current === cacheKey) {
      return; // Already loaded for this state+issueType
    }

    let cancelled = false;
    setIsLoadingContext(true);

    async function fetchContext() {
      const result = await getPipelineContextData(jurisdiction, issueType ?? undefined);
      if (cancelled) return;

      if (result.success) {
        if (issueType) {
          setFilteredContextData(result.data);
        } else {
          setContextData(result.data);
          contextLoadedRef.current = cacheKey;
        }
      }
      setIsLoadingContext(false);
    }

    fetchContext();
    return () => { cancelled = true; };
  }, [jurisdiction, issueType, subTab]);

  // Clear filtered context when issueType is cleared
  useEffect(() => {
    if (!issueType) {
      setFilteredContextData(null);
    }
  }, [issueType]);

  // ── Resolved data ──────────────────────────────────────────────
  const funnel = issueType ? filteredFunnel : initialData?.funnel ?? null;
  const tier1Context = issueType ? filteredTier1 : initialData?.tier1Context ?? null;
  const tierTransitions = issueType ? filteredTransitions : initialData?.tierTransitions ?? null;
  const tier3Evidence = issueType ? filteredEvidence : initialData?.tier3Evidence ?? null;
  const confidenceByClassification = issueType ? filteredConfByClass : initialData?.confidenceByClassification ?? null;
  const transitionReasons = issueType ? filteredTransitionReasons : initialData?.transitionReasons ?? null;

  const activeContextData = issueType ? filteredContextData : contextData;

  // ── Handlers ───────────────────────────────────────────────────
  const handleIssueTypeChange = useCallback((value: string | null) => {
    setParams({ pIssueType: value });
  }, [setParams]);

  const handleSubTabChange = useCallback((value: PipelineSubTabValue) => {
    setParams({ pSubTab: value });
  }, [setParams]);

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

      <SegmentedControl
        options={SUBTAB_OPTIONS}
        value={subTab}
        onChange={handleSubTabChange}
      />

      {isFiltering && (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-2 animate-pulse">
          Updating pipeline data...
        </div>
      )}

      {subTab === 'overview' && (
        <OverviewSubtab funnel={funnel} tierTransitions={tierTransitions} transitionReasons={transitionReasons} confidenceByClassification={confidenceByClassification} />
      )}

      {subTab === 'context' && (
        <ContextResearchSubtab
          tier1Context={tier1Context}
          tier2Requests={activeContextData?.tier2Requests ?? null}
          contextUsed={activeContextData?.contextUsed ?? null}
          researchFunnel={activeContextData?.researchFunnel ?? null}
          isLoading={isLoadingContext}
          onIssueTypeClick={(issueType) => setParams({ pIssueType: issueType })}
        />
      )}

      {subTab === 'verification' && (
        <VerificationSubtab
          tierTransitions={tierTransitions}
          tier3Evidence={tier3Evidence}
        />
      )}
    </div>
  );
}
