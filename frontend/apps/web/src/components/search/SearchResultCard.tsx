'use client';

import Link from 'next/link';
import { Badge, Card, SectionTypeBadge, EntityTypeBadge, ColorStripe } from '@/components/ui';
import { getEntityIcon } from '@/lib/constants/entity-types';
import type { EntityType } from '@/lib/constants/entity-types';
import { sanitizeSnippet } from '@/lib/utils/sanitize-snippet';
import type { SearchResultItem } from '@deproceduralizer/database';

/** Map search result type to canonical EntityType */
const RESULT_TYPE_TO_ENTITY: Record<string, EntityType> = {
  regulation: 'regulatory_document',
  statute: 'statute',
  guidance: 'guidance_document',
  analysis: 'compliance_issue',
};

interface SearchResultCardProps {
  result: SearchResultItem;
  state: string;
  /** Current search query — passed as highlight param to detail page */
  query?: string;
  /** Current search page URL — passed as from param for back navigation */
  searchUrl?: string;
}

/**
 * Highlight matching query terms in a sanitized HTML snippet.
 * Wraps case-insensitive matches of `query` in <mark> with accent styling.
 * Returns the original snippet if query is empty or too short.
 */
function highlightQuery(html: string, query: string | undefined): string {
  if (!query || query.trim().length < 2) return html;
  // Escape regex special characters in the query
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return html.replace(regex, '<mark class="bg-[var(--color-accent-muted)] text-[var(--color-text)] px-0.5 rounded">$1</mark>');
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

  const entityType = RESULT_TYPE_TO_ENTITY[result.type] ?? 'regulatory_document';
  const TypeIcon = getEntityIcon(entityType);

  // Snippet is from PostgreSQL ts_headline (trusted DB content), sanitized via sanitizeSnippet()
  // which strips all HTML except <mark> tags — safe against XSS
  // Then highlight matching query terms on top of that
  const sanitizedSnippet = highlightQuery(sanitizeSnippet(result.snippet), query);

  const showAnalysisRow = result.type === 'regulation' && result.issueCount > 0;

  return (
    <Card padding="sm" className="flex transition-colors duration-[var(--duration-fast)] hover:border-[var(--color-neutral-300)] overflow-hidden">
      <ColorStripe entityType={entityType} position="left" className="shrink-0 -ml-4 mr-4 self-stretch" />
      <div className="flex-1 min-w-0">
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
          <EntityTypeBadge type={entityType} size="sm" className="shrink-0" />
        </div>

        {/* Breadcrumb / hierarchy path */}
        {result.hierarchyPath && (
          <p className="text-xs text-[var(--color-text-muted)] mb-2 ml-7 truncate">
            {result.hierarchyPath}
          </p>
        )}

        {/* Snippet — sanitized to only allow <mark> tags from ts_headline, plus query highlights */}
        {/* eslint-disable-next-line react/no-danger -- Safe: ts_headline output sanitized via sanitizeSnippet(), highlightQuery only adds <mark> tags */}
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
              <Badge variant="warning" className="text-xs">
                {result.burdensomeCount} burdensome
              </Badge>
            )}
            {result.hasFederalMandate && (
              <Badge variant="info" className="text-xs">
                Federal mandate
              </Badge>
            )}
            {result.easyCleanupCount > 0 && (
              <Badge variant="success" className="text-xs">
                Easy cleanup
              </Badge>
            )}
          </Link>
        )}
      </div>
    </Card>
  );
}
