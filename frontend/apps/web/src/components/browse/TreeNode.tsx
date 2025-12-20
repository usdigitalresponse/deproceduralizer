'use client';

import { type HierarchyNode } from '@deproceduralizer/database';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { ChevronRight, ChevronDown, FileText, BookOpen, Folder } from 'lucide-react';

interface TreeNodeProps {
  node: HierarchyNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  hasActiveFilters?: boolean;
  searchTerm?: string;
  children?: HierarchyNode[];
  onToggleExpand: () => void;
  onSelect: () => void;
  renderChildren?: () => React.ReactNode;
}

// Highlight matching text in a string
function highlightMatch(text: string, searchTerm: string | undefined): React.ReactNode {
  if (!searchTerm || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerSearch);

  if (index === -1) return text;

  return (
    <>
      {text.substring(0, index)}
      <mark className="bg-[var(--color-accent-muted)] text-inherit rounded px-0.5">
        {text.substring(index, index + searchTerm.length)}
      </mark>
      {text.substring(index + searchTerm.length)}
    </>
  );
}

const levelIcons: Record<string, typeof Folder> = {
  title: Folder,
  subtitle: Folder,
  chapter: Folder,
  subchapter: Folder,
  article: Folder,
  part: Folder,
  subpart: Folder,
  section: FileText,
};

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

export function TreeNode({
  node,
  depth,
  isExpanded,
  isSelected,
  isLoading,
  hasActiveFilters = false,
  searchTerm,
  onToggleExpand,
  onSelect,
  renderChildren,
}: TreeNodeProps) {
  const hasChildren = node.childCount > 0;
  const indentPx = depth * 20;
  const Icon = levelIcons[node.hierarchyLevel || ''] || FileText;
  const levelLabel = levelLabels[node.hierarchyLevel || ''] || node.hierarchyLevel || 'Document';

  // Filter match indicators
  const showMatchCounts = hasActiveFilters && hasChildren;
  const hasMatches = node.matchingChildCount > 0 || node.matchingDescendantCount > 0;

  // Extract display title (remove "N.Y. Comp. Codes R. & Regs." prefix if present)
  const displayTitle = node.title
    .replace(/^N\.Y\. Comp\. Codes R\. & Regs\.?\s*(tit\.\s*\d+,?\s*)?(ch\.\s*[^,]+,?\s*)?(subch\.\s*[^,]+,?\s*)?(art\.\s*[^,]+,?\s*)?(pt\.\s*[^,]+\s*)?-?\s*/i, '')
    .replace(/^Title \d+ - /, '')
    .trim() || node.title;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.key === ' ' && hasChildren) {
        onToggleExpand();
      } else {
        onSelect();
      }
    }
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggleExpand();
    }
    if (e.key === 'ArrowLeft' && isExpanded) {
      e.preventDefault();
      onToggleExpand();
    }
  };

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
      <div
        className={`
          flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer
          transition-colors duration-[var(--duration-fast)]
          ${isSelected
            ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
            : 'hover:bg-[var(--color-neutral-100)]'}
        `}
        style={{ paddingLeft: `${indentPx + 8}px` }}
        onClick={onSelect}
        onDoubleClick={hasChildren ? onToggleExpand : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        title={node.hierarchyPath || undefined}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-[var(--color-neutral-200)] rounded shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Icon */}
        <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />

        {/* Node content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" title={node.title}>
            {highlightMatch(displayTitle, searchTerm)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
            {/* Level badge */}
            <span className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-[10px] uppercase tracking-wide font-medium">
              {levelLabel}
            </span>
            {/* NYCRR citation */}
            {(node.nycrrTitle || node.nycrrPart) && (
              <span className="text-[var(--color-text-secondary)]">
                {node.nycrrTitle && `Title ${node.nycrrTitle}`}
                {node.nycrrTitle && node.nycrrPart && ' · '}
                {node.nycrrPart && `Part ${node.nycrrPart}`}
              </span>
            )}
            {/* Child/match counts */}
            {node.childCount > 0 && (
              <span className="ml-auto flex items-center gap-1.5">
                {showMatchCounts ? (
                  <>
                    {/* Matching children indicator */}
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-success-bg)] text-[var(--color-success)]"
                      title={`${node.matchingChildCount} direct children match filters`}
                    >
                      {node.matchingChildCount}/{node.childCount}
                    </span>
                    {/* Total matching descendants */}
                    {node.matchingDescendantCount > 0 && (
                      <span
                        className="text-[10px] text-[var(--color-text-muted)]"
                        title={`${node.matchingDescendantCount} total items match filters in this branch`}
                      >
                        ({node.matchingDescendantCount} total)
                      </span>
                    )}
                  </>
                ) : (
                  <span>({node.childCount})</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex items-center gap-1 shrink-0">
          {node.hasDefinitions && (
            <Badge variant="info" className="text-xs">
              <BookOpen className="w-3 h-3 mr-1" />
              Defs
            </Badge>
          )}
          {node.totalFlags > 0 && (
            <Badge variant="danger" className="text-xs">
              {node.totalFlags} flags
            </Badge>
          )}
          {node.totalComplianceIssues > 0 && (
            <Badge
              variant="warning"
              className="text-xs"
              title={`${node.complianceIssueCount} direct + ${node.totalComplianceIssues - node.complianceIssueCount} in descendants`}
            >
              {node.totalComplianceIssues} compliance
            </Badge>
          )}
          {node.maxSeverity !== null && (
            <SeverityBadge severity={node.maxSeverity} className="text-xs" />
          )}
        </div>
      </div>

      {/* Children (when expanded) */}
      {isExpanded && (
        <div role="group">
          {isLoading ? (
            <TreeNodeSkeleton depth={depth + 1} count={3} />
          ) : (
            renderChildren?.()
          )}
        </div>
      )}
    </div>
  );
}

// Loading skeleton for children
interface TreeNodeSkeletonProps {
  depth: number;
  count: number;
}

export function TreeNodeSkeleton({ depth, count }: TreeNodeSkeletonProps) {
  const indentPx = depth * 20;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 py-1.5 px-2 animate-pulse"
          style={{ paddingLeft: `${indentPx + 8}px` }}
        >
          <span className="w-5 shrink-0" />
          <div className="w-4 h-4 bg-[var(--color-neutral-200)] rounded shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-[var(--color-neutral-200)] rounded w-3/4 mb-1" />
            <div className="h-3 bg-[var(--color-neutral-100)] rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

export default TreeNode;
