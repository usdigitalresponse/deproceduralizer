import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDisplayTitle, truncateTitle } from '@/lib/format';
import { getAncestorChain } from '@/lib/actions/hierarchy';
import { getHierarchyLevelLabel } from '@/lib/constants/hierarchy';

interface HierarchyBreadcrumbsServerProps {
  documentId: number;
  currentTitle: string;
  state: string;
}

/**
 * Server-side hierarchy breadcrumbs for regulation detail pages
 * Each ancestor links to its own detail page
 */
export async function HierarchyBreadcrumbsServer({
  documentId,
  currentTitle,
  state,
}: HierarchyBreadcrumbsServerProps) {
  const result = await getAncestorChain(documentId);

  if (!result.success || result.data.length === 0) {
    return null;
  }

  const ancestors = result.data;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Hierarchy breadcrumb">
      {/* Browse link */}
      <Link
        href={`/${state}/browse`}
        className="
          px-2 py-1 rounded
          text-[var(--color-link)] hover:text-[var(--color-link-hover)]
          hover:bg-[var(--color-neutral-100)]
          transition-colors duration-[var(--duration-fast)]
        "
      >
        Browse
      </Link>

      {ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          <Link
            href={`/${state}/regulations/${ancestor.id}`}
            className="
              px-2 py-1 rounded
              text-[var(--color-link)] hover:text-[var(--color-link-hover)]
              hover:bg-[var(--color-neutral-100)]
              transition-colors duration-[var(--duration-fast)]
              max-w-[250px] truncate inline-block
            "
            title={ancestor.title}
          >
            {truncateTitle(formatDisplayTitle(ancestor), 40)}
          </Link>
        </span>
      ))}

      {/* Current document (not clickable) */}
      <span className="flex items-center gap-1">
        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
        <span
          className="px-2 py-1 text-[var(--color-text)] font-medium max-w-[250px] truncate inline-block"
          title={currentTitle}
        >
          {truncateTitle(currentTitle, 40)}
        </span>
      </span>
    </nav>
  );
}

export default HierarchyBreadcrumbsServer;
