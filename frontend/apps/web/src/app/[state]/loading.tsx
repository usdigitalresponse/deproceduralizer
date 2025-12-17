import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the state table view.
 * Matches the structure of: Search input, DataTable with headers, filter row, rows, pagination
 */
export default function TableLoading() {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="Regulatory Analysis"
        description="Searchable database of compliance issues, procedural complexity, and technical review requirements"
      />

      <Container size="2xl" className="py-6">
        {/* Search input skeleton */}
        <div className="mb-6">
          <div className="h-10 w-full max-w-md bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
        </div>

        {/* DataTable skeleton */}
        <Card padding="none" className="overflow-hidden">
          {/* Table header */}
          <div className="bg-[var(--color-primary)] px-3 py-3">
            <div className="flex gap-3">
              <div className="h-4 w-32 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-16 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-24 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-40 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-16 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/30 rounded animate-pulse" />
              <div className="h-4 w-16 bg-white/30 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-white/30 rounded animate-pulse" />
            </div>
          </div>

          {/* Filter row */}
          <div className="bg-[var(--color-primary-strong)] px-3 py-2">
            <div className="flex gap-3">
              <div className="h-6 w-32 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-16 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-24 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-40 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-20 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-20 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-16 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-20 bg-white/20 rounded animate-pulse" />
              <div className="h-6 w-16 bg-white/20 rounded animate-pulse" />
              <div className="flex-1" />
            </div>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-[var(--color-neutral-200)]">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="px-3 py-3 flex gap-3 items-start">
                <div className="w-32 space-y-1">
                  <div className="h-3 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-3 w-3/4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-16">
                  <div className="h-5 w-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-24">
                  <div className="h-3 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-40 space-y-1">
                  <div className="h-3 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-20">
                  <div className="h-3 w-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-20">
                  <div className="h-5 w-12 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-16">
                  <div className="h-5 w-10 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-20">
                  <div className="h-3 w-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-16">
                  <div className="h-3 w-4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination skeleton */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-neutral-50)] border-t border-[var(--color-neutral-200)]">
            <div className="h-4 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
              <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-8 w-16 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
            </div>
          </div>
        </Card>
      </Container>
    </div>
  );
}
