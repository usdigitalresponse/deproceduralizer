'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Layers, BookOpen, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedCollapse } from '@/components/ui/AnimatedCollapse';
import { DefinitionCard } from './DefinitionCard';
import { getDefinitionsForTermAction } from '@/lib/actions/definitions';
import type { AggregatedTerm, DefinitionWithContext, JurisdictionCode } from '@deproceduralizer/database';

interface AggregatedTermCardProps {
  term: AggregatedTerm;
  jurisdiction: JurisdictionCode;
}

/**
 * Card component that displays an aggregated term with its variant count.
 * Expands to show all definitions for that term when clicked.
 */
export function AggregatedTermCard({ term, jurisdiction }: AggregatedTermCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [definitions, setDefinitions] = useState<DefinitionWithContext[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!isExpanded && !definitions) {
      // Fetch definitions on first expand
      startTransition(async () => {
        const result = await getDefinitionsForTermAction(term.normalizedTerm, jurisdiction);
        if (result.success) {
          setDefinitions(result.data);
        }
        setIsExpanded(true);
      });
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  // Capitalize the first letter of a string
  const capitalizeFirst = (text: string): string => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Truncate preview definition and capitalize first letter
  const previewText = term.previewDefinition
    ? capitalizeFirst(term.previewDefinition.slice(0, 200)) + (term.previewDefinition.length > 200 ? '...' : '')
    : 'No high-quality definition available';

  // Filter out null scope levels and format
  const validScopeLevels = term.scopeLevels.filter((s): s is string => s !== null && s !== '');

  return (
    <Card className="hover:border-[var(--color-primary-weak)] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Term heading with variant count */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {term.displayTerm}
            </h3>
            {term.variantCount > 1 && (
              <Badge variant="info">{term.variantCount} variants</Badge>
            )}
          </div>

          {/* Preview definition */}
          <p className="text-sm text-[var(--color-text-secondary)]">
            {previewText}
          </p>

          {/* Scope levels */}
          {validScopeLevels.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Layers className="w-3 h-3 text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)]">
                Scopes: {validScopeLevels.join(', ')}
              </span>
            </div>
          )}

          {/* Source citation - show for single variant terms or as preview source */}
          {term.previewCitation && term.previewDocumentId && (
            <div className="flex items-center gap-2 mt-2">
              <BookOpen className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0" />
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                {term.previewCitation}
              </span>
              <Link
                href={`/${jurisdiction}/regulations/${term.previewDocumentId}`}
                className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline inline-flex items-center gap-1"
              >
                View section
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Expand/collapse button */}
          {term.variantCount > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              disabled={isPending}
              className="mt-3 text-xs py-0.5 px-2 h-auto flex items-center gap-1"
            >
              {isPending ? (
                'Loading...'
              ) : isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide definitions
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show all {term.variantCount} definitions
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded definitions list */}
      <AnimatedCollapse isOpen={isExpanded && definitions !== null}>
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)] space-y-3">
          {definitions?.map((def) => (
            <DefinitionCard
              key={def.id}
              definition={def}
              state={jurisdiction}
              compact={true}
            />
          ))}
        </div>
      </AnimatedCollapse>
    </Card>
  );
}

export default AggregatedTermCard;
