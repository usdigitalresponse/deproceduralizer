'use client';

import { useMemo, useState, useCallback } from 'react';
import { Group } from '@visx/group';
import { Tree, hierarchy } from '@visx/hierarchy';
import { pointRadial } from 'd3-shape';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import type { DefinitionHierarchyNode } from './types';

// Colors by hierarchy level
const LEVEL_COLORS: Record<string, string> = {
  root: '#6b7280',
  title: '#dc2626',
  chapter: '#f97316',
  part: '#22c55e',
  section: '#3b82f6',
};

interface NodePopupData {
  node: DefinitionHierarchyNode;
  x: number;
  y: number;
}

interface DefinitionEdgeBundlingProps {
  data: DefinitionHierarchyNode;
  width: number;
  height: number;
  state: string;
}

// Helper to flatten hierarchy for definition nodes
function flattenDefinitions(node: DefinitionHierarchyNode): DefinitionHierarchyNode[] {
  const result: DefinitionHierarchyNode[] = [];

  function traverse(n: DefinitionHierarchyNode) {
    if (n.definitions && n.definitions.length > 0) {
      result.push(n);
    }
    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return result;
}

export function DefinitionEdgeBundling({ data, width, height, state }: DefinitionEdgeBundlingProps) {
  const [popup, setPopup] = useState<NodePopupData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Create hierarchy from data
  const root = useMemo(() => {
    return hierarchy<DefinitionHierarchyNode>(data);
  }, [data]);

  // Get nodes with definitions for the bundle lines
  const nodesWithDefinitions = useMemo(() => {
    return flattenDefinitions(data);
  }, [data]);

  // Calculate layout dimensions
  const margin = { top: 30, right: 30, bottom: 30, left: 30 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const radius = Math.min(innerWidth, innerHeight) / 2;

  // Handle node click
  const handleNodeClick = useCallback((node: DefinitionHierarchyNode, event: React.MouseEvent) => {
    const rect = (event.target as SVGElement).getBoundingClientRect();
    setPopup({
      node,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY - 10,
    });
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopup(null);
  }, []);

  if (!root.children || root.children.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        No hierarchy data available
      </div>
    );
  }

  return (
    <div className="relative">
      <svg width={width} height={height}>
        <Group top={height / 2} left={width / 2}>
          <Tree<DefinitionHierarchyNode>
            root={root}
            size={[2 * Math.PI, radius - 80]}
            separation={(a, b) => (a.parent === b.parent ? 1 : 2) / a.depth}
          >
            {(tree) => (
              <Group>
                {/* Draw links (edges) */}
                {tree.links().map((link, i) => {
                  // Calculate positions using radial coordinates
                  const [sx, sy] = pointRadial(link.source.x, link.source.y);
                  const [tx, ty] = pointRadial(link.target.x, link.target.y);

                  // Mid-point for curved path
                  const mx = (sx + tx) / 2;
                  const my = (sy + ty) / 2;

                  return (
                    <path
                      key={`link-${i}`}
                      d={`M${sx},${sy} Q${mx * 0.5},${my * 0.5} ${tx},${ty}`}
                      fill="none"
                      stroke="var(--color-neutral-300)"
                      strokeWidth={1}
                      strokeOpacity={0.4}
                    />
                  );
                })}

                {/* Draw nodes */}
                {tree.descendants().map((node, i) => {
                  const [x, y] = pointRadial(node.x, node.y);
                  const isHovered = hoveredNode === node.data.id;
                  const nodeColor = LEVEL_COLORS[node.data.level] ?? 'var(--color-neutral-400)';
                  const hasDefinitions = node.data.definitions && node.data.definitions.length > 0;

                  // Node size based on level and definition count
                  const baseSize = node.depth === 0 ? 8 : 4 + (hasDefinitions ? node.data.definitions!.length * 0.5 : 0);
                  const nodeSize = Math.min(baseSize, 12);

                  // Label visibility and rotation
                  const showLabel = node.depth <= 2; // Only show labels for title and chapter levels
                  const angle = (node.x * 180) / Math.PI - 90;
                  const labelRadius = node.y + 12;
                  const [labelX, labelY] = pointRadial(node.x, labelRadius);
                  const flipLabel = node.x > Math.PI;

                  return (
                    <Group key={`node-${i}`}>
                      {/* Node circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? nodeSize + 2 : nodeSize}
                        fill={nodeColor}
                        stroke={isHovered ? 'var(--color-primary)' : 'white'}
                        strokeWidth={isHovered ? 2 : 1}
                        style={{ cursor: hasDefinitions ? 'pointer' : 'default' }}
                        onMouseEnter={() => setHoveredNode(node.data.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={(e) => hasDefinitions && handleNodeClick(node.data, e)}
                      />

                      {/* Node label */}
                      {showLabel && (
                        <text
                          x={labelX}
                          y={labelY}
                          fontSize={10}
                          textAnchor={flipLabel ? 'end' : 'start'}
                          transform={`rotate(${flipLabel ? angle + 180 : angle}, ${labelX}, ${labelY})`}
                          fill="var(--color-text-secondary)"
                          style={{ pointerEvents: 'none' }}
                        >
                          {node.data.name}
                        </text>
                      )}
                    </Group>
                  );
                })}
              </Group>
            )}
          </Tree>
        </Group>
      </svg>

      {/* Popup for nodes with definitions */}
      {popup && (
        <div
          className="fixed z-50 bg-white border border-[var(--color-neutral-200)] rounded-lg shadow-lg p-3 min-w-[200px] max-w-[280px]"
          style={{
            left: Math.min(popup.x, window.innerWidth - 300),
            top: popup.y,
          }}
        >
          <button
            onClick={handleClosePopup}
            className="absolute top-2 right-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="pr-6">
            <h4 className="font-medium text-sm">{popup.node.name}</h4>
            <span
              className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded capitalize"
              style={{
                backgroundColor: `${LEVEL_COLORS[popup.node.level]}20`,
                color: LEVEL_COLORS[popup.node.level],
              }}
            >
              {popup.node.level}
            </span>

            {popup.node.definitions && popup.node.definitions.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  {popup.node.definitions.length} definition{popup.node.definitions.length !== 1 ? 's' : ''}:
                </p>
                <ul className="space-y-1 max-h-[150px] overflow-y-auto">
                  {popup.node.definitions.slice(0, 5).map((def) => (
                    <li key={def.definitionId} className="text-xs">
                      <Link
                        href={`/${state.toLowerCase()}/regulations/${def.documentId}`}
                        target="_blank"
                        className="flex items-center gap-1 text-[var(--color-link)] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{def.term}</span>
                      </Link>
                    </li>
                  ))}
                  {popup.node.definitions.length > 5 && (
                    <li className="text-xs text-[var(--color-text-muted)]">
                      +{popup.node.definitions.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-3 text-xs bg-white/90 p-2 rounded">
        {Object.entries(LEVEL_COLORS).filter(([k]) => k !== 'root').map(([level, color]) => (
          <div key={level} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
