import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

/**
 * Loading skeleton for the home page dashboard.
 * Matches the structure of: Overview stats, State cards, Quick links
 */
export default function HomeLoading() {
  return (
    <>
      <PageHeader
        title="Regulatory Analysis Dashboard"
        description="AI-powered analysis of state regulations to identify procedural complexity and potential issues"
      />

      <Container size="2xl" className="py-6 space-y-8">
        {/* Overview Section */}
        <section>
          <div className="h-6 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="flex items-center gap-4">
                {/* Icon placeholder */}
                <div className="w-12 h-12 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
                <div className="space-y-2">
                  {/* Value placeholder */}
                  <div className="h-7 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  {/* Label placeholder */}
                  <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* State Selection Section */}
        <section>
          <div className="h-6 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="relative overflow-hidden">
                {/* Accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-neutral-300)]" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* State badge */}
                    <div className="w-12 h-12 bg-[var(--color-neutral-200)] rounded-[var(--radius-md)] animate-pulse" />
                    <div className="space-y-2">
                      {/* State name */}
                      <div className="h-5 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                      {/* Regulations count */}
                      <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    </div>
                  </div>
                  {/* Chevron */}
                  <div className="w-5 h-5 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>

                {/* Stats row */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
                  <div className="h-5 w-20 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-5 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  <div className="h-5 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick Actions Section */}
        <section>
          <div className="h-6 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 bg-[var(--color-neutral-100)] rounded-[var(--radius-md)] animate-pulse" />
                  <div className="flex-1 space-y-2">
                    {/* Title */}
                    <div className="h-5 w-28 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    {/* Description */}
                    <div className="h-4 w-full bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
