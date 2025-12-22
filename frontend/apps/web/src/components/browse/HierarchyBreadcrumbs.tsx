'use client';

import { useEffect, useState } from 'react';
import { getAncestorChain } from '@/lib/actions/hierarchy';
import { ChevronRight, Loader2 } from 'lucide-react';
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

interface HierarchyBreadcrumbsProps {
  documentId: number;
  currentTitle: string;
  currentLevel?: string | null;
  onNavigate?: (id: number) => void;
}

const levelLabels: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  chapter: 'Chapter',
  subchapter: 'Subchapter',
  article: 'Article',
  part: 'Part',
  subpart: 'Subpart',
  section: 'Section',
};

/**
 * Displays the hierarchy breadcrumb path for a document
 * Each ancestor is clickable to navigate to that node in the tree
 */
export function HierarchyBreadcrumbs({
  documentId,
  currentTitle,
  currentLevel,
  onNavigate,
}: HierarchyBreadcrumbsProps) {
  const [ancestors, setAncestors] = useState<AncestorNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAncestors() {
      setIsLoading(true);
      try {
        const result = await getAncestorChain(documentId);
        if (!cancelled) {
          if (result.success) {
            setAncestors(result.data);
          } else {
            console.error('Failed to load ancestor chain:', result.error);
            setAncestors([]);
          }
        }
      } catch (error) {
        console.error('Failed to load ancestor chain:', error);
        if (!cancelled) {
          setAncestors([]);
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
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading hierarchy...</span>
      </div>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs" aria-label="Hierarchy breadcrumb">
      {ancestors.map((ancestor, index) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
          )}
          <button
            onClick={() => onNavigate?.(ancestor.id)}
            className="
              px-1.5 py-0.5 rounded
              text-[var(--color-link)] hover:text-[var(--color-link-hover)]
              hover:bg-[var(--color-neutral-100)]
              transition-colors duration-[var(--duration-fast)]
              max-w-[200px] truncate
            "
            title={ancestor.title}
          >
            {truncateTitle(formatDisplayTitle(ancestor), 30)}
          </button>
        </span>
      ))}
      {/* Current document (not clickable) */}
      <span className="flex items-center gap-1">
        {ancestors.length > 0 && (
          <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
        )}
        <span
          className="px-1.5 py-0.5 text-[var(--color-text)] max-w-[200px] truncate"
          title={currentTitle}
        >
          {currentLevel && (
            <span className="font-medium text-[var(--color-text-secondary)] mr-1">
              {levelLabels[currentLevel] || currentLevel}:
            </span>
          )}
          {truncateTitle(currentTitle, 30)}
        </span>
      </span>
    </nav>
  );
}

export default HierarchyBreadcrumbs;
