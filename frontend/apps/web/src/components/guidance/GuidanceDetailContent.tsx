'use client';

import { ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { GuidanceDocumentDetail } from '@/lib/actions/guidance-documents';

interface GuidanceDetailContentProps {
  doc: GuidanceDocumentDetail;
}

export function GuidanceDetailContent({ doc }: GuidanceDetailContentProps) {
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
            {doc.content}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            No content available for this document.
            {doc.url && ' Use the "View Original" link above to access the source document.'}
          </p>
        )}
      </div>
    </Card>
  );
}
