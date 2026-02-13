'use client';

import { memo } from 'react';
import type { StatuteHierarchyNode } from '@deproceduralizer/database';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import { STATUTE_HIERARCHY_LEVEL_LABELS } from '@/lib/constants/hierarchy';
import { highlightTerm } from '@/lib/utils/highlight';

interface StatuteTreeNodeProps {
  node: StatuteHierarchyNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  searchTerm?: string;
  onToggleExpand: () => void;
  onSelect: () => void;
  renderChildren?: () => React.ReactNode;
}

/**
 * Map hierarchy levels to folder/file icons.
 * Container levels get Folder, sections get FileText.
 */
const containerLevels = new Set(['title', 'chapter', 'article', 'law', 'part', 'subpart']);

export const StatuteTreeNode = memo(function StatuteTreeNode({
  node,
  depth,
  isExpanded,
  isSelected,
  isLoading,
  searchTerm,
  onToggleExpand,
  onSelect,
  renderChildren,
}: StatuteTreeNodeProps) {
  const hasChildren = node.childCount > 0;
  const indentPx = depth * 20;
  const isContainer = containerLevels.has(node.hierarchyLevel || '');
  const Icon = isContainer ? Folder : FileText;
  const levelLabel = STATUTE_HIERARCHY_LEVEL_LABELS[node.hierarchyLevel || ''] || node.hierarchyLevel || 'Document';

  // Dim statutes without any linked regulations
  const hasAnyLinks = node.linkedRegulationCount > 0 || node.enablingAuthorityCount > 0;

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
          flex items-start gap-2 py-1.5 px-2 rounded cursor-pointer
          transition-colors duration-[var(--duration-fast)]
          ${isSelected
            ? 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]'
            : 'hover:bg-[var(--color-neutral-100)]'}
          ${!hasAnyLinks && !isContainer ? 'opacity-60' : ''}
        `}
        style={{ paddingLeft: `${indentPx + 8}px` }}
        onClick={onSelect}
        onDoubleClick={hasChildren ? onToggleExpand : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        title={node.citation}
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
        <div className="flex-1 min-w-0 min-w-[120px]">
          <div className="text-sm font-medium truncate" title={node.title}>
            {highlightTerm(node.title, searchTerm, 'bg-[var(--color-accent-muted)] text-inherit rounded px-0.5')}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
            {/* Level badge */}
            <span className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-[10px] uppercase tracking-wide font-medium">
              {levelLabel}
            </span>
            {/* Citation in monospace */}
            <span className="font-mono text-[var(--color-text-secondary)] text-[10px]">
              {highlightTerm(node.citation, searchTerm, 'bg-[var(--color-accent-muted)] text-inherit rounded px-0.5')}
            </span>
            {/* Child count */}
            {node.childCount > 0 && (
              <span className="ml-auto">({node.childCount})</span>
            )}
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex items-center gap-1 flex-wrap shrink">
          {node.linkedRegulationCount > 0 && (
            <Badge variant="info" className="text-xs">
              {node.linkedRegulationCount} reg{node.linkedRegulationCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {node.enablingAuthorityCount > 0 && (
            <Badge variant="warning" className="text-xs">
              {node.enablingAuthorityCount} auth
            </Badge>
          )}
        </div>
      </div>

      {/* Children (when expanded) */}
      {isExpanded && (
        <div role="group">
          {isLoading ? (
            <StatuteTreeNodeSkeleton depth={depth + 1} count={3} />
          ) : (
            renderChildren?.()
          )}
        </div>
      )}
    </div>
  );
});

// Loading skeleton for children
interface StatuteTreeNodeSkeletonProps {
  depth: number;
  count: number;
}

export function StatuteTreeNodeSkeleton({ depth, count }: StatuteTreeNodeSkeletonProps) {
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

export default StatuteTreeNode;
