'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getExcludedDocuments, type ExcludedDocument } from '@/lib/actions/regulations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Collapsible list showing documents excluded from analysis.
 * Displayed in Developer Mode to track which sections are skipped during analysis runs.
 */
export function ExcludedSectionsList() {
  const params = useParams();
  const state = (params.state as string) || 'ny';

  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [documents, setDocuments] = useState<ExcludedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load excluded documents when expanded
  useEffect(() => {
    if (isExpanded && !isLoaded) {
      startTransition(async () => {
        const result = await getExcludedDocuments(state);
        if (result.success) {
          setDocuments(result.data);
          setError(null);
        } else {
          setError(result.error);
        }
        setIsLoaded(true);
      });
    }
  }, [isExpanded, isLoaded, state]);

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get hierarchy level badge color
  const getLevelBadgeColor = (level: string | null) => {
    if (!level) return 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]';
    const colors: Record<string, string> = {
      title: 'bg-purple-100 text-purple-700',
      chapter: 'bg-blue-100 text-blue-700',
      part: 'bg-green-100 text-green-700',
      subpart: 'bg-teal-100 text-teal-700',
      section: 'bg-amber-100 text-amber-700',
    };
    return colors[level.toLowerCase()] || 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]';
  };

  return (
    <Card className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-[var(--color-text)]">
            Excluded from Analysis
          </span>
          {isLoaded && documents.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-warning-100)] text-[var(--color-warning-700)] rounded-full">
              {documents.length}
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          {isPending ? (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-4">
              Loading excluded documents...
            </div>
          ) : error ? (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-50)] p-3 rounded">
              {error}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-4">
              No documents are currently excluded from analysis.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between gap-3 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${getLevelBadgeColor(
                          doc.hierarchyLevel
                        )}`}
                      >
                        {doc.hierarchyLevel || 'Unknown'}
                      </span>
                    </div>
                    <Link
                      href={`/${state}/regulations/${doc.id}`}
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline line-clamp-2"
                    >
                      {doc.title}
                    </Link>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      <span>Excluded by {doc.excludedBy || 'unknown'}</span>
                      <span className="mx-1.5">·</span>
                      <span>{formatDate(doc.excludedAt)}</span>
                    </div>
                    {doc.excludedReason && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 italic">
                        "{doc.excludedReason}"
                      </div>
                    )}
                  </div>
                  <Link href={`/${state}/regulations/${doc.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default ExcludedSectionsList;
