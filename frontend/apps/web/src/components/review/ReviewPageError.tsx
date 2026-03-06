import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui';
import { ReviewModeSwitcher } from './ReviewModeSwitcher';
import { ReviewTypeTabs } from './ReviewTypeTabs';
import type { ReviewMode, ReviewType } from '@/types/regulation';

export interface ReviewPageErrorProps {
  title: string;
  description: string;
  error: string;
  /**
   * If provided, shows the mode switcher and tabs above the error
   */
  controls?: {
    mode: ReviewMode;
    reviewType: ReviewType;
    tabCounts: {
      flags: number;
      compliance: number;
      definitions: number;
      needs_info: number;
      jenai: number;
      guidance: number;
    };
  };
}

/**
 * Consistent error display for the review page.
 * Used when data fetching fails at any point.
 */
export function ReviewPageError({
  title,
  description,
  error,
  controls,
}: ReviewPageErrorProps) {
  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader title={title} description={description} />
      <Container size="2xl" className="py-6">
        {controls && (
          <>
            <ReviewModeSwitcher mode={controls.mode} />
            <ReviewTypeTabs
              activeType={controls.reviewType}
              counts={controls.tabCounts}
              mode={controls.mode}
            />
          </>
        )}
        <Alert variant="error">{error}</Alert>
      </Container>
    </div>
  );
}
