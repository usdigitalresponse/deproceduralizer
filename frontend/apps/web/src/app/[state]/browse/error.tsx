'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { AlertTriangle, RefreshCcw, ArrowLeft, FilterX } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const isDev = process.env.NODE_ENV === 'development';

// Filter params that can be cleared (preserves tree state: expanded, selected)
const FILTER_PARAMS = ['hasDefs', 'hasCompliance', 'search'];

export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = params.state as string;

  useEffect(() => {
    console.error(`🚨 Browse page error [${state}]:`, error);
    if (isDev && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }, [error, state]);

  const handleClearFilters = () => {
    // Preserve tree state (expanded, selected) but clear filter params
    const newParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (!FILTER_PARAMS.includes(key)) {
        newParams.set(key, value);
      }
    });
    const query = newParams.toString();
    router.push(`/${state}/browse${query ? `?${query}` : ''}`);
  };

  const hasFilters = FILTER_PARAMS.some((param) => searchParams.has(param));

  return (
    <Container size="lg" className="py-16">
      <div className="bg-[var(--color-surface)] border border-[var(--color-neutral-200)] rounded-[var(--radius-lg)] p-8 md:p-12 shadow-sm text-center">
        <div className="inline-flex items-center justify-center p-4 bg-[var(--color-danger-bg)] rounded-full mb-6">
          <AlertTriangle className="w-10 h-10 text-[var(--color-danger)]" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">
          Error loading regulations
        </h1>

        <p className="text-[var(--color-text-secondary)] mb-8 max-w-lg mx-auto">
          We encountered an issue while loading the regulation hierarchy.
          This might be a temporary database connection issue.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="primary"
            onClick={() => reset()}
            className="flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Try again
          </Button>
          {hasFilters && (
            <Button
              variant="secondary"
              onClick={handleClearFilters}
              className="flex items-center gap-2"
            >
              <FilterX className="w-4 h-4" />
              Clear filters
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => router.push(`/${state}/browse`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to browse
          </Button>
        </div>

        {isDev && (
          <div className="mt-10 pt-6 border-t border-[var(--color-danger)] text-left">
            <p className="text-sm font-mono text-[var(--color-danger)] font-bold mb-2 uppercase tracking-wider">
              DEV MODE - Full Error Details:
            </p>
            <div className="p-4 bg-red-50 border border-red-200 rounded font-mono text-xs text-red-800 overflow-auto max-h-64 whitespace-pre-wrap">
              <div className="font-bold mb-2">{error.name}: {error.message}</div>
              {error.stack && (
                <div className="text-red-700">{error.stack}</div>
              )}
            </div>
            {error.digest && (
              <p className="mt-2 text-xs font-mono text-[var(--color-text-muted)]">
                Error digest: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>
    </Container>
  );
}
