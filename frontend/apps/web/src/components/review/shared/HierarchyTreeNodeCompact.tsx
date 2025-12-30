'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface HierarchyTreeNodeCompactProps {
  node: {
    id: number;
    title: string | null;
    shortTitle: string | null;
    summary: string | null;
    hierarchyLevel: number | null;
  };
  depth: number;
  isCurrentDocument: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  state: string;
  onToggle?: () => void;
}

/**
 * Compact tree node for hierarchy display.
 * Shows title/short title with summary (line-clamp-2 with show more), links to regulation page.
 */
export function HierarchyTreeNodeCompact({
  node,
  depth,
  isCurrentDocument,
  isExpanded,
  hasChildren,
  state,
  onToggle,
}: HierarchyTreeNodeCompactProps) {
  const [isFullSummary, setIsFullSummary] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const displayTitle = node.shortTitle || node.title || `Document ${node.id}`;
  const paddingLeft = depth * 16;

  // Check if hierarchyLevel is valid (not null and not NaN)
  const showLevel = node.hierarchyLevel !== null && !isNaN(node.hierarchyLevel);

  // Detect if summary text is truncated
  useEffect(() => {
    if (summaryRef.current && !isFullSummary) {
      const el = summaryRef.current;
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [node.summary, isFullSummary]);

  return (
    <div
      className={`
        py-1 px-2 rounded text-sm
        ${isCurrentDocument
          ? 'bg-[var(--color-primary-bg)] border border-[var(--color-primary)]/30'
          : 'hover:bg-[var(--color-neutral-50)]'}
      `}
      style={{ paddingLeft: `${paddingLeft + 8}px` }}
    >
      <div className="flex items-start gap-2">
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex-shrink-0 p-0.5 hover:bg-[var(--color-neutral-100)] rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" /> // Spacer for alignment
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isCurrentDocument ? (
              <span className="font-medium text-[var(--color-primary)] truncate">
                {displayTitle}
              </span>
            ) : (
              <Link
                href={`/${state.toLowerCase()}/regulations/${node.id}`}
                className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline truncate"
                target="_blank"
              >
                {displayTitle}
              </Link>
            )}
            {showLevel && (
              <span className="flex-shrink-0 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-neutral-100)] px-1 rounded">
                L{node.hierarchyLevel}
              </span>
            )}
          </div>

          {/* Summary with show more/less */}
          {node.summary && (
            <div className="mt-0.5">
              <p
                ref={summaryRef}
                className={`text-xs text-[var(--color-text-muted)] ${isFullSummary ? '' : 'line-clamp-2'}`}
              >
                {node.summary}
              </p>
              {isTruncated && (
                <button
                  type="button"
                  onClick={() => setIsFullSummary(!isFullSummary)}
                  className="text-xs text-[var(--color-link)] hover:underline mt-0.5"
                >
                  {isFullSummary ? 'show less' : 'show more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HierarchyTreeNodeCompact;
