'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { StatuteWithLinks, StatuteAncestor } from '@deproceduralizer/database';
import { FileText, AlertTriangle, Loader2, ChevronRight, ExternalLink } from 'lucide-react';
import { EntityTypeIndicator } from '@/components/ui/EntityTypeIndicator';
import { getEntityIcon, getEntityConfig } from '@/lib/constants/entity-types';
import { Card, Button } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import { RegulationContent } from '@/components/regulations';
import { STATUTE_HIERARCHY_LEVEL_LABELS } from '@/lib/constants/hierarchy';
import { LINK_TYPE_LABELS } from '@/lib/constants/values';
import { getStatuteWithLinks, getStatuteAncestorChain } from '@/lib/actions/statutes';

interface StatuteDetailPanelProps {
  statuteId: number | null;
  state: string;
  onNavigate?: (id: number) => void;
  fullScreen?: boolean;
}

export function StatuteDetailPanel({
  statuteId,
  state,
  onNavigate,
  fullScreen = false,
}: StatuteDetailPanelProps) {
  const [statute, setStatute] = useState<StatuteWithLinks | null>(null);
  const [ancestors, setAncestors] = useState<StatuteAncestor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const heightClass = fullScreen ? 'h-full' : 'h-[calc(100vh-16rem)]';

  // Fetch statute data when selectedId changes
  useEffect(() => {
    if (statuteId) {
      loadStatute(statuteId);
    } else {
      setStatute(null);
      setAncestors([]);
    }
  }, [statuteId]);

  async function loadStatute(id: number) {
    setIsLoading(true);
    setError(null);
    try {
      const [statuteResult, ancestorResult] = await Promise.all([
        getStatuteWithLinks(id),
        getStatuteAncestorChain(id),
      ]);

      if (!statuteResult.success) {
        setError(`Failed to load statute: ${statuteResult.error}`);
        return;
      }

      if (!ancestorResult.success) {
        console.error('Failed to load ancestor chain:', ancestorResult.error);
      }

      setStatute(statuteResult.data);
      setAncestors(ancestorResult.success ? ancestorResult.data : []);
    } catch (err) {
      console.error('Failed to load statute:', err);
      setError('Failed to load statute details');
    } finally {
      setIsLoading(false);
    }
  }

  // Empty state
  if (!statuteId) {
    return (
      <Card className={`${heightClass} flex items-center justify-center`}>
        <div className="text-center text-[var(--color-text-muted)]">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Select a statute to view details</p>
          <p className="text-xs mt-1">Click on an item in the tree to view details</p>
        </div>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={`${heightClass} flex items-center justify-center`}>
        <div className="text-center text-[var(--color-text-muted)]">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading statute...</p>
        </div>
      </Card>
    );
  }

  // Error state
  if (error || !statute) {
    return (
      <Card className={`${heightClass} flex items-center justify-center`}>
        <div className="text-center text-[var(--color-danger)]">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">{error || 'Statute not found'}</p>
        </div>
      </Card>
    );
  }

  // Group regulation links by linkType, enabling_authority first
  const linksByType = groupLinksByType(statute.regulationLinks);

  return (
    <Card padding="none" className={`${heightClass} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-neutral-200)] bg-[var(--color-surface)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-1">
              {statute.citation}
            </p>
            <h2 className="text-lg font-semibold text-[var(--color-text)] leading-tight">
              {statute.title}
            </h2>
            {statute.hierarchyLevel && (
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-[10px] uppercase tracking-wide font-medium text-[var(--color-text-muted)]">
                {STATUTE_HIERARCHY_LEVEL_LABELS[statute.hierarchyLevel] || statute.hierarchyLevel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/${state}/statutes/${statute.id}?from=${encodeURIComponent(currentUrl)}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Full Page
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      {ancestors.length > 0 && (
        <div className="px-4 py-2 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
          <nav className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] overflow-x-auto">
            {ancestors.map((ancestor, idx) => (
              <span key={ancestor.id} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
                <button
                  className="hover:text-[var(--color-link)] hover:underline truncate max-w-[200px]"
                  onClick={() => onNavigate?.(ancestor.id)}
                  title={`${ancestor.citation} - ${ancestor.title}`}
                >
                  {ancestor.citation}
                </button>
              </span>
            ))}
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="text-[var(--color-text)] font-medium truncate max-w-[200px]">
              {statute.citation}
            </span>
          </nav>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Statute text */}
        {statute.content && (
          <RegulationContent
            content={statute.content}
            heading="Statute Text"
            maxHeight="none"
          />
        )}

        {/* Linked regulations by type */}
        {linksByType.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
              <EntityTypeIndicator type="cross_reference" size="sm" />
              Linked Regulations ({statute.regulationLinks.length})
            </h3>

            <div className="space-y-4">
              {linksByType.map(({ linkType, links }) => (
                <div key={linkType}>
                  <div className="flex items-center gap-2 mb-2">
                    {linkType === 'enabling_authority' && (
                      <EntityTypeIndicator type="statute" size="sm" />
                    )}
                    <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      {LINK_TYPE_LABELS[linkType] || linkType} ({links.length})
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    {links.map((link) => (
                      <div
                        key={link.linkId}
                        className="flex items-start gap-2 py-1.5 px-3 rounded bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)]"
                      >
                        <EntityTypeIndicator type="regulatory_document" size="sm" className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/${state}/regulations/${link.regulationId}`}
                            className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] font-medium"
                          >
                            {link.regulation.citation || `Regulation #${link.regulationId}`}
                          </Link>
                          {link.regulation.title && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate">
                              {link.regulation.title}
                            </p>
                          )}
                          {link.context && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 italic">
                              {link.context}
                            </p>
                          )}
                        </div>
                        {link.matchStatus && link.matchStatus !== 'matched' && (
                          <Badge
                            variant={link.matchStatus === 'unmatched' ? 'warning' : 'default'}
                            className="text-[10px] shrink-0"
                          >
                            {link.matchStatus}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No links message */}
        {statute.regulationLinks.length === 0 && (
          <div className="text-center py-6 text-[var(--color-text-muted)]">
            <p className="text-sm">No linked regulations found for this statute.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Group regulation links by linkType, with enabling_authority first.
 */
function groupLinksByType(
  links: StatuteWithLinks['regulationLinks']
): { linkType: string; links: StatuteWithLinks['regulationLinks'] }[] {
  const groups = new Map<string, StatuteWithLinks['regulationLinks']>();

  for (const link of links) {
    const type = link.linkType || 'reference';
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(link);
  }

  // Sort: enabling_authority first, then alphabetical
  const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === 'enabling_authority') return -1;
    if (b === 'enabling_authority') return 1;
    return a.localeCompare(b);
  });

  return sortedEntries.map(([linkType, links]) => ({ linkType, links }));
}

export default StatuteDetailPanel;
