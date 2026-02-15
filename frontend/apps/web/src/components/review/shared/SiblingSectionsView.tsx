'use client';

import { useState, useCallback } from 'react';
import { getSiblingDocuments } from '@/lib/actions/hierarchy';
import { HierarchyTreeNodeCompact } from './HierarchyTreeNodeCompact';

interface SiblingSectionsViewProps {
  documentId: number;
  state: string;
}

interface SiblingDoc {
  id: number;
  title: string;
  shortTitle: string | null;
  summary: string | null;
  hierarchyLevel: string | null;
}

/**
 * Collapsible view showing sibling sections under the same parent.
 * Lazy-loads siblings on first expand to minimize server calls.
 * Helps reviewers understand what else is in the same regulatory area.
 */
export function SiblingSectionsView({ documentId, state }: SiblingSectionsViewProps) {
  const [siblings, setSiblings] = useState<SiblingDoc[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSiblings = useCallback(async () => {
    if (siblings !== null) return; // Already loaded
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSiblingDocuments(documentId);
      if (result.success) {
        setSiblings(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError('Failed to load sibling sections');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, siblings]);

  return (
    <details
      className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) {
          loadSiblings();
        }
      }}
    >
      <summary className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] transition-colors list-none [&::-webkit-details-marker]:hidden">
        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Sibling Sections
        {siblings !== null && (
          <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1">
            ({siblings.length})
          </span>
        )}
      </summary>

      <div className="mt-2 space-y-0.5">
        {isLoading && (
          <p className="text-xs text-[var(--color-text-muted)] py-2 px-2">Loading sibling sections...</p>
        )}
        {error && (
          <p className="text-xs text-[var(--color-danger)] py-2 px-2">{error}</p>
        )}
        {siblings !== null && siblings.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] py-2 px-2">No sibling sections found.</p>
        )}
        {siblings?.map((sibling) => (
          <HierarchyTreeNodeCompact
            key={sibling.id}
            node={{
              id: sibling.id,
              title: sibling.title,
              shortTitle: sibling.shortTitle,
              summary: sibling.summary,
              hierarchyLevel: sibling.hierarchyLevel !== null ? Number(sibling.hierarchyLevel) : null,
            }}
            depth={0}
            isCurrentDocument={false}
            isExpanded={false}
            hasChildren={false}
            state={state}
          />
        ))}
      </div>
    </details>
  );
}
