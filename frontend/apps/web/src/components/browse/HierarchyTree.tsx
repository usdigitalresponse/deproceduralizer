'use client';

import { type HierarchyNode } from '@deproceduralizer/database';
import { TreeNode, TreeNodeSkeleton } from './TreeNode';
import { AlertCircle, FolderX } from 'lucide-react';

interface HierarchyTreeProps {
  roots: HierarchyNode[];
  orphans: HierarchyNode[];
  expandedIds: Set<number>;
  selectedId: number | null;
  loadedChildren: Map<number, HierarchyNode[]>;
  loadingIds: Set<number>;
  hasActiveFilters: boolean;
  searchTerm?: string;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number) => void;
  showOrphans: boolean;
  onToggleOrphans: () => void;
}

export function HierarchyTree({
  roots,
  orphans,
  expandedIds,
  selectedId,
  loadedChildren,
  loadingIds,
  hasActiveFilters,
  searchTerm,
  onToggleExpand,
  onSelect,
  showOrphans,
  onToggleOrphans,
}: HierarchyTreeProps) {
  const renderNode = (node: HierarchyNode, depth: number): React.ReactNode => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const isLoading = loadingIds.has(node.id);
    const children = loadedChildren.get(node.id);

    return (
      <TreeNode
        key={node.id}
        node={node}
        depth={depth}
        isExpanded={isExpanded}
        isSelected={isSelected}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        searchTerm={searchTerm}
        onToggleExpand={() => onToggleExpand(node.id)}
        onSelect={() => onSelect(node.id)}
        renderChildren={() =>
          children?.map((child) => renderNode(child, depth + 1))
        }
      />
    );
  };

  if (roots.length === 0 && orphans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-[var(--color-text-muted)]">
        <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">No documents found</p>
        <p className="text-xs mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto h-full p-2"
      role="tree"
      aria-label="Regulatory hierarchy"
    >
      {/* Main hierarchy */}
      {roots.map((node) => renderNode(node, 0))}

      {/* Orphan documents section */}
      {orphans.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          <button
            className={`
              flex items-center gap-2 w-full py-2 px-2 rounded
              text-left text-sm font-medium
              transition-colors duration-[var(--duration-fast)]
              ${showOrphans
                ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                : 'hover:bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]'}
            `}
            onClick={onToggleOrphans}
            aria-label={`Toggle unlinked documents, ${orphans.length} items`}
            aria-expanded={showOrphans}
          >
            <FolderX className="w-4 h-4" aria-hidden="true" />
            <span>Unlinked Documents</span>
            <span className="text-xs ml-auto">({orphans.length})</span>
          </button>

          {showOrphans && (
            <div className="mt-2 pl-2" role="group">
              {orphans.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={1}
                  isExpanded={false}
                  isSelected={selectedId === node.id}
                  isLoading={false}
                  searchTerm={searchTerm}
                  onToggleExpand={() => {}}
                  onSelect={() => onSelect(node.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Loading skeleton for the tree
export function HierarchyTreeSkeleton() {
  return (
    <div className="p-2">
      <TreeNodeSkeleton depth={0} count={5} />
    </div>
  );
}

export default HierarchyTree;
