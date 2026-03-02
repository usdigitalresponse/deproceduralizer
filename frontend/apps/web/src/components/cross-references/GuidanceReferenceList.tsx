'use client';

import Link from 'next/link';
import { EntityTypeIndicator } from '@/components/ui';
import { PolicyCategoryBadge } from '@/components/guidance/PolicyCategoryBadge';
import type { GuidanceReferenceItem } from '@/lib/actions/cross-references';

interface GuidanceReferenceListProps {
  items: GuidanceReferenceItem[];
  state: string;
  compact?: boolean;
  limit?: number;
}

export function GuidanceReferenceList({
  items,
  state,
  compact = false,
  limit = 0,
}: GuidanceReferenceListProps) {
  const displayItems = limit > 0 ? items.slice(0, limit) : items;
  const hasMore = limit > 0 && items.length > limit;

  if (items.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">
        No guidance documents reference this regulation.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <EntityTypeIndicator type="guidance_document" size="md" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Referenced by Guidance ({items.length})
        </h3>
      </div>

      <div className="space-y-2">
        {displayItems.map((item) => (
          <div
            key={`${item.id}-${item.citationText}`}
            className="p-2 rounded-[var(--radius-md)] border border-[var(--color-neutral-100)] hover:border-[var(--color-neutral-300)] transition-colors"
          >
            <Link
              href={`/${state}/guidance/${item.id}`}
              className="text-sm font-medium text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline line-clamp-2"
            >
              {item.title}
            </Link>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-[var(--color-text-muted)]">{item.agency}</span>
              {item.policyCategory && !compact && (
                <PolicyCategoryBadge category={item.policyCategory} />
              )}
              {item.canonicalRef && (
                <span className="text-xs text-[var(--color-text-muted)]">{item.canonicalRef}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <p className="text-xs text-[var(--color-text-muted)] mt-3 text-center">
          +{items.length - limit} more guidance documents
        </p>
      )}
    </div>
  );
}
