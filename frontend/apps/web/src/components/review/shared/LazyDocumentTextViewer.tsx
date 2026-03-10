'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getRegulationContent, getGuidanceContent } from '@/lib/actions/document-content';
import { RegulationTextViewer } from './RegulationTextViewer';

interface LazyDocumentTextViewerProps {
  documentId?: number;
  guidanceDocumentId?: number;
  state: string;
  scrollToText?: string | null;
  highlightPattern?: string | null;
  isVerbatim?: boolean;
  label?: string;
}

export function LazyDocumentTextViewer({
  documentId,
  guidanceDocumentId,
  state,
  scrollToText,
  highlightPattern,
  isVerbatim = false,
  label = 'Show Section Text',
}: LazyDocumentTextViewerProps) {
  const [content, setContent] = useState<string | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    try {
      if (documentId) {
        const result = await getRegulationContent(documentId);
        setContent(result.success ? result.data : null);
      } else if (guidanceDocumentId) {
        const result = await getGuidanceContent(guidanceDocumentId);
        setContent(result.success ? result.data : null);
      } else {
        setContent(null);
      }
    } catch {
      setContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, guidanceDocumentId]);

  const handleToggle = useCallback(() => {
    if (!isExpanded && content === undefined) {
      fetchContent();
    }
    setIsExpanded((prev) => !prev);
  }, [isExpanded, content, fetchContent]);

  const resolvedDocId = documentId ?? guidanceDocumentId ?? 0;

  // Content loaded and available — render full viewer
  if (content && isExpanded) {
    return (
      <RegulationTextViewer
        content={content}
        documentId={resolvedDocId}
        state={state}
        scrollToText={scrollToText}
        highlightPattern={highlightPattern}
        isVerbatim={isVerbatim}
        label={label}
        defaultExpanded
      />
    );
  }

  return (
    <div className="mb-4 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {label}
        {isLoading && (
          <Loader2 className="w-3 h-3 ml-1 animate-spin text-[var(--color-text-muted)]" />
        )}
      </button>

      {isExpanded && !isLoading && content === null && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">No content available.</p>
      )}
    </div>
  );
}
