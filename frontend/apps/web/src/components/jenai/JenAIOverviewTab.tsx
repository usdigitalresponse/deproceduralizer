'use client';

import { Lightbulb, BookOpen, Zap, Layers } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { getCategoryLabel } from '@/lib/constants/jenai';
import type { JenAIStrategyStats } from '@/lib/actions/jenai-strategies';

interface JenAIOverviewTabProps {
  stats: JenAIStrategyStats | null;
}

export function JenAIOverviewTab({ stats }: JenAIOverviewTabProps) {
  const categoryData = (stats?.byCategory ?? []).map(d => ({
    label: getCategoryLabel(d.category),
    value: d.count,
  }));

  const severityData = (stats?.bySeverity ?? [])
    .slice()
    .sort((a, b) => a.severity - b.severity)
    .map(d => ({
      label: `Severity ${d.severity}`,
      value: d.count,
    }));

  return (
    <div className="space-y-6">
      <StatGrid columns={4}>
        <StatCard
          label="Total Findings"
          value={stats?.total ?? 0}
          icon={Lightbulb}
          variant="default"
          subtitle="Excluding OTHER"
        />
        <StatCard
          label="Best Stories"
          value={stats?.bestStories ?? 0}
          icon={BookOpen}
          variant="info"
          subtitle="High severity, strong narrative"
        />
        <StatCard
          label="Surprises"
          value={stats?.surprises ?? 0}
          icon={Zap}
          variant="warning"
          subtitle="Unexpected findings"
        />
        <StatCard
          label="Pahlka Framework"
          value={stats?.pahlka ?? 0}
          icon={Layers}
          variant="success"
          subtitle="Severity 5+, non-OTHER"
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="By Category" aspectRatio={1.2} minHeight={300}>
          {({ width, height }) => {
            if (categoryData.length === 0) {
              return <EmptyState title="No category data available" />;
            }
            return (
              <HorizontalBarChart
                data={categoryData}
                width={width}
                height={height}
                maxBars={18}
              />
            );
          }}
        </ChartContainer>

        <ChartContainer title="By Severity" aspectRatio={1.2} minHeight={300}>
          {({ width, height }) => {
            if (severityData.length === 0) {
              return <EmptyState title="No severity data available" />;
            }
            return (
              <HorizontalBarChart
                data={severityData}
                width={width}
                height={height}
                maxBars={10}
                sortOrder="none"
              />
            );
          }}
        </ChartContainer>
      </div>
    </div>
  );
}
