import Link from 'next/link';
import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';
import { ChevronRight } from 'lucide-react';

interface HierarchyBreadcrumbsServerProps {
  documentId: number;
  currentTitle: string;
  state: string;
}

const levelLabels: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  chapter: 'Chapter',
  subchapter: 'Subchapter',
  article: 'Article',
  part: 'Part',
  subpart: 'Subpart',
  section: 'Section',
};

/**
 * Server-side hierarchy breadcrumbs for regulation detail pages
 * Each ancestor links to its own detail page
 */
export async function HierarchyBreadcrumbsServer({
  documentId,
  currentTitle,
  state,
}: HierarchyBreadcrumbsServerProps) {
  const repo = new RegulatoryDocumentsRepository(db);
  const ancestors = await repo.getAncestorChain(documentId);

  if (ancestors.length === 0) {
    return null;
  }

  // Truncate title for display
  const truncateTitle = (title: string, maxLength: number = 50) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  // Clean up title display (remove common prefixes)
  const cleanTitle = (title: string) => {
    return title
      .replace(/^N\.Y\. Comp\. Codes R\. & Regs\.?\s*/i, '')
      .replace(/^N\.J\. Admin\. Code\s*§?\s*/i, '')
      .replace(/^Title \d+ - /, '')
      .trim() || title;
  };

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
            <span className="font-medium text-[var(--color-text-secondary)] mr-1">
              {levelLabels[ancestor.hierarchyLevel || ''] || ancestor.hierarchyLevel}:
            </span>
            {truncateTitle(cleanTitle(ancestor.title), 40)}
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
          {truncateTitle(cleanTitle(currentTitle), 40)}
        </span>
      </span>
    </nav>
  );
}

export default HierarchyBreadcrumbsServer;
