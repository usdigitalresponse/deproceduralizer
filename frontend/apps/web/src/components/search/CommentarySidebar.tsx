'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Lightbulb } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { Badge } from '@/components/ui';
import { sanitizeSnippet } from '@/lib/utils/sanitize-snippet';
import { SEVERITY_THRESHOLDS } from '@/lib/constants/values';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { BARRIER_CATEGORY_LABELS } from '@/lib/constants/barrier';
import type { CommentaryHit } from '@deproceduralizer/database';

interface CommentarySidebarProps {
  hits: CommentaryHit[];
  state: string;
  /** Current search query — passed as highlight param to detail page */
  query?: string;
  /** Current search page URL — passed as from param for back navigation */
  searchUrl?: string;
}

export function CommentarySidebar({ hits, state, query, searchUrl }: CommentarySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (hits.length === 0) return null;

  return (
    <div className={`${isCollapsed ? 'w-10' : 'w-80'} shrink-0 transition-all duration-[var(--duration-normal)]`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="
          flex items-center gap-1 mb-3
          text-xs font-medium text-[var(--color-text-muted)]
          hover:text-[var(--color-text-secondary)]
          transition-colors duration-[var(--duration-fast)]
        "
        aria-label={isCollapsed ? 'Expand commentary sidebar' : 'Collapse commentary sidebar'}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          aria-hidden="true"
        />
        {!isCollapsed && <span>Commentary ({hits.length})</span>}
      </button>

      {!isCollapsed && (
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {hits.map((hit) => (
            <CommentaryHitCard
              key={`${hit.type}-${hit.id}`}
              hit={hit}
              state={state}
              query={query}
              searchUrl={searchUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getClassificationVariant(classification: string | null): 'warning' | 'success' | 'default' {
  if (classification === 'burdensome') return 'warning';
  if (classification === 'justified') return 'success';
  return 'default';
}

function getSeverityColor(severity: number | null): string {
  if (severity == null) return 'bg-[var(--color-neutral-400)]';
  if (severity >= SEVERITY_THRESHOLDS.HIGH) return 'bg-[var(--color-danger)]';
  if (severity >= SEVERITY_THRESHOLDS.MEDIUM) return 'bg-[var(--color-warning)]';
  return 'bg-[var(--color-success)]';
}

function CommentaryHitCard({
  hit,
  state,
  query,
  searchUrl,
}: {
  hit: CommentaryHit;
  state: string;
  query?: string;
  searchUrl?: string;
}) {
  const isAnalysis = hit.type === 'analysis';
  const isBarrier = hit.type === 'barrier_issue';
  const isIssue = isAnalysis || isBarrier;
  const Icon = isAnalysis
    ? getEntityIcon('compliance_issue')
    : isBarrier
      ? Lightbulb
      : getEntityIcon('definition');

  // Build primary href
  // analysis → pipeline page, barrier_issue → regulation page, definition → regulation with highlight
  const primaryHref = useMemo(() => {
    if (isAnalysis) {
      const fromParam = searchUrl ? `?from=${encodeURIComponent(searchUrl)}` : '';
      const base = `/${state}/pipeline/${hit.documentId}/${hit.label}`;
      return `${base}${fromParam}#matches`;
    }
    // Both barrier_issue and definition link to the regulation page
    const p = new URLSearchParams();
    if (hit.highlightText) p.set('highlight', hit.highlightText);
    if (searchUrl) p.set('from', searchUrl);
    const qs = p.toString();
    return `/${state}/regulations/${hit.documentId}${qs ? `?${qs}` : ''}`;
  }, [isAnalysis, state, hit.documentId, hit.label, hit.highlightText, searchUrl]);

  // Build regulation link (for compliance analysis cards — "View regulation" secondary link)
  const regulationHref = useMemo(() => {
    if (!isAnalysis) return null;
    const p = new URLSearchParams();
    if (query) p.set('highlight', query);
    if (searchUrl) p.set('from', searchUrl);
    const qs = p.toString();
    return `/${state}/regulations/${hit.documentId}${qs ? `?${qs}` : ''}`;
  }, [isAnalysis, state, hit.documentId, query, searchUrl]);

  // Human-readable label
  const issueLabel = isAnalysis
    ? (ISSUE_TYPE_LABELS[hit.label] || hit.label)
    : isBarrier
      ? (BARRIER_CATEGORY_LABELS[hit.label] || hit.label)
      : hit.label;

  // sanitizeSnippet strips all HTML except <mark> tags from trusted PostgreSQL ts_headline output — safe against XSS
  const sanitizedSnippet = sanitizeSnippet(hit.snippet);

  return (
    <div className="
      p-3
      bg-[var(--color-surface)]
      border border-[var(--color-neutral-200)]
      rounded-[var(--radius-md)]
    ">
      {/* Card header — links to primary destination */}
      <Link
        href={primaryHref}
        className="block hover:bg-[var(--color-neutral-50)] -mx-1 px-1 rounded transition-colors duration-[var(--duration-fast)]"
      >
        {/* Badge row — classification + severity (icon is in the label row below) */}
        {isIssue && (hit.classification || hit.severity != null) && (
          <div className="flex items-center gap-1.5 mb-1">
            {hit.classification && (
              <Badge variant={getClassificationVariant(hit.classification)} className="text-[10px] px-1 py-0">
                {hit.classification}
              </Badge>
            )}
            {hit.severity != null && (
              <span className="flex items-center gap-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${getSeverityColor(hit.severity)}`}
                  aria-hidden="true"
                />
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {hit.severity}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Primary label with icon */}
        <p className="flex items-start gap-1.5 text-xs font-medium text-[var(--color-link)] mb-1 line-clamp-2">
          <Icon className="w-3 h-3 mt-0.5 text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
          <span>
            {isAnalysis
              ? `Analysis: ${issueLabel} in ${hit.documentTitle}`
              : isBarrier
                ? `Implementation: ${issueLabel} in ${hit.documentTitle}`
                : `Definition: ${issueLabel}`}
          </span>
        </p>

        {/* Snippet */}
        {/* eslint-disable-next-line react/no-danger -- Safe: sanitized to only <mark> tags */}
        <div
          className="text-xs text-[var(--color-text-secondary)] line-clamp-3"
          dangerouslySetInnerHTML={{ __html: sanitizedSnippet }}
        />
      </Link>

      {/* Footer — "View regulation" link for analysis cards, citation for definition cards */}
      <div className="mt-2 pt-1.5 border-t border-[var(--color-neutral-100)]">
        {regulationHref ? (
          <Link
            href={regulationHref}
            className="
              flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]
              hover:text-[var(--color-link)] transition-colors duration-[var(--duration-fast)]
            "
          >
            <FileText className="w-2.5 h-2.5" aria-hidden="true" />
            View regulation
          </Link>
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-1">
            {hit.documentCitation || hit.documentTitle}
          </p>
        )}
      </div>
    </div>
  );
}
