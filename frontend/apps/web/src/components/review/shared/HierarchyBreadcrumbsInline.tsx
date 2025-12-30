'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import { getAncestorChain } from '@/lib/actions/hierarchy';
import { formatDisplayTitle, truncateTitle } from '@/lib/format';

interface AncestorNode {
  id: number;
  title: string;
  hierarchyLevel: string | null;
  shortTitle: string | null;
  levelIdentifier: string | null;
  citation: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  nycrrChapter: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
  njacSubchapter: string | null;
  state: string | null;
}

interface HierarchyBreadcrumbsInlineProps {
  documentId: number;
  state: string;
  /** Maximum characters for each breadcrumb item */
  maxItemLength?: number;
}

/**
 * Compact inline hierarchy breadcrumb for review cards
 * Shows the ancestor path with links to each document
 */
export function HierarchyBreadcrumbsInline({
  documentId,
  state,
  maxItemLength = 40,
}: HierarchyBreadcrumbsInlineProps) {
  const [ancestors, setAncestors] = useState<AncestorNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAncestors() {
      setIsLoading(true);
      setHasError(false);
      try {
        const result = await getAncestorChain(documentId);
        if (!cancelled) {
          if (result.success) {
            // Only show the top few ancestors to keep it compact
            // Typically: Title > Chapter > Subchapter
            setAncestors(result.data.slice(0, 3));
          } else {
            console.error('Failed to load ancestor chain:', result.error);
            setHasError(true);
          }
        }
      } catch (error) {
        console.error('Failed to load ancestor chain:', error);
        if (!cancelled) {
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAncestors();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (hasError || ancestors.length === 0) {
    return null;
  }

  return (
    <nav className="flex flex-wrap items-center gap-0.5 text-[10px]" aria-label="Hierarchy">
      {ancestors.map((ancestor, index) => (
        <span key={ancestor.id} className="flex items-center gap-0.5">
          {index > 0 && (
            <ChevronRight className="w-2.5 h-2.5 text-[var(--color-text-muted)] flex-shrink-0" />
          )}
          <Link
            href={`/${state.toLowerCase()}/regulations/${ancestor.id}`}
            className="
              text-[var(--color-link)] hover:text-[var(--color-link-hover)]
              hover:underline
              max-w-[250px] truncate inline-block
            "
            title={ancestor.title}
          >
            {truncateTitle(formatDisplayTitle(ancestor), maxItemLength)}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export default HierarchyBreadcrumbsInline;
