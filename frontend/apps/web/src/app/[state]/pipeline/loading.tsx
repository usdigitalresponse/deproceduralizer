import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the pipeline page.
 * Structure mirrors AnalysisDashboard: source toggle, pipeline flow visualizer,
 * 4 summary cards, tier distribution chart, filter bar, analysis table.
 */
export default function PipelineLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Research Pipeline"
        description="View research pipeline progression, tier distributions, and classification outcomes"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Source toggle (Regulations | Guidance) */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] w-fit">
            {['Regulations', 'Guidance'].map((tab) => (
              <div key={tab} className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]">
                <div className="h-4 w-4 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                <div className="h-4 bg-[var(--color-neutral-300)] rounded animate-pulse" style={{ width: `${tab.length * 7}px` }} />
              </div>
            ))}
          </div>

          {/* Pipeline flow visualizer skeleton (3 tier boxes) */}
          <Card padding="lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-52 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex gap-3">
                  <div className="h-4 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-4 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['T1  Match Filtering', 'T2  Full Classification', 'T3  Web Search Verification'].map((tier) => (
                  <div key={tier} className="border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4">
                    <div className="h-5 w-36 bg-[var(--color-neutral-200)] rounded animate-pulse mb-3" />
                    <div className="flex gap-2">
                      <div className="h-6 w-20 bg-[var(--color-neutral-100)] rounded-full animate-pulse" />
                      <div className="h-6 w-16 bg-[var(--color-neutral-100)] rounded-full animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 4 summary stat cards (Total Issues, Pipeline-Processed, Burdensome, Justified) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Issues', w: 16 },
              { label: 'Pipeline-Processed', w: 14 },
              { label: 'Burdensome', w: 12 },
              { label: 'Justified', w: 10 },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4">
                <div className="h-3 bg-[var(--color-neutral-200)] rounded animate-pulse mb-2" style={{ width: `${card.label.length * 6}px` }} />
                <div className="h-7 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${card.w * 4}px` }} />
              </div>
            ))}
          </div>

          {/* Tier distribution chart skeleton */}
          <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6">
            <div className="space-y-4">
              <div className="h-5 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-48 bg-[var(--color-neutral-50)] rounded animate-pulse" />
              <div className="flex justify-center gap-6">
                {['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'].map((label) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                    <div className="h-3 w-10 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter bar skeleton */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-4">
              {['Issue Type', 'Classification', 'Severity', 'Tier', 'Sort By'].map((filter) => (
                <div key={filter} className="space-y-1">
                  <div className="h-3 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${filter.length * 6}px` }} />
                  <div className="h-9 w-28 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <div className="h-8 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-8 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
          </Card>

          {/* Table skeleton */}
          <Card padding="none">
            {/* Table header */}
            <div className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)] px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="w-8 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-24 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex-1 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-12 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-12 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="w-16 h-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
            {/* Table rows */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="border-b border-[var(--color-neutral-100)] px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-24 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-3/4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  </div>
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                  <div className="w-12 h-6 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                </div>
              </div>
            ))}
            {/* Pagination */}
            <div className="bg-[var(--color-neutral-50)] border-t border-[var(--color-neutral-200)] px-4 py-3 flex items-center justify-between">
              <div className="h-4 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-8 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
