import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatDisplayTitle, truncateTitle } from '@/lib/format';
import { getDirectChildren } from '@/lib/actions/hierarchy';

interface ChildrenListServerProps {
  documentId: number;
  state: string;
}

/**
 * Server-side children list for regulation detail pages
 * Each child links to its own detail page
 * Returns null if no children exist (so the Card wrapper is also not shown)
 */
export async function ChildrenListServer({
  documentId,
  state,
}: ChildrenListServerProps) {
  const result = await getDirectChildren(documentId);

  if (!result.success || result.data.length === 0) {
    return null;
  }

  const children = result.data;

  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-text)] mb-3">
        Contains ({children.length})
      </h2>
      <div className="space-y-2">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/${state}/regulations/${child.id}`}
            className="
              flex items-center justify-between gap-3 p-3 rounded-[var(--radius-md)]
              bg-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-100)]
              border border-[var(--color-neutral-200)]
              transition-colors duration-[var(--duration-fast)]
              group
            "
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-link)] shrink-0" />
              <span
                className="text-sm text-[var(--color-text)] group-hover:text-[var(--color-link)] min-w-0"
                title={child.title}
              >
                {truncateTitle(formatDisplayTitle(child), 60)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {child.numFlags > 0 && (
                <Badge variant="danger" className="text-xs">
                  {child.numFlags} {child.numFlags === 1 ? 'flag' : 'flags'}
                </Badge>
              )}
              {child.maxSeverity !== null && (
                <SeverityBadge severity={child.maxSeverity} className="text-xs" />
              )}
              {!child.hasAnalysis && (
                <Badge variant="default" className="text-xs">
                  Not analyzed
                </Badge>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default ChildrenListServer;
