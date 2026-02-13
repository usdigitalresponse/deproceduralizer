'use client';

import type { StatuteHierarchyNode } from '@deproceduralizer/database';
import { StatuteTreeNode, StatuteTreeNodeSkeleton } from './StatuteTreeNode';
import { AlertCircle } from 'lucide-react';

interface StatuteHierarchyTreeProps {
  roots: StatuteHierarchyNode[];
  expandedIds: Set<number>;
  selectedId: number | null;
  loadedChildren: Map<number, StatuteHierarchyNode[]>;
  loadingIds: Set<number>;
  searchTerm?: string;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number) => void;
}

export function StatuteHierarchyTree({
  roots,
  expandedIds,
  selectedId,
  loadedChildren,
  loadingIds,
  searchTerm,
  onToggleExpand,
  onSelect,
}: StatuteHierarchyTreeProps) {
  const renderNode = (node: StatuteHierarchyNode, depth: number): React.ReactNode => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const isLoading = loadingIds.has(node.id);
    const children = loadedChildren.get(node.id);

    return (
      <StatuteTreeNode
        key={node.id}
        node={node}
        depth={depth}
        isExpanded={isExpanded}
        isSelected={isSelected}
        isLoading={isLoading}
        searchTerm={searchTerm}
        onToggleExpand={() => onToggleExpand(node.id)}
        onSelect={() => onSelect(node.id)}
        renderChildren={() =>
          children?.map((child) => renderNode(child, depth + 1))
        }
      />
    );
  };

  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-[var(--color-text-muted)]">
        <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">No statutes found</p>
        <p className="text-xs mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto h-full p-2"
      role="tree"
      aria-label="Statute hierarchy"
    >
      {roots.map((node) => renderNode(node, 0))}
    </div>
  );
}

// Loading skeleton for the tree
export function StatuteHierarchyTreeSkeleton() {
  return (
    <div className="p-2">
      <StatuteTreeNodeSkeleton depth={0} count={5} />
    </div>
  );
}

export default StatuteHierarchyTree;
