import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the analytics page.
 * Structure mirrors OverviewTab: tabs + source toggle, 3 stat cards,
 * classification filter, donut + bar charts, link, review progress,
 * severity donuts, data coverage tiles.
 */
export default function AnalyticsLoading() {
  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title="Analytics"
        description="Comprehensive analytics, patterns, and insights across regulatory data"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Row 1: Tab navigation (8 tabs) + source toggle (3 options) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] w-fit overflow-hidden">
              {['Overview', 'Cross-Refs', 'Issues', 'Keywords', 'Definitions', 'Statutes', 'Guidance', 'Pipeline'].map((tab) => (
                <div
                  key={tab}
                  className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]"
                >
                  <div className="h-4 w-4 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                  <div className="h-4 bg-[var(--color-neutral-300)] rounded animate-pulse" style={{ width: `${tab.length * 7}px` }} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)] flex-shrink-0">
              {['All', 'Regulations', 'Guidance'].map((s) => (
                <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)]">
                  <div className="h-3.5 w-3.5 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                  <div className="h-3.5 bg-[var(--color-neutral-300)] rounded animate-pulse" style={{ width: `${s.length * 7}px` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: 3 stat cards (Regulations Analyzed, JenAI Findings, Classified Burdensome) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Regulations Analyzed', valueW: 20 },
              { label: 'JenAI Findings', valueW: 18 },
              { label: 'Classified Burdensome', valueW: 14 },
            ].map((card) => (
              <Card key={card.label} className="flex items-center gap-4">
                <div className="p-3 rounded-[var(--radius-lg)] bg-[var(--color-neutral-100)]">
                  <div className="w-6 h-6 bg-[var(--color-neutral-300)] rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${card.label.length * 6}px` }} />
                  <div className="h-7 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${card.valueW * 4}px` }} />
                  <div className="h-2 w-36 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>

          {/* Row 3: Classification filter (Show: Burdensome | Justified | All) */}
          <div className="flex items-center gap-3">
            <div className="h-4 w-10 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="flex items-center gap-1 p-1 bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)]">
              {['Burdensome', 'Justified', 'All'].map((opt) => (
                <div key={opt} className="px-3 py-1.5 rounded-[var(--radius-md)]">
                  <div className="h-3.5 bg-[var(--color-neutral-300)] rounded animate-pulse" style={{ width: `${opt.length * 7}px` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Charts row (donut + horizontal bar) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Classification donut */}
            <Card padding="lg" className="min-h-[300px]">
              <div className="space-y-4">
                <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="h-3 w-56 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="flex justify-center items-center py-8">
                  <div className="w-48 h-48 rounded-full border-[16px] border-[var(--color-neutral-200)] animate-pulse" />
                </div>
                <div className="flex justify-center gap-6">
                  {['Burdensome', 'Justified', 'Unrelated'].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--color-neutral-300)] rounded-full animate-pulse" />
                      <div className="h-3 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${label.length * 6}px` }} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Top Issue Types bar chart */}
            <Card padding="lg" className="min-h-[300px]">
              <div className="space-y-4">
                <div className="h-5 w-52 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                <div className="space-y-3 pt-4">
                  {[160, 140, 120, 105, 85, 72, 55, 38].map((width, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-3 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse flex-shrink-0" />
                      <div
                        className="h-6 bg-[var(--color-neutral-200)] rounded animate-pulse"
                        style={{ width: `${width}px` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Row 5: "View full issue type breakdown →" link */}
          <div className="flex justify-end">
            <div className="h-4 w-52 bg-[var(--color-neutral-200)] rounded animate-pulse" />
          </div>

          {/* Row 6: Human Review Progress */}
          <Card padding="lg">
            <div className="space-y-4">
              <div className="h-5 w-44 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-4 w-40 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="h-3 bg-[var(--color-neutral-200)] rounded-full animate-pulse" />
                <div className="flex gap-4">
                  <div className="h-3 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-3 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </div>
            </div>
          </Card>

          {/* Row 7: Severity donuts (Compliance Issue Severity + JenAI Severity) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {['Compliance Issue Severity', 'JenAI Severity'].map((title) => (
              <Card key={title} padding="lg">
                <div className="space-y-4">
                  <div className="h-5 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${title.length * 7}px` }} />
                  <div className="flex justify-center py-4">
                    <div className="w-40 h-40 rounded-full border-[12px] border-[var(--color-neutral-200)] animate-pulse" />
                  </div>
                  <div className="flex justify-center gap-6">
                    {['High (7-10)', 'Medium (4-6)', 'Low (1-3)'].map((label) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[var(--color-neutral-300)] rounded-full animate-pulse" />
                        <div className="h-3 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${label.length * 5}px` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Row 8: Data Coverage (6 tiles) */}
          <Card padding="lg">
            <div className="space-y-4">
              <div className="h-5 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {['AI Summaries', 'Pipeline Coverage', 'Forms Detected', 'External Standards', 'Definitions', 'Statute Links'].map((label) => (
                  <div
                    key={label}
                    className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]"
                  >
                    <div className="h-8 w-14 mx-auto bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-3 mx-auto mt-2 bg-[var(--color-neutral-200)] rounded animate-pulse" style={{ width: `${label.length * 6}px` }} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
