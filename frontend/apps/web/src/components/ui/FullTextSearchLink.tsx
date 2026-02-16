'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';

interface FullTextSearchLinkProps {
  query?: string;
  state: string;
  className?: string;
}

/**
 * A link that directs users to the full-text search page,
 * optionally pre-filled with their current filter query.
 * Always visible so users can discover full-text search from any view.
 */
export function FullTextSearchLink({ query, state, className = '' }: FullTextSearchLinkProps) {
  const href = query
    ? `/${state}/search?q=${encodeURIComponent(query)}`
    : `/${state}/search`;

  return (
    <Link
      href={href}
      className={`
        inline-flex items-center gap-1 text-xs text-[var(--color-link)]
        hover:text-[var(--color-link-hover)] transition-colors duration-[var(--duration-fast)]
        ${className}
      `}
    >
      <Search className="w-3 h-3" aria-hidden="true" />
      {query ? 'Search full text' : 'Full-text search'}
    </Link>
  );
}
