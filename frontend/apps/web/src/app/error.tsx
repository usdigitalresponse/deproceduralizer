'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root error boundary caught error:', error);
  }, [error]);

  return (
    <Container size="md" className="py-20">
      <div className="text-center">
        <div className="inline-flex items-center justify-center p-4 bg-[var(--color-danger-bg)] rounded-full mb-6">
          <AlertTriangle className="w-12 h-12 text-[var(--color-danger)]" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text)] mb-4">
          Something went wrong
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mb-8 max-w-md mx-auto">
          An unexpected error occurred. We have been notified and are looking into it.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => reset()}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => window.location.href = '/'}
          >
            Go to dashboard
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-12 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] text-left overflow-auto max-h-60">
            <p className="text-xs font-mono text-[var(--color-danger)] font-bold mb-2">
              Development Error Info:
            </p>
            <pre className="text-xs font-mono text-[var(--color-text-secondary)]">
              {error.message}
              {/* Corrected: Use a single newline character for clarity */}
              {'\n\n'}
              {error.stack}
            </pre>
          </div>
        )}
      </div>
    </Container>
  );
}
