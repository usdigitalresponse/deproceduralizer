'use client';

import { BookOpen, AlertTriangle, BarChart3 } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { formatLabel } from '@/types/regulation';
import type { ReadabilityCrossCutStats } from '@/lib/actions/guidance-documents';
import type { BarChartDatum } from '@/lib/charts/types';

interface ReadabilityCrossCutSectionProps {
  stats: ReadabilityCrossCutStats;
}

export function ReadabilityCrossCutSection({ stats }: ReadabilityCrossCutSectionProps) {
  const hasDirection = stats.byDirection.length > 0;
  const hasExpertise = stats.byExpertise.length > 0;
  const hasTags = stats.byAudienceTag.length > 0;
  const hasCompliance = stats.complianceByReadability.length > 0;
  const hasBarrier = stats.barrierByReadability.length > 0;

  if (!hasDirection && !hasExpertise && !hasTags && !hasCompliance && !hasBarrier) {
    return null;
  }

  // Find the most notable finding for headline stats
  const publicRow = stats.byDirection.find(d => d.direction === 'public');
  const govRow = stats.byDirection.find(d => d.direction === 'government');
  const layRow = stats.byExpertise.find(d => d.expertise === 'lay');
  const specRow = stats.byExpertise.find(d => d.expertise === 'specialized');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          Readability vs. Regulatory Burden
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Cross-cutting readability complexity against compliance issues and implementation burden, segmented by target audience
        </p>
      </div>

      {/* Headline stats */}
      {(publicRow || layRow) && (
        <StatGrid columns={4}>
          {publicRow && (
            <StatCard
              label="Public-Facing Ease"
              value={Number(publicRow.avgReadingEase).toFixed(1)}
              icon={BookOpen}
              variant={publicRow.avgReadingEase < 30 ? 'danger' : publicRow.avgReadingEase < 50 ? 'warning' : 'default'}
              subtitle={`${publicRow.docCount} docs, grade ${Number(publicRow.avgGradeLevel).toFixed(1)}`}
            />
          )}
          {govRow && (
            <StatCard
              label="Government-Internal Ease"
              value={Number(govRow.avgReadingEase).toFixed(1)}
              icon={BookOpen}
              variant={govRow.avgReadingEase < 30 ? 'danger' : govRow.avgReadingEase < 50 ? 'warning' : 'default'}
              subtitle={`${govRow.docCount} docs, grade ${Number(govRow.avgGradeLevel).toFixed(1)}`}
            />
          )}
          {layRow && (
            <StatCard
              label="Lay Audience Ease"
              value={Number(layRow.avgReadingEase).toFixed(1)}
              icon={AlertTriangle}
              variant={layRow.avgReadingEase < 30 ? 'danger' : layRow.avgReadingEase < 50 ? 'warning' : 'default'}
              subtitle={`${layRow.docCount} docs for non-experts`}
            />
          )}
          {specRow && (
            <StatCard
              label="Specialist Audience Ease"
              value={Number(specRow.avgReadingEase).toFixed(1)}
              icon={BarChart3}
              variant="default"
              subtitle={`${specRow.docCount} docs for experts`}
            />
          )}
        </StatGrid>
      )}

      {/* Row 1: Readability by Direction + Readability by Expertise */}
      {(hasDirection || hasExpertise) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasDirection && (
            <ChartContainer
              title="Reading Ease by Audience Direction"
              description="Avg Flesch Reading Ease (higher = easier to read)"
              aspectRatio={1.4}
              minHeight={200}
              maxHeight={300}
            >
              {({ width, height }) => (
                <HorizontalBarChart
                  data={stats.byDirection.map(d => ({
                    label: formatLabel(d.direction),
                    value: Number(d.avgReadingEase),
                    secondaryLabel: `${d.docCount} docs`,
                  }))}
                  width={width}
                  height={height}
                  maxBars={5}
                />
              )}
            </ChartContainer>
          )}

          {hasExpertise && (
            <ChartContainer
              title="Reading Ease by Expertise Level"
              description="Avg Flesch Reading Ease by assumed audience expertise"
              aspectRatio={1.4}
              minHeight={200}
              maxHeight={300}
            >
              {({ width, height }) => (
                <HorizontalBarChart
                  data={stats.byExpertise.map(d => ({
                    label: formatLabel(d.expertise),
                    value: Number(d.avgReadingEase),
                    secondaryLabel: `${d.docCount} docs`,
                  }))}
                  width={width}
                  height={height}
                  maxBars={5}
                />
              )}
            </ChartContainer>
          )}
        </div>
      )}

      {/* Row 2: Compliance by Readability + Barrier by Readability */}
      {(hasCompliance || hasBarrier) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasCompliance && (
            <ChartContainer
              title="Compliance Issues by Reading Difficulty"
              description="Avg compliance issues per document, grouped by readability"
              aspectRatio={1.2}
              minHeight={250}
              maxHeight={400}
            >
              {({ width, height }) => {
                const data: BarChartDatum[] = stats.complianceByReadability.map(d => ({
                  label: d.bucket,
                  value: Number(d.avgComplianceIssues),
                  secondaryLabel: `${d.docCount} docs`,
                }));
                return data.length > 0 ? (
                  <HorizontalBarChart
                    data={data}
                    width={width}
                    height={height}
                    maxBars={5}
                    sortOrder="none"
                  />
                ) : (
                  <EmptyState title="No compliance data" />
                );
              }}
            </ChartContainer>
          )}

          {hasBarrier && (
            <ChartContainer
              title="Barrier Severity by Reading Difficulty"
              description="Avg Barrier implementation burden severity by readability"
              aspectRatio={1.2}
              minHeight={250}
              maxHeight={400}
            >
              {({ width, height }) => {
                const data: BarChartDatum[] = stats.barrierByReadability.map(d => ({
                  label: d.bucket,
                  value: Number(d.avgSeverity),
                  secondaryLabel: `${d.docCount} docs`,
                }));
                return data.length > 0 ? (
                  <HorizontalBarChart
                    data={data}
                    width={width}
                    height={height}
                    maxBars={5}
                    sortOrder="none"
                  />
                ) : (
                  <EmptyState title="No Barrier data" />
                );
              }}
            </ChartContainer>
          )}
        </div>
      )}

      {/* Row 3: Compliance by Direction + Compliance by Expertise */}
      {(hasDirection || hasExpertise) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasDirection && (
            <ChartContainer
              title="Compliance Issues by Audience Direction"
              description="Avg compliance issues per document by who it's aimed at"
              aspectRatio={1.4}
              minHeight={200}
              maxHeight={300}
            >
              {({ width, height }) => (
                <HorizontalBarChart
                  data={stats.byDirection.map(d => ({
                    label: formatLabel(d.direction),
                    value: Number(d.avgComplianceIssues),
                    secondaryLabel: `${d.docCount} docs`,
                  }))}
                  width={width}
                  height={height}
                  maxBars={5}
                />
              )}
            </ChartContainer>
          )}

          {hasExpertise && (
            <ChartContainer
              title="Compliance Issues by Expertise Level"
              description="Avg compliance issues per document by audience expertise"
              aspectRatio={1.4}
              minHeight={200}
              maxHeight={300}
            >
              {({ width, height }) => (
                <HorizontalBarChart
                  data={stats.byExpertise.map(d => ({
                    label: formatLabel(d.expertise),
                    value: Number(d.avgComplianceIssues),
                    secondaryLabel: `${d.docCount} docs`,
                  }))}
                  width={width}
                  height={height}
                  maxBars={5}
                />
              )}
            </ChartContainer>
          )}
        </div>
      )}

      {/* Row 4: Target audience tags - Grade Level + Compliance Issues */}
      {hasTags && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer
            title="Grade Level by Target Audience"
            description="Avg Flesch-Kincaid grade level per audience tag"
            aspectRatio={1.2}
            minHeight={Math.max(250, stats.byAudienceTag.length * 30)}
            maxHeight={500}
          >
            {({ width, height }) => (
              <HorizontalBarChart
                data={stats.byAudienceTag.map(d => ({
                  label: formatLabel(d.tag),
                  value: Number(d.avgGradeLevel),
                  secondaryLabel: `${d.docCount} docs`,
                }))}
                width={width}
                height={height}
                maxBars={15}
              />
            )}
          </ChartContainer>

          <ChartContainer
            title="Compliance Issues by Target Audience"
            description="Avg compliance issues per document for each audience tag"
            aspectRatio={1.2}
            minHeight={Math.max(250, stats.byAudienceTag.length * 30)}
            maxHeight={500}
          >
            {({ width, height }) => (
              <HorizontalBarChart
                data={stats.byAudienceTag.map(d => ({
                  label: formatLabel(d.tag),
                  value: Number(d.avgComplianceIssues),
                  secondaryLabel: `${d.docCount} docs`,
                }))}
                width={width}
                height={height}
                maxBars={15}
              />
            )}
          </ChartContainer>
        </div>
      )}

      {/* Row 5: Barrier by audience dimensions */}
      {(hasDirection || hasTags) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasDirection && stats.byDirection.some(d => d.avgBarrierSeverity !== null) && (
            <ChartContainer
              title="Barrier Severity by Audience Direction"
              description="Avg Barrier implementation burden by audience direction"
              aspectRatio={1.4}
              minHeight={200}
              maxHeight={300}
            >
              {({ width, height }) => (
                <HorizontalBarChart
                  data={stats.byDirection
                    .filter(d => d.avgBarrierSeverity !== null)
                    .map(d => ({
                      label: formatLabel(d.direction),
                      value: Number(d.avgBarrierSeverity),
                      secondaryLabel: `${d.docCount} docs`,
                    }))}
                  width={width}
                  height={height}
                  maxBars={5}
                />
              )}
            </ChartContainer>
          )}

          {hasTags && stats.byAudienceTag.some(d => d.avgBarrierSeverity !== null) && (
            <ChartContainer
              title="Barrier Severity by Target Audience"
              description="Avg implementation burden severity per audience tag"
              aspectRatio={1.2}
              minHeight={Math.max(250, stats.byAudienceTag.length * 30)}
              maxHeight={500}
            >
              {({ width, height }) => (
                <HorizontalBarChart
                  data={stats.byAudienceTag
                    .filter(d => d.avgBarrierSeverity !== null)
                    .map(d => ({
                      label: formatLabel(d.tag),
                      value: Number(d.avgBarrierSeverity!),
                      secondaryLabel: `${d.docCount} docs`,
                    }))}
                  width={width}
                  height={height}
                  maxBars={15}
                />
              )}
            </ChartContainer>
          )}
        </div>
      )}
    </div>
  );
}
