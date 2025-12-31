'use client';

import Link from 'next/link';
import { ExternalLink, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { DefinitionGraphNode } from './types';

interface DefinitionNodePopupProps {
  node: DefinitionGraphNode;
  position: { x: number; y: number };
  state: string;
  onClose: () => void;
}

export function DefinitionNodePopup({ node, position, state, onClose }: DefinitionNodePopupProps) {
  // Format scope level for display
  const formatScopeLevel = (level: string | null | undefined) => {
    if (!level) return null;
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  return (
    <div
      className="absolute z-50 bg-white border border-[var(--color-neutral-200)] rounded-lg shadow-lg p-3 min-w-[240px] max-w-[320px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
        top: position.y,
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="pr-6">
        {/* Term name */}
        <h4 className="font-medium text-sm">{node.term}</h4>

        {/* Citation if available */}
        {node.citation && (
          <p className="text-xs font-mono text-[var(--color-text-secondary)] mt-0.5 bg-[var(--color-neutral-50)] px-1.5 py-0.5 rounded">
            {node.citation}
          </p>
        )}

        {/* Badges row: scope level + definition type */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {node.scopeLevel && (
            <span className="text-xs bg-[var(--color-primary-bg)] text-[var(--color-primary)] px-1.5 py-0.5 rounded">
              {formatScopeLevel(node.scopeLevel)}
            </span>
          )}
          {node.definitionType && (
            <span className="text-xs bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded capitalize">
              {node.definitionType}
            </span>
          )}
        </div>

        {/* Connection counts */}
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-[#3b82f6]">
            <ArrowUpRight className="w-3 h-3" />
            {node.outDegree} out
          </span>
          <span className="flex items-center gap-1 text-[#22c55e]">
            <ArrowDownLeft className="w-3 h-3" />
            {node.inDegree} in
          </span>
        </div>

        {/* Link to source section */}
        {node.documentId && (
          <Link
            href={`/${state.toLowerCase()}/regulations/${node.documentId}`}
            target="_blank"
            className="flex items-center gap-1 mt-3 text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Source Section
          </Link>
        )}
      </div>
    </div>
  );
}
