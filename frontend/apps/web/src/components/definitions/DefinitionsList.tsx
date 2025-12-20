'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { DefinitionWithContext } from '@deproceduralizer/database';

interface DefinitionsListProps {
  definitions: DefinitionWithContext[];
  /** State for context (used in display) */
  state?: string;
  /** Whether the section is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
}

/**
 * Displays a list of definitions for a regulation detail page
 * Follows the same pattern as ComplianceIssuesList
 */
export function DefinitionsList({
  definitions,
  state = 'ny',
  collapsible = true,
  initialCollapsed = false,
}: DefinitionsListProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [expandedDefinitions, setExpandedDefinitions] = useState<Set<number>>(new Set());

  const toggleDefinition = (id: number) => {
    setExpandedDefinitions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (definitions.length === 0) {
    return null;
  }

  // Sort definitions alphabetically by term
  const sortedDefinitions = [...definitions].sort((a, b) =>
    a.term.toLowerCase().localeCompare(b.term.toLowerCase())
  );

  return (
    <Card>
      {/* Header */}
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--color-info)]" />
          <h2 className="font-semibold text-[var(--color-text)]">
            Definitions ({definitions.length})
          </h2>
        </div>
        {collapsible && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="p-1"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronUp className="w-5 h-5" />
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="mt-4 space-y-3">
          {sortedDefinitions.map((definition) => {
            const isExpanded = expandedDefinitions.has(definition.id);
            const maxLength = 200;
            const isLongDefinition = definition.definition.length > maxLength;
            const displayDefinition = isExpanded
              ? definition.definition
              : definition.definition.slice(0, maxLength) + (isLongDefinition ? '...' : '');

            return (
              <div
                key={definition.id}
                className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)]"
              >
                {/* Term and scope */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-[var(--color-text)]">
                    {definition.term}
                  </span>
                  {definition.scope && (
                    <Badge variant="info">{definition.scope}</Badge>
                  )}
                </div>

                {/* Definition text */}
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                  {displayDefinition}
                </p>

                {/* Expand/collapse for long definitions */}
                {isLongDefinition && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDefinition(definition.id)}
                    className="mt-2 text-xs py-0.5 px-2 h-auto flex items-center gap-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Show full definition
                      </>
                    )}
                  </Button>
                )}

                {/* Source location */}
                {definition.sourceLocation && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    <span className="font-medium">Source:</span> {definition.sourceLocation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default DefinitionsList;
