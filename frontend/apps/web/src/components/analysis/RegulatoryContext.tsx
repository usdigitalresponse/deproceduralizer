import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDisplayTitle, truncateTitle } from '@/lib/format';
import { getHierarchyLevelLabel } from '@/lib/constants/hierarchy';
import { Badge } from '@/components/ui';

interface AncestorNode {
  id: number;
  title: string;
  hierarchyLevel: string | null;
  shortTitle: string | null;
  summary: string | null;
  levelIdentifier: string | null;
  citation: string | null;
  nycrrTitle: number | null;
  nycrrPart: string | null;
  nycrrChapter: string | null;
  njacTitle: string | null;
  njacChapter: string | null;
  njacSubchapter: string | null;
  jurisdiction: string | null;
}

interface DocumentContext {
  id: number;
  title: string | null;
  citation: string | null;
  summary: string | null;
  keywords: string[] | null;
  appliesTo: string[] | null;
  hierarchyLevel: string | null;
}

interface RegulatoryContextProps {
  ancestors: AncestorNode[];
  document: DocumentContext;
  state: string;
}

export function RegulatoryContext({ ancestors, document, state }: RegulatoryContextProps) {
  const hasAncestors = ancestors.length > 0;
  const hasSummary = !!document.summary;
  const hasKeywords = document.keywords && document.keywords.length > 0;
  const hasAppliesTo = document.appliesTo && document.appliesTo.length > 0;
  const hasTags = hasKeywords || hasAppliesTo;

  // Don't render if there's no context to show
  if (!hasAncestors && !hasSummary && !hasTags) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
      {/* Hierarchy Breadcrumb */}
      {hasAncestors && (
        <nav className="flex flex-wrap items-center gap-1 text-sm mb-3" aria-label="Regulatory hierarchy">
          <Link
            href={`/${state}/browse`}
            className="
              px-2 py-0.5 rounded
              text-[var(--color-link)] hover:text-[var(--color-link-hover)]
              hover:bg-[var(--color-neutral-100)]
              transition-colors duration-[var(--duration-fast)]
            "
          >
            Browse
          </Link>

          {ancestors.map((ancestor) => (
            <span key={ancestor.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <Link
                href={`/${state}/regulations/${ancestor.id}`}
                className="
                  px-2 py-0.5 rounded
                  text-[var(--color-link)] hover:text-[var(--color-link-hover)]
                  hover:bg-[var(--color-neutral-100)]
                  transition-colors duration-[var(--duration-fast)]
                  max-w-[250px] truncate inline-block
                "
                title={ancestor.title}
              >
                {truncateTitle(formatDisplayTitle(ancestor), 35)}
              </Link>
            </span>
          ))}

          {/* Current document level label */}
          {document.hierarchyLevel && (
            <span className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="px-2 py-0.5 text-[var(--color-text-secondary)] font-medium text-sm">
                {getHierarchyLevelLabel(document.hierarchyLevel)}
              </span>
            </span>
          )}
        </nav>
      )}

      {/* Summary */}
      {hasSummary && (
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
          {document.summary}
        </p>
      )}

      {/* Tags Row */}
      {hasTags && (
        <div className="flex flex-wrap items-center gap-2">
          {hasKeywords && document.keywords!.map((keyword) => (
            <Badge key={keyword} variant="default" className="text-xs">
              {keyword}
            </Badge>
          ))}
          {hasAppliesTo && document.appliesTo!.map((entity) => (
            <Badge key={entity} variant="info" className="text-xs">
              {entity}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
