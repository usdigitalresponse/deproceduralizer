'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { ApplicableDefinition } from '@deproceduralizer/database';

interface ApplicableDefinitionsProps {
  definitions: ApplicableDefinition[];
  state: string;
  /** Whether to start collapsed (default: true to save space) */
  initialCollapsed?: boolean;
}

/**
 * Get the display definition text based on verbatim/rephrased logic
 */
function getDisplayDefinitionText(definition: ApplicableDefinition): string {
  if (definition.isVerbatim) {
    return definition.verbatimText;
  }
  return definition.rephrasedDefinition ?? definition.verbatimText;
}

/**
 * Displays definitions that apply to a section from parent hierarchy (percolation).
 * Grouped by scope level with collapsible sections.
 */
export function ApplicableDefinitions({
  definitions,
  state,
  initialCollapsed = true,
}: ApplicableDefinitionsProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [expandedTerms, setExpandedTerms] = useState<Set<number>>(new Set());

  const toggleTerm = (id: number) => {
    setExpandedTerms((prev) => {
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

  // Group by scope level for display
  const groupedByScope = definitions.reduce((acc, def) => {
    const level = def.scopeLevel || 'unknown';
    if (!acc[level]) acc[level] = [];
    acc[level].push(def);
    return acc;
  }, {} as Record<string, ApplicableDefinition[]>);

  // Order from broadest to narrowest scope
  const scopeOrder = ['title', 'subtitle', 'chapter', 'subchapter', 'article', 'part', 'subpart', 'section', 'unknown'];

  return (
    <Card>
      {/* Header - clickable to toggle */}
      <div
        className={`flex items-center justify-between cursor-pointer`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[var(--color-info)]" />
          <h2 className="font-semibold text-[var(--color-text)]">
            Applicable Definitions ({definitions.length})
          </h2>
        </div>
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
      </div>

      {/* Content - grouped by scope level */}
      {!isCollapsed && (
        <div className="mt-4 space-y-4">
          {scopeOrder
            .filter((level) => groupedByScope[level])
            .map((level) => (
              <div key={level}>
                <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  {level} Level ({groupedByScope[level].length})
                </h3>
                <div className="space-y-2">
                  {groupedByScope[level].map((definition) => {
                    const isExpanded = expandedTerms.has(definition.id);
                    const maxLength = 150;
                    const definitionText = getDisplayDefinitionText(definition);
                    const isLongDefinition = definitionText.length > maxLength;
                    const displayDefinition = isExpanded
                      ? definitionText
                      : definitionText.slice(0, maxLength) + (isLongDefinition ? '...' : '');

                    return (
                      <div
                        key={definition.id}
                        className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-3 rounded-[var(--radius-md)]"
                      >
                        {/* Term and badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-[var(--color-text)] text-sm">
                            {definition.term}
                          </span>
                          {definition.scopeDocTitle && (
                            <Badge variant="info">
                              {definition.scopeDocTitle}
                            </Badge>
                          )}
                          {definition.definitionType === 'abbreviation' && (
                            <Badge variant="default">
                              Abbrev
                            </Badge>
                          )}
                        </div>

                        {/* Definition text (truncated) */}
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {displayDefinition}
                        </p>

                        {/* Expand/collapse button */}
                        {isLongDefinition && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTerm(definition.id)}
                            className="mt-1 text-xs py-0.5 px-2 h-auto flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Show more
                              </>
                            )}
                          </Button>
                        )}

                        {/* Source link */}
                        {definition.regulation && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            <span className="font-medium">Defined in:</span>{' '}
                            <Link
                              href={`/${state}/regulations/${definition.regulation.id}`}
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              {definition.regulation.title}
                            </Link>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

export default ApplicableDefinitions;
