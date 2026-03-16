'use client';

import { DollarSign, Building2, Scale, BookOpen } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { PENALTY_TYPE_LABELS_PLURAL, AGENCY_LEVEL_LABELS } from '@/lib/constants/fines';
import { CLASSIFICATION_LABELS } from '@/lib/constants/pipeline';
import type { FinesOverviewStats } from '@/lib/actions/fines';

interface FinesOverviewTabProps {
  stats: FinesOverviewStats | null;
}

interface BarChartSectionProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  emptyMessage: string;
  aspectRatio?: number;
  minHeight?: number;
  maxBars?: number;
}

/** Reusable chart section that handles empty state and dimension plumbing */
function BarChartSection({ title, data, emptyMessage, aspectRatio = 1.2, minHeight = 250, maxBars = 10 }: BarChartSectionProps) {
  return (
    <ChartContainer title={title} aspectRatio={aspectRatio} minHeight={minHeight}>
      {({ width, height }) => {
        if (data.length === 0) {
          return <EmptyState title={emptyMessage} />;
        }
        return (
          <HorizontalBarChart
            data={data}
            width={width}
            height={height}
            maxBars={maxBars}
          />
        );
      }}
    </ChartContainer>
  );
}

/** Title-case a lower-cased who_pays value (e.g. "licensee" -> "Licensee") */
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function FinesOverviewTab({ stats }: FinesOverviewTabProps) {
  const typeData = (stats?.byType ?? []).map(d => ({
    label: PENALTY_TYPE_LABELS_PLURAL[d.type] ?? d.type,
    value: d.count,
  }));

  const levelData = (stats?.byLevel ?? []).map(d => ({
    label: AGENCY_LEVEL_LABELS[d.level] ?? d.level,
    value: d.count,
  }));

  const whoPaysData = (stats?.byWhoPays ?? []).map(d => ({
    label: titleCase(d.whoPays),
    value: d.count,
  }));

  const agencyData = (stats?.byAgency ?? []).map(d => ({
    label: d.agency,
    value: d.count,
  }));

  const classificationData = (stats?.byClassification ?? []).map(d => ({
    label: CLASSIFICATION_LABELS[d.classification] ?? d.classification,
    value: d.count,
  }));

  return (
    <div className="space-y-6">
      <StatGrid columns={4}>
        <StatCard
          label="Total Fines & Fees"
          value={stats?.total ?? 0}
          icon={DollarSign}
          variant="default"
        />
        <StatCard
          label="Agencies"
          value={stats?.uniqueAgencies ?? 0}
          icon={Building2}
          variant="info"
        />
        <StatCard
          label="From Regulations"
          value={stats?.regulationCount ?? 0}
          icon={Scale}
          variant="info"
        />
        <StatCard
          label="From Guidance"
          value={stats?.guidanceCount ?? 0}
          icon={BookOpen}
          variant="success"
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartSection title="By Type" data={typeData} emptyMessage="No data available" />
        <BarChartSection title="By Government Level" data={levelData} emptyMessage="No level data available" />
        <BarChartSection title="By Who Pays" data={whoPaysData} emptyMessage="No who-pays data available" />
        <BarChartSection title="By Analysis Classification" data={classificationData} emptyMessage="No analysis data available" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <BarChartSection
          title="By Agency"
          data={agencyData}
          emptyMessage="No agency data available"
          aspectRatio={2.5}
          minHeight={300}
          maxBars={15}
        />
      </div>
    </div>
  );
}
