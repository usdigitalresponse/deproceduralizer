'use client';

import { useState, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { CrossRefPopover } from '@/components/cross-references/CrossRefPopover';
import { useCrossRefHighlighting, type CrossRefMatch } from '@/hooks/useCrossRefHighlighting';
import type { HighlightRef } from '@deproceduralizer/database';
import type { GuidanceDocumentDetail } from '@/lib/actions/guidance-documents';

interface GuidanceDetailContentProps {
  doc: GuidanceDocumentDetail;
  state?: string;
  crossRefHighlights?: HighlightRef[];
}

export function GuidanceDetailContent({ doc, state, crossRefHighlights }: GuidanceDetailContentProps) {
  const crossRefMatches = useCrossRefHighlighting(crossRefHighlights);
  const [selectedCrossRef, setSelectedCrossRef] = useState<{
    crossRef: CrossRefMatch;
    rect: DOMRect;
  } | null>(null);

  const handleCrossRefClick = useCallback((crossRef: CrossRefMatch, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedCrossRef({ crossRef, rect });
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedCrossRef(null);
  }, []);

  function renderHighlightedContent(content: string, matches: CrossRefMatch[]) {
    if (matches.length === 0) return content;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.startOffset > content.length || match.endOffset > content.length) continue;
      if (match.startOffset < lastIndex) continue;

      if (match.startOffset > lastIndex) {
        parts.push(content.slice(lastIndex, match.startOffset));
      }

      parts.push(
        <span
          key={match.id}
          className="crossref-highlight"
          role="button"
          tabIndex={0}
          aria-label={`Cross-reference: ${match.rawText}`}
          onClick={(e) => handleCrossRefClick(match, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCrossRefClick(match, e as unknown as React.MouseEvent);
            }
          }}
        >
          {content.slice(match.startOffset, match.endOffset)}
        </span>
      );

      lastIndex = match.endOffset;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>Document Content</CardTitle>
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
            >
              View Original
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </CardHeader>
      <div className="pt-4">
        {doc.content ? (
          <div className="prose prose-sm max-w-none text-[var(--color-text)] whitespace-pre-wrap break-words leading-relaxed">
            {renderHighlightedContent(doc.content, crossRefMatches)}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            No content available for this document.
            {doc.url && ' Use the "View Original" link above to access the source document.'}
          </p>
        )}
      </div>

      {selectedCrossRef && state && (
        <CrossRefPopover
          crossRef={selectedCrossRef.crossRef}
          anchorRect={selectedCrossRef.rect}
          onClose={handleClosePopover}
          state={state}
        />
      )}
    </Card>
  );
}
