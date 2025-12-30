'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { getAncestorChain, getDirectChildren } from '@/lib/actions/hierarchy';
import { HierarchyTreeNodeCompact } from './HierarchyTreeNodeCompact';

interface TreeNode {
  id: number;
  title: string | null;
  shortTitle: string | null;
  summary: string | null;
  hierarchyLevel: number | null;
  children?: TreeNode[];
  isLoading?: boolean;
}

interface HierarchyTreeViewProps {
  documentId: number;
  state: string;
  /** Label for the expandable section */
  label?: string;
  /** Whether expanded by default */
  defaultExpanded?: boolean;
}

/**
 * Displays a full hierarchy tree for a regulation document.
 * Shows ancestors (root to parent), current document (highlighted),
 * and children (expandable on demand).
 */
export function HierarchyTreeView({
  documentId,
  state,
  label = 'View Hierarchy',
  defaultExpanded = false,
}: HierarchyTreeViewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ancestors, setAncestors] = useState<TreeNode[]>([]);
  const [children, setChildren] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<number, TreeNode[]>>(new Map());

  // Load hierarchy data when expanded
  useEffect(() => {
    if (!isExpanded) return;

    const loadHierarchy = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [ancestorResult, childrenResult] = await Promise.all([
          getAncestorChain(documentId),
          getDirectChildren(documentId),
        ]);

        if (ancestorResult.success) {
          setAncestors(
            ancestorResult.data.map((a) => ({
              id: a.id,
              title: a.title,
              shortTitle: a.shortTitle,
              summary: a.summary,
              hierarchyLevel: a.hierarchyLevel ? parseInt(a.hierarchyLevel) : null,
            }))
          );
        } else {
          console.error('Failed to load ancestors:', ancestorResult.error);
        }

        if (childrenResult.success) {
          setChildren(
            childrenResult.data.map((c) => ({
              id: c.id,
              title: c.title,
              shortTitle: c.shortTitle,
              summary: c.summary,
              hierarchyLevel: c.hierarchyLevel ? parseInt(c.hierarchyLevel) : null,
            }))
          );
        } else {
          console.error('Failed to load children:', childrenResult.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
      } finally {
        setIsLoading(false);
      }
    };

    loadHierarchy();
  }, [isExpanded, documentId]);

  // Load children for a specific node on demand
  const loadNodeChildren = useCallback(async (nodeId: number) => {
    if (loadedChildren.has(nodeId)) {
      // Already loaded, just toggle expansion
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
      return;
    }

    // Mark as loading by adding to expanded with empty children
    setExpandedNodes((prev) => new Set(prev).add(nodeId));

    try {
      const result = await getDirectChildren(nodeId);
      if (result.success) {
        setLoadedChildren((prev) => {
          const next = new Map(prev);
          next.set(
            nodeId,
            result.data.map((c) => ({
              id: c.id,
              title: c.title,
              shortTitle: c.shortTitle,
              summary: c.summary,
              hierarchyLevel: c.hierarchyLevel ? parseInt(c.hierarchyLevel) : null,
            }))
          );
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load children for node', nodeId, err);
    }
  }, [loadedChildren]);

  const toggleNode = useCallback((nodeId: number) => {
    if (expandedNodes.has(nodeId)) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    } else {
      loadNodeChildren(nodeId);
    }
  }, [expandedNodes, loadNodeChildren]);

  const renderNode = (node: TreeNode, depth: number, isCurrentDoc: boolean = false) => {
    const isNodeExpanded = expandedNodes.has(node.id);
    const nodeChildren = loadedChildren.get(node.id) || [];
    const hasChildren = nodeChildren.length > 0 || (!loadedChildren.has(node.id) && !isCurrentDoc);

    return (
      <div key={node.id}>
        <HierarchyTreeNodeCompact
          node={{
            ...node,
            summary: node.summary || null,
          }}
          depth={depth}
          isCurrentDocument={isCurrentDoc}
          isExpanded={isNodeExpanded}
          hasChildren={hasChildren && !isCurrentDoc}
          state={state}
          onToggle={() => toggleNode(node.id)}
        />
        {isNodeExpanded && nodeChildren.length > 0 && (
          <div>
            {nodeChildren.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-4 mt-4 border-t border-[var(--color-neutral-200)] pt-4">
      {/* Expandable Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors py-1"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {label}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading hierarchy...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-danger)] py-4 justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Ancestors (from root to parent) */}
              {ancestors.map((ancestor, idx) => (
                <HierarchyTreeNodeCompact
                  key={ancestor.id}
                  node={ancestor}
                  depth={idx}
                  isCurrentDocument={false}
                  isExpanded={true}
                  hasChildren={idx < ancestors.length - 1}
                  state={state}
                />
              ))}

              {/* Current Document */}
              <HierarchyTreeNodeCompact
                node={{
                  id: documentId,
                  title: 'Current Document',
                  shortTitle: null,
                  summary: null,
                  hierarchyLevel: null,
                }}
                depth={ancestors.length}
                isCurrentDocument={true}
                isExpanded={children.length > 0}
                hasChildren={children.length > 0}
                state={state}
                onToggle={() => {
                  // Toggle showing immediate children
                  if (expandedNodes.has(documentId)) {
                    setExpandedNodes((prev) => {
                      const next = new Set(prev);
                      next.delete(documentId);
                      return next;
                    });
                  } else {
                    setExpandedNodes((prev) => new Set(prev).add(documentId));
                  }
                }}
              />

              {/* Immediate Children */}
              {children.length > 0 && (
                <div>
                  {children.map((child) => renderNode(child, ancestors.length + 1))}
                </div>
              )}

              {/* No children message */}
              {ancestors.length === 0 && children.length === 0 && (
                <div className="text-xs text-[var(--color-text-muted)] py-2 text-center">
                  This document has no parent or child documents.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HierarchyTreeView;
