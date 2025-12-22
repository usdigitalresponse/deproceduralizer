import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

export default function PromptsLoading() {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title="LLM Prompts"
        description="View and provide feedback on analysis prompts"
      />

      <Container size="2xl" className="py-6">
        <div className="space-y-6">
          {/* Stats card skeleton */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              <div className="h-5 w-32 bg-[var(--color-neutral-200)] rounded animate-pulse" />
            </div>
            <div className="h-4 w-96 bg-[var(--color-neutral-200)] rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
                  <div className="h-8 w-16 bg-[var(--color-neutral-200)] rounded animate-pulse mb-1" />
                  <div className="h-4 w-24 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </Card>

          {/* Prompt card skeletons */}
          {[...Array(4)].map((_, i) => (
            <Card key={i} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                    <div className="h-5 w-48 bg-[var(--color-neutral-200)] rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-full max-w-md bg-[var(--color-neutral-200)] rounded animate-pulse" />
                </div>
                <div className="w-8 h-8 bg-[var(--color-neutral-200)] rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
