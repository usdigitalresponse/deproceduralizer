'use client';

import { useMemo, useCallback } from 'react';
import { Tags, Hash, Layers, Sparkles } from 'lucide-react';
import { Group } from '@visx/group';
import { Treemap, hierarchy, treemapSquarify } from '@visx/hierarchy';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  TAG_DOMAIN_LABELS,
  getFieldMeta,
  domainColor,
  domainColorLight,
  type TagDomain,
} from '@/lib/constants/tags';
import { useTagDrawer } from './useTagDrawer';
import type { TagOverviewStats } from '@/lib/actions/tags';
import type { JurisdictionCode, TagValue } from '@deproceduralizer/database';

// ---------------------------------------------------------------------------
// Treemap hierarchy types
// ---------------------------------------------------------------------------

interface TreemapDatum {
  name: string;
  domain?: string;
  field?: string;
  value?: number;
  children?: TreemapDatum[];
}

// ---------------------------------------------------------------------------
// Helper: field key -> label
// ---------------------------------------------------------------------------

function fieldLabel(field: string): string {
  return getFieldMeta(field)?.label ?? field;
}

// ---------------------------------------------------------------------------
// TagsOverviewTab
// ---------------------------------------------------------------------------

interface TagsOverviewTabProps {
  overview: TagOverviewStats | null;
  jurisdiction: JurisdictionCode;
}

export function TagsOverviewTab({ overview }: TagsOverviewTabProps) {
  const { openTag } = useTagDrawer();

  // Build treemap hierarchy: root -> domain -> tag values
  const treemapRoot = useMemo(() => {
    if (!overview?.tagValues?.length) return null;

    const byDomain = new Map<string, TreemapDatum[]>();
    for (const tv of overview.tagValues) {
      const domain = tv.domain;
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push({
        name: tv.value,
        domain: tv.domain,
        field: tv.field,
        value: tv.count,
      });
    }

    const children: TreemapDatum[] = [];
    for (const [domain, values] of byDomain) {
      // Take up to the top 20 per domain to avoid overcrowding
      const sorted = values.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 20);
      children.push({
        name: TAG_DOMAIN_LABELS[domain as TagDomain] ?? domain,
        domain,
        children: sorted,
      });
    }

    return hierarchy<TreemapDatum>({ name: 'root', children })
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  }, [overview?.tagValues]);

  const handleRectClick = useCallback(
    (field: string | undefined, value: string) => {
      if (field) {
        openTag(field, value);
      }
    },
    [openTag],
  );

  // Top tags table (sorted by count descending, max 25)
  const topTags = useMemo(() => {
    if (!overview?.tagValues?.length) return [];
    return [...overview.tagValues]
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  }, [overview?.tagValues]);

  // Stat cards
  const mostCommonLabel = overview?.mostCommonTag
    ? `${overview.mostCommonTag.value} (${overview.mostCommonTag.count})`
    : '--';

  const domainWithMostLabel = overview?.domainWithMostTags
    ? TAG_DOMAIN_LABELS[overview.domainWithMostTags as TagDomain] ?? overview.domainWithMostTags
    : '--';

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Unique Tag Values"
          value={overview?.totalUniqueValues ?? 0}
          icon={Tags}
          variant="default"
        />
        <StatCard
          label="Most Common Tag"
          value={mostCommonLabel}
          icon={Hash}
          variant="info"
        />
        <StatCard
          label="Top Domain"
          value={domainWithMostLabel}
          icon={Layers}
          variant="success"
        />
        <StatCard
          label="Normalization Candidates"
          value={overview?.fuzzyClusterCount ?? 0}
          icon={Sparkles}
          variant="warning"
          subtitle="Similar tags that could be merged"
        />
      </StatGrid>

      {/* Treemap */}
      <ChartContainer
        title="Tag Distribution by Domain"
        description="Rectangle size reflects tag frequency. Click any rectangle to view tag details."
        aspectRatio={2}
        minHeight={350}
        maxHeight={500}
      >
        {({ width, height }) => {
          if (!treemapRoot) {
            return <EmptyState title="No tag data available" />;
          }

          return (
            <svg width={width} height={height}>
              <Treemap
                root={treemapRoot}
                size={[width, height]}
                tile={treemapSquarify}
                round
                paddingInner={2}
                paddingOuter={4}
              >
                {treemap => (
                  <Group>
                    {treemap.descendants().map((node, i) => {
                      const nodeWidth = node.x1 - node.x0;
                      const nodeHeight = node.y1 - node.y0;

                      // Skip root & domain-group nodes, only render leaves
                      if (node.depth < 2) return null;
                      if (nodeWidth < 2 || nodeHeight < 2) return null;

                      const domain = node.data.domain ?? '';
                      const showLabel = nodeWidth > 40 && nodeHeight > 20;

                      return (
                        <Group key={`node-${i}`} top={node.y0} left={node.x0}>
                          <rect
                            width={nodeWidth}
                            height={nodeHeight}
                            fill={domainColorLight(domain)}
                            stroke={domainColor(domain)}
                            strokeWidth={1}
                            rx={3}
                            style={{ cursor: 'pointer' }}
                            onClick={() =>
                              handleRectClick(node.data.field, node.data.name)
                            }
                          />
                          {showLabel && (
                            <text
                              x={nodeWidth / 2}
                              y={nodeHeight / 2}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.min(12, nodeWidth / 8)}
                              fill={domainColor(domain)}
                              fontWeight={500}
                              style={{
                                pointerEvents: 'none',
                                userSelect: 'none',
                              }}
                            >
                              {node.data.name.length > nodeWidth / 7
                                ? node.data.name.slice(0, Math.floor(nodeWidth / 7)) + '...'
                                : node.data.name}
                            </text>
                          )}
                        </Group>
                      );
                    })}
                  </Group>
                )}
              </Treemap>
            </svg>
          );
        }}
      </ChartContainer>

      {/* Domain legend */}
      {overview?.tagsByDomain && overview.tagsByDomain.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          {overview.tagsByDomain.map(d => (
            <div key={d.domain} className="flex items-center gap-1.5 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: domainColor(d.domain) }}
              />
              <span className="text-[var(--color-text-secondary)]">
                {TAG_DOMAIN_LABELS[d.domain as TagDomain] ?? d.domain}
              </span>
              <span className="text-[var(--color-text-muted)]">
                ({d.count.toLocaleString()})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top tags table */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          Top Tags
        </h3>
        {topTags.length === 0 ? (
          <EmptyState title="No tag data available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)]">
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)] font-medium w-12">
                    #
                  </th>
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)] font-medium">
                    Value
                  </th>
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)] font-medium">
                    Field
                  </th>
                  <th className="text-left py-2 pr-4 text-[var(--color-text-muted)] font-medium">
                    Domain
                  </th>
                  <th className="text-right py-2 text-[var(--color-text-muted)] font-medium">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {topTags.map((tag, idx) => (
                  <tr
                    key={`${tag.field}-${tag.value}-${idx}`}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] transition-colors"
                  >
                    <td className="py-2 pr-4 text-[var(--color-text-muted)] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        className="text-[var(--color-primary)] hover:underline text-left"
                        onClick={() => openTag(tag.field, tag.value)}
                      >
                        {tag.value}
                      </button>
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-text-secondary)]">
                      {fieldLabel(tag.field)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: domainColor(tag.domain) }}
                        />
                        {TAG_DOMAIN_LABELS[tag.domain as TagDomain] ?? tag.domain}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-[var(--color-text)]">
                      {tag.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
