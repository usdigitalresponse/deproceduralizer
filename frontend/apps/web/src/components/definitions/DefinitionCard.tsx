'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, BookOpen, Quote } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { DefinitionWithContext } from '@deproceduralizer/database';
import { formatStateCitation } from '@/lib/formatters/citations';
import { DEFAULT_JURISDICTION } from '@/types/state';

interface DefinitionCardProps {
  definition: DefinitionWithContext;
  /** Whether to show the source regulation link */
  showSource?: boolean;
  /** State for constructing regulation links */
  state?: string;
  /** Whether the card is in a compact list view */
  compact?: boolean;
}

/**
 * Displays a single definition with optional expand/collapse for long text.
 * When isVerbatim=false, shows both the rephrased definition and the original verbatim text.
 */

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Get the primary display definition text based on verbatim/rephrased logic.
 * Always capitalizes the first letter.
 */
function getDisplayDefinitionText(definition: DefinitionWithContext): string {
  const text = definition.isVerbatimTextComplete
    ? definition.verbatimText
    : (definition.rephrasedDefinition ?? definition.verbatimText);
  return capitalizeFirst(text);
}

export function DefinitionCard({
  definition,
  showSource = true,
  state = DEFAULT_JURISDICTION,
  compact = false,
}: DefinitionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVerbatim, setShowVerbatim] = useState(false);

  // Get the appropriate definition text to display
  const definitionText = getDisplayDefinitionText(definition);

  // Check if we have a rephrased definition that differs from verbatim
  const hasRephrasedDefinition = !definition.isVerbatimTextComplete &&
    definition.rephrasedDefinition &&
    definition.rephrasedDefinition !== definition.verbatimText;

  // Truncate long definitions
  const maxLength = compact ? 150 : 300;
  const isLongDefinition = definitionText.length > maxLength;
  const displayDefinition = isExpanded
    ? definitionText
    : definitionText.slice(0, maxLength) + (isLongDefinition ? '...' : '');

  // Format overlap as quality indicator
  const getQualityBadge = () => {
    const overlap = definition.definitionOverlap ?? 0;
    if (overlap >= 0.9) {
      return <Badge variant="success">High Quality</Badge>;
    } else if (overlap >= 0.5) {
      return <Badge variant="warning">Medium Quality</Badge>;
    } else if (overlap > 0) {
      return <Badge variant="default">Low Quality</Badge>;
    }
    return null;
  };

  // Get regulation link
  const regulationLink = definition.regulation
    ? `/${state}/regulations/${definition.regulation.id}`
    : null;

  // Format citation
  const citation = definition.regulation
    ? formatStateCitation(state, definition.regulation)
    : null;

  return (
    <Card padding={compact ? 'sm' : 'md'} className="hover:border-[var(--color-primary-weak)] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Term heading */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {definition.term}
            </h3>
            {definition.scope && (
              <Badge variant="info">{definition.scope}</Badge>
            )}
            {!compact && getQualityBadge()}
            {hasRephrasedDefinition && (
              <Badge variant="default">Rephrased</Badge>
            )}
          </div>

          {/* Definition text */}
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {displayDefinition}
          </p>

          {/* Expand/collapse button for long definitions */}
          {isLongDefinition && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse definition' : 'Expand definition'}
              aria-expanded={isExpanded}
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

          {/* Show original verbatim text when definition is rephrased */}
          {hasRephrasedDefinition && (
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowVerbatim(!showVerbatim)}
                className="text-xs py-0.5 px-2 h-auto flex items-center gap-1"
              >
                <Quote className="w-3 h-3" />
                {showVerbatim ? 'Hide original text' : 'Show original text'}
                {showVerbatim ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
              {showVerbatim && (
                <div className="mt-2 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-2 border-[var(--color-neutral-300)]">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1 font-medium">
                    Original text from regulation:
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] italic whitespace-pre-wrap">
                    {capitalizeFirst(definition.verbatimText)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Source location */}
          {!compact && definition.sourceLocation && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              <span className="font-medium">Source:</span> {definition.sourceLocation}
            </p>
          )}

          {/* Regulation link - always show when available (including compact mode) */}
          {showSource && regulationLink && (
            <div className={`flex items-center gap-2 ${compact ? 'mt-2' : 'mt-3 pt-3 border-t border-[var(--color-neutral-100)]'}`}>
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                {citation && (
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    {citation}
                  </span>
                )}
                <Link
                  href={regulationLink}
                  className={`text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'}`}
                >
                  {compact
                    ? 'View section'
                    : definition.regulation?.title
                      ? definition.regulation.title.slice(0, 60) + (definition.regulation.title.length > 60 ? '...' : '')
                      : 'View Regulation'}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default DefinitionCard;
