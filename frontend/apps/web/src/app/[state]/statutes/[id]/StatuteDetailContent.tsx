'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { SearchableContent } from '@/components/ui/SearchableContent';
import { normalizeLineBreaks } from '@/components/regulations';

interface StatuteDetailContentProps {
  content: string;
  /** Initial search highlight from URL (e.g., from FTS search results) */
  initialHighlight?: string;
}

export function StatuteDetailContent({
  content,
  initialHighlight,
}: StatuteDetailContentProps) {
  const normalizedContent = useMemo(() => normalizeLineBreaks(content || 'No content available'), [content]);

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-[var(--color-text)] mb-3">Statute Text</h3>
      <SearchableContent
        content={normalizedContent}
        initialValue={initialHighlight}
        maxHeight="none"
        placeholder="Search in statute text..."
      />
    </Card>
  );
}

export default StatuteDetailContent;
