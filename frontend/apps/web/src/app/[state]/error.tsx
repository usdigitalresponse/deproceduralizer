'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function StateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const state = params.state as string;

  useEffect(() => {
    console.error(`Error boundary for state [${state}] caught error:`, error);
  }, [error, state]);

  return (
    <Container size="lg" className="py-16">
      <div className="bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-lg)] p-8 md:p-12 shadow-sm text-center">
        <div className="inline-flex items-center justify-center p-4 bg-[var(--color-danger-bg)] rounded-full mb-6">
          <AlertTriangle className="w-10 h-10 text-[var(--color-danger)]" />
        </div>
        
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">
          Error loading state data
        </h1>
        
        <p className="text-[var(--color-text-secondary)] mb-8 max-w-lg mx-auto">
          We encountered an issue while fetching regulatory data for {state?.toUpperCase() || 'this state'}. 
          This might be a temporary database connection issue.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="primary"
            onClick={() => reset()}
            className="flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Retry loading
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.location.href = `/${state}/browse`}
          >
            Go to browse page
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-10 pt-6 border-t border-[var(--color-neutral-100)] text-left">
            <p className="text-xs font-mono text-[var(--color-danger)] font-bold mb-2 uppercase tracking-wider">
              Debug Information:
            </p>
            <div className="p-4 bg-[var(--color-neutral-50)] rounded font-mono text-xs text-[var(--color-text-secondary)] overflow-auto max-h-48 whitespace-pre-wrap">
              {error.message}
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
