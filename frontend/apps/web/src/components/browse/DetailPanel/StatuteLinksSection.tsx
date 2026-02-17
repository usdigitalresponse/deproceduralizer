import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EntityTypeIndicator } from '@/components/ui';
import { LINK_TYPE_LABELS, MATCH_STATUS_LABELS } from '@/lib/constants/values';
import type { RegulationStatuteLinkWithStatute } from '@deproceduralizer/database';

interface StatuteLinksSectionProps {
  links: RegulationStatuteLinkWithStatute[];
  state: string;
  documentId: number;
  currentUrl: string;
}

/** Map match status to badge variant */
function getMatchStatusVariant(status: string): 'success' | 'info' | 'warning' | 'default' {
  switch (status) {
    case 'matched':
      return 'success';
    case 'corrected':
      return 'info';
    case 'unmatched':
      return 'warning';
    case 'obsolete':
      return 'default';
    default:
      return 'default';
  }
}

export function StatuteLinksSection({ links, state, documentId, currentUrl }: StatuteLinksSectionProps) {
  if (links.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
        <EntityTypeIndicator type="statute" size="sm" />
        Statute Links ({links.length})
      </h3>
      <div className="space-y-2">
        {links.slice(0, 3).map((link) => (
          <div key={link.linkId} className="text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {link.statute?.id ? (
                <Link
                  href={`/${state}/statutes/${link.statute.id}`}
                  className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] font-medium"
                >
                  {link.citation}
                </Link>
              ) : (
                <span className="text-[var(--color-text)] font-medium">
                  {link.citation}
                </span>
              )}
              <Badge variant={getMatchStatusVariant(link.matchStatus)}>
                {LINK_TYPE_LABELS[link.linkType] || link.linkType}
              </Badge>
            </div>
            {link.statute?.title && (
              <p className="text-[var(--color-text-muted)] text-xs mt-0.5 line-clamp-1">
                {link.statute.title}
              </p>
            )}
          </div>
        ))}
        {links.length > 3 && (
          <Link
            href={`/${state}/regulations/${documentId}?from=${encodeURIComponent(currentUrl)}`}
            className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
          >
            View all {links.length} statute links...
          </Link>
        )}
      </div>
    </div>
  );
}
