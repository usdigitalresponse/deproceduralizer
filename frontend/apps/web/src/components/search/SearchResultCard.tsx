'use client';

import Link from 'next/link';
import { Badge, SectionTypeBadge } from '@/components/ui';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { sanitizeSnippet } from '@/lib/utils/sanitize-snippet';
import type { SearchResultItem } from '@deproceduralizer/database';

interface SearchResultCardProps {
  result: SearchResultItem;
  state: string;
  /** Current search query — passed as highlight param to detail page */
  query?: string;
  /** Current search page URL — passed as from param for back navigation */
  searchUrl?: string;
}

export function SearchResultCard({ result, state, query, searchUrl }: SearchResultCardProps) {
  const basePath = result.type === 'regulation'
    ? `/${state}/regulations/${result.id}`
    : result.type === 'guidance'
      ? `/${state}/guidance/${result.id}`
      : `/${state}/statutes/${result.id}`;

  const params = new URLSearchParams();
  if (query) params.set('highlight', query);
  if (searchUrl) params.set('from', searchUrl);
  const queryString = params.toString();
  const href = queryString ? `${basePath}?${queryString}` : basePath;

  const entityType = result.type === 'regulation'
    ? 'regulatory_document' as const
    : result.type === 'guidance'
      ? 'guidance_document' as const
      : 'statute' as const;
  const TypeIcon = getEntityIcon(entityType);
  const typeLabel = result.type === 'regulation' ? 'Regulation' : result.type === 'guidance' ? 'Guidance' : 'Statute';

  // Snippet is from PostgreSQL ts_headline (trusted DB content), sanitized via sanitizeSnippet()
  // which strips all HTML except <mark> tags — safe against XSS
  const sanitizedSnippet = sanitizeSnippet(result.snippet);

  const showAnalysisRow = result.type === 'regulation' && result.issueCount > 0;

  return (
    <div className="
      p-4
      bg-[var(--color-surface)]
      border border-[var(--color-neutral-200)]
      rounded-[var(--radius-md)]
      transition-colors duration-[var(--duration-fast)]
      hover:border-[var(--color-neutral-300)]
    ">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-2">
        <TypeIcon
          className="w-4 h-4 mt-0.5 text-[var(--color-text-muted)] shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <Link
            href={href}
            className="
              text-sm font-medium text-[var(--color-link)]
              hover:text-[var(--color-link-hover)]
              line-clamp-2
            "
          >
            {result.title}
          </Link>
        </div>
        <Badge variant="default" className="shrink-0 text-xs">
          {typeLabel}
        </Badge>
      </div>

      {/* Breadcrumb / hierarchy path */}
      {result.hierarchyPath && (
        <p className="text-xs text-[var(--color-text-muted)] mb-2 ml-7 truncate">
          {result.hierarchyPath}
        </p>
      )}

      {/* Snippet — sanitized to only allow <mark> tags from ts_headline */}
      {/* eslint-disable-next-line react/no-danger -- Safe: ts_headline output sanitized via sanitizeSnippet() */}
      <div
        className="text-sm text-[var(--color-text-secondary)] ml-7 line-clamp-3"
        dangerouslySetInnerHTML={{ __html: sanitizedSnippet }}
      />

      {/* Metadata chips */}
      <div className="flex items-center gap-2 mt-3 ml-7">
        {result.citation && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {result.citation}
          </span>
        )}
        {result.sectionType && (
          <SectionTypeBadge type={result.sectionType} />
        )}
      </div>

      {/* Analysis status row — only for regulations with issues */}
      {showAnalysisRow && (
        <Link
          href={href}
          className="flex items-center gap-2 mt-2 ml-7 group"
        >
          <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]">
            {result.issueCount} {result.issueCount === 1 ? 'issue' : 'issues'}
          </span>
          {result.burdensomeCount > 0 && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              {result.burdensomeCount} burdensome
            </Badge>
          )}
          {result.hasFederalMandate && (
            <Badge variant="info" className="text-[10px] px-1.5 py-0">
              Federal mandate
            </Badge>
          )}
          {result.easyCleanupCount > 0 && (
            <Badge variant="success" className="text-[10px] px-1.5 py-0">
              Easy cleanup
            </Badge>
          )}
        </Link>
      )}
    </div>
  );
}
