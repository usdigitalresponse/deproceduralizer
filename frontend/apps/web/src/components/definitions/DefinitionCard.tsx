'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { DefinitionWithContext } from '@deproceduralizer/database';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';

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
 * Displays a single definition with optional expand/collapse for long text
 */
export function DefinitionCard({
  definition,
  showSource = true,
  state = 'ny',
  compact = false,
}: DefinitionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Truncate long definitions
  const maxLength = compact ? 150 : 300;
  const isLongDefinition = definition.definition.length > maxLength;
  const displayDefinition = isExpanded
    ? definition.definition
    : definition.definition.slice(0, maxLength) + (isLongDefinition ? '...' : '');

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
    ? formatNycrrCitation(
        definition.regulation.nycrrTitle,
        definition.regulation.nycrrPart,
        definition.regulation.nycrrSection
      )
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
          {!compact && definition.sourceLocation && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              <span className="font-medium">Source:</span> {definition.sourceLocation}
            </p>
          )}

          {/* Regulation link */}
          {showSource && regulationLink && (
            <div className="mt-3 pt-3 border-t border-[var(--color-neutral-100)] flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
              <div className="flex-1 min-w-0">
                {citation && (
                  <span className="text-xs font-mono text-[var(--color-text-muted)] mr-2">
                    {citation}
                  </span>
                )}
                <Link
                  href={regulationLink}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1"
                >
                  {definition.regulation?.title
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
