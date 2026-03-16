'use client';

import { useEffect, useState, useMemo } from 'react';
import { ResponsiveChord } from '@nivo/chord';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { getTagNetwork } from '@/lib/actions/tags';
import type { TagNetworkResult } from '@/lib/actions/tags';
import type { JurisdictionCode } from '@deproceduralizer/database';
import {
  TAG_DOMAIN_LABELS,
  TAG_DOMAINS,
  domainColor,
} from '@/lib/constants/tags';

// ---------------------------------------------------------------------------
// Chord helpers
// ---------------------------------------------------------------------------

function buildChordData(network: TagNetworkResult) {
  const domainSet = new Set<string>();
  const domainNodeCounts = new Map<string, number>();
  for (const node of network.nodes) {
    domainSet.add(node.domain);
    domainNodeCounts.set(
      node.domain,
      (domainNodeCounts.get(node.domain) ?? 0) + node.count,
    );
  }

  const domains = TAG_DOMAINS.filter(d => domainSet.has(d));
  if (domains.length < 2) return null;

  const nodeDomain = new Map<string, string>();
  for (const node of network.nodes) {
    nodeDomain.set(node.id, node.domain);
  }

  const matrix: number[][] = domains.map(() => domains.map(() => 0));
  const domainIdx = new Map<string, number>(domains.map((d, i) => [d, i]));

  for (const edge of network.edges) {
    const srcDomain = nodeDomain.get(edge.source);
    const tgtDomain = nodeDomain.get(edge.target);
    if (!srcDomain || !tgtDomain) continue;
    const si = domainIdx.get(srcDomain);
    const ti = domainIdx.get(tgtDomain);
    if (si === undefined || ti === undefined) continue;
    matrix[si][ti] += edge.weight;
    if (si !== ti) {
      matrix[ti][si] += edge.weight;
    }
  }

  const labels = domains.map(d => TAG_DOMAIN_LABELS[d] ?? d);
  const colors = domains.map(d => domainColor(d));

  return { matrix, labels, colors };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TagsConnectionsTabProps {
  jurisdiction: string;
}

export function TagsConnectionsTab({ jurisdiction }: TagsConnectionsTabProps) {
  const [network, setNetwork] = useState<TagNetworkResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getTagNetwork(jurisdiction as JurisdictionCode, { maxNodes: 200 }).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setNetwork(result.data);
      } else {
        setError(result.error);
      }
    });

    return () => { cancelled = true; };
  }, [jurisdiction]);

  const chordData = useMemo(() => {
    if (!network) return null;
    return buildChordData(network);
  }, [network]);

  if (loading) {
    return (
      <div className="text-[var(--color-text-muted)] text-sm py-12 text-center">
        Loading connection data...
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load connections"
        description={error}
      />
    );
  }

  if (!network || network.nodes.length === 0) {
    return <EmptyState title="No tag connections found" description="Tag network data is not yet available for this jurisdiction." />;
  }

  return (
    <ChartContainer
      title="Domain Co-occurrence"
      description="How tag domains co-occur across documents — arc size shows domain volume, ribbon width shows co-occurrence strength"
      aspectRatio={1}
      minHeight={400}
      maxHeight={600}
    >
      {({ width, height }) => {
        if (!chordData) {
          return <EmptyState title="Not enough domains for a chord diagram" />;
        }

        return (
          <div style={{ width, height }}>
            <ResponsiveChord
              data={chordData.matrix}
              keys={chordData.labels}
              colors={chordData.colors}
              margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
              padAngle={0.04}
              innerRadiusRatio={0.96}
              innerRadiusOffset={0.02}
              arcOpacity={1}
              arcBorderWidth={1}
              arcBorderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
              ribbonOpacity={0.5}
              ribbonBorderWidth={1}
              ribbonBorderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
              enableLabel={true}
              label="id"
              labelOffset={12}
              labelRotation={-90}
              labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
              animate={true}
            />
          </div>
        );
      }}
    </ChartContainer>
  );
}
