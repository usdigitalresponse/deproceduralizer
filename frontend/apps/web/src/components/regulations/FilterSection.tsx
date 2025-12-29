'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  count?: number;
}

/**
 * Collapsible filter group with title and optional count badge.
 */
export function FilterSection({
  title,
  children,
  defaultExpanded = true,
  count,
}: FilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-[var(--color-neutral-200)] last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-1 text-left text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-[var(--color-primary)] text-white rounded-full">
              {count}
            </span>
          )}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
      </button>
      {isExpanded && (
        <div className="pb-3 px-1 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}
