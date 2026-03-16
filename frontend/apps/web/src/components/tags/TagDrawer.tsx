'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui/Drawer';
import { useTagDrawer } from './useTagDrawer';
import { TagBadge } from './TagBadge';
import { getTagDetail } from '@/lib/actions/tags';
import type { TagDetailResult } from '@/lib/actions/tags';
import { getFieldMeta, formatTagValue, TAG_DOMAIN_LABELS, type TagDomain } from '@/lib/constants/tags';
import { useJurisdictionFromPath } from '@/hooks/useStateFromPath';

export function TagDrawer() {
  const { state: drawerState, close, openTag } = useTagDrawer();
  const jurisdiction = useJurisdictionFromPath();
  const [data, setData] = useState<TagDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!drawerState.isOpen || !drawerState.field || !drawerState.value) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);
    setExpandedDomains(new Set());

    getTagDetail(jurisdiction, drawerState.field, drawerState.value, drawerState.contextDocumentId)
      .then((result) => {
        if (!cancelled && result.success) {
          setData(result.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drawerState.isOpen, drawerState.field, drawerState.value, drawerState.contextDocumentId, jurisdiction]);

  const fieldMeta = drawerState.field ? getFieldMeta(drawerState.field) : undefined;

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  return (
    <Drawer open={drawerState.isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DrawerContent side="right" size="lg">
        <div className="flex flex-col h-full">
          <DrawerHeader>
            <div className="flex-1 min-w-0">
              <DrawerTitle>
                {drawerState.value ? formatTagValue(drawerState.value) : 'Tag Detail'}
              </DrawerTitle>
              {fieldMeta && (
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {fieldMeta.label}
                </p>
              )}
            </div>
            <DrawerClose />
          </DrawerHeader>

          <DrawerBody className="p-4 space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            )}

            {!loading && !data && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
                No data found for this tag.
              </p>
            )}

            {!loading && data && (
              <>
                {/* Context line */}
                {data.contextCount != null && data.contextCount > 0 && (
                  <div className="bg-[var(--color-info-bg)] rounded-[var(--radius-md)] px-3 py-2">
                    <p className="text-xs text-[var(--color-info)]">
                      This document is 1 of {data.contextCount} documents with this tag.
                    </p>
                  </div>
                )}

                {/* Total count */}
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Total Occurrences
                  </h4>
                  <p className="text-2xl font-semibold text-[var(--color-text)]">
                    {data.totalCount.toLocaleString()}
                  </p>
                </div>

                {/* Cross-domain counts */}
                {data.domainCounts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Across Domains
                    </h4>
                    <div className="space-y-2">
                      {data.domainCounts.map((dc) => (
                        <div key={dc.domain}>
                          <button
                            type="button"
                            onClick={() => toggleDomain(dc.domain)}
                            className="flex items-center gap-2 w-full text-left hover:bg-[var(--color-neutral-50)] rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors"
                          >
                            {expandedDomains.has(dc.domain) ? (
                              <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                            )}
                            <span className="text-sm font-medium text-[var(--color-text)]">
                              {TAG_DOMAIN_LABELS[dc.domain as TagDomain] ?? dc.domain}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                              {dc.count.toLocaleString()}
                            </span>
                          </button>
                          {expandedDomains.has(dc.domain) && dc.samples.length > 0 && (
                            <ul className="ml-8 mt-1 space-y-1">
                              {dc.samples.map((s) => (
                                <li key={s.id} className="text-xs">
                                  <Link
                                    href={s.url ?? '#'}
                                    className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline truncate block"
                                    title={s.title}
                                  >
                                    {s.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Similar tags */}
                {data.similarTags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Similar Tags
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.similarTags.map((st) => (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() => {
                            if (drawerState.field) {
                              openTag(drawerState.field, st.value);
                            }
                          }}
                          className="hover:ring-2 hover:ring-[var(--color-primary-weak)] rounded-full transition-all duration-[var(--duration-fast)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
                        >
                          <TagBadge
                            value={st.value}
                            domain={fieldMeta?.domain}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explore link */}
                <div className="pt-2 border-t border-[var(--color-neutral-200)]">
                  <Link
                    href={`/${jurisdiction}/tags`}
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline font-medium"
                  >
                    Explore in Tags Analytics <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </>
            )}
          </DrawerBody>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
