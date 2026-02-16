'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { ApplicableDefinition } from '@deproceduralizer/database';
import { DEFAULT_STATE } from '@/types/state';
import { formatStateCitation } from '@/lib/formatters';

/**
 * Get the display definition text based on verbatim/rephrased logic
 */
function getDisplayDefinitionText(definition: ApplicableDefinition): string {
  if (definition.isVerbatimTextComplete) {
    return definition.verbatimText;
  }
  return definition.rephrasedDefinition ?? definition.verbatimText;
}

interface DefinitionsListProps {
  definitions: ApplicableDefinition[];
  /** Set of definition IDs that are defined in the current document (vs inherited) */
  definedHereIds?: Set<number>;
  /** Current document ID for detecting "This document" source */
  currentDocumentId?: number;
  /** State for context (used in display and links) */
  state?: string;
  /** Whether the section is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
  /** Custom title for the section */
  title?: string;
  /** Description text below the title */
  description?: string;
}

/**
 * Displays a list of definitions for a regulation detail page
 * Follows the same pattern as ComplianceIssuesList
 */
/**
 * Format a citation for display based on state
 */
function formatCitation(definition: ApplicableDefinition, state: string): string | null {
  if (!definition.regulation) return null;
  return formatStateCitation(state, definition.regulation);
}

export function DefinitionsList({
  definitions,
  definedHereIds,
  currentDocumentId,
  state = DEFAULT_STATE,
  collapsible = true,
  initialCollapsed = false,
  title = 'Definitions',
  description,
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
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">
              {title} ({definitions.length})
            </h2>
            {description && (
              <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
            )}
          </div>
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
            const definitionText = getDisplayDefinitionText(definition);
            const isLongDefinition = definitionText.length > maxLength;
            const displayDefinition = isExpanded
              ? definitionText
              : definitionText.slice(0, maxLength) + (isLongDefinition ? '...' : '');

            return (
              <div
                key={definition.id}
                id={`definition-${definition.id}`}
                className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)]"
              >
                {/* Term, origin badge, and scope */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-[var(--color-text)]">
                    {definition.term}
                  </span>
                  {definedHereIds && (
                    definedHereIds.has(definition.id) ? (
                      <Badge variant="success" className="text-xs">Defined here</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">Inherited</Badge>
                    )
                  )}
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

                {/* Source and Scope information */}
                <div className="mt-2 space-y-1">
                  {/* Source document */}
                  <p className="text-xs text-[var(--color-text-muted)]">
                    <span className="font-medium">Source:</span>{' '}
                    {currentDocumentId && definition.documentId === currentDocumentId ? (
                      <span>This document</span>
                    ) : definition.regulation ? (
                      <Link
                        href={`/${state}/regulations/${definition.regulation.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {formatCitation(definition, state) || definition.regulation.title || 'Source regulation'}
                      </Link>
                    ) : definition.sourceLocation ? (
                      <span>{definition.sourceLocation}</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">Unknown</span>
                    )}
                  </p>

                  {/* Scope - where the definition applies */}
                  {(definition.scope || definition.scopeDocumentId) && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      <span className="font-medium">Applies:</span>{' '}
                      {definition.scope && <span>{definition.scope}</span>}
                      {definition.scopeDocumentId && definition.scopeDocTitle && (
                        <>
                          {definition.scope && ' ('}
                          <Link
                            href={`/${state}/regulations/${definition.scopeDocumentId}`}
                            className="text-[var(--color-primary)] hover:underline"
                          >
                            {definition.scopeDocTitle}
                          </Link>
                          {definition.scope && ')'}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default DefinitionsList;
