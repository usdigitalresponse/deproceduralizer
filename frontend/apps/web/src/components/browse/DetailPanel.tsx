'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RegulationWithAnalysis } from '@deproceduralizer/database';
import { getDocumentForPanel } from '@/lib/actions/hierarchy';
import { Card } from '@/components/ui/Card';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { HierarchyBreadcrumbs } from './HierarchyBreadcrumbs';
import { FileText, ExternalLink, AlertTriangle, BookOpen, X, Loader2 } from 'lucide-react';

interface DetailPanelProps {
  documentId: number | null;
  onClose: () => void;
  onNavigate?: (id: number) => void;
}

export function DetailPanel({ documentId, onClose, onNavigate }: DetailPanelProps) {
  const pathname = usePathname();
  const state = pathname.match(/^\/(ny|nj)/)?.[1] || 'ny';

  const [document, setDocument] = useState<RegulationWithAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
    } else {
      setDocument(null);
    }
  }, [documentId]);

  async function loadDocument(id: number) {
    setIsLoading(true);
    setError(null);
    try {
      const doc = await getDocumentForPanel(id);
      setDocument(doc);
    } catch (err) {
      console.error('Failed to load document:', err);
      setError('Failed to load document details');
    } finally {
      setIsLoading(false);
    }
  }

  if (!documentId) {
    return (
      <Card className="h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center text-[var(--color-text-muted)]">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Select a regulation</p>
          <p className="text-xs mt-1">Click on an item in the tree to view details</p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center text-[var(--color-text-muted)]">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading document...</p>
        </div>
      </Card>
    );
  }

  if (error || !document) {
    return (
      <Card className="h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="text-center text-[var(--color-danger)]">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">{error || 'Document not found'}</p>
        </div>
      </Card>
    );
  }

  const nycrrCitation = formatNycrrCitation(
    document.nycrrTitle,
    document.nycrrPart,
    document.nycrrSection
  );

  return (
    <Card padding="none" className="h-[calc(100vh-16rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-neutral-200)] shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--color-text)] truncate">
              {document.title}
            </h2>
            {nycrrCitation && (
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{nycrrCitation}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/${state}/regulations/${document.id}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Full Page
              </Button>
            </Link>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--color-neutral-100)] rounded"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-2 mt-3">
          {document.hierarchyLevel && (
            <Badge variant="default" className="capitalize">
              {document.hierarchyLevel}
            </Badge>
          )}
          {document.maxSeverity !== null && (
            <SeverityBadge severity={document.maxSeverity} />
          )}
          {document.numFlags !== null && document.numFlags > 0 && (
            <Badge variant="danger">
              {document.numFlags} {document.numFlags === 1 ? 'flag' : 'flags'}
            </Badge>
          )}
          {document.overallComplexity && (
            <Badge variant={
              document.overallComplexity === 'HIGH' ? 'danger' :
              document.overallComplexity === 'MEDIUM-HIGH' ? 'warning' :
              document.overallComplexity === 'MEDIUM' ? 'warning' :
              'success'
            }>
              {document.overallComplexity} complexity
            </Badge>
          )}
        </div>
      </div>

      {/* Hierarchy Breadcrumbs */}
      <div className="px-4 py-2 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
        <HierarchyBreadcrumbs
          documentId={document.id}
          currentTitle={document.title}
          onNavigate={onNavigate}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary */}
        {document.summary && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              Summary
            </h3>
            <p className="text-sm text-[var(--color-text)]">{document.summary}</p>
          </div>
        )}

        {/* Red Flags */}
        {document.redFlags && document.redFlags.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
              Red Flags ({document.redFlags.length})
            </h3>
            <div className="space-y-3">
              {document.redFlags.slice(0, 5).map((flag) => (
                <div
                  key={flag.id}
                  className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" className="text-xs">{flag.category}</Badge>
                    <SeverityBadge severity={flag.severity} className="text-xs" />
                  </div>
                  <p className="text-sm text-[var(--color-text)]">{flag.explanation}</p>
                </div>
              ))}
              {document.redFlags.length > 5 && (
                <Link
                  href={`/${state}/regulations/${document.id}`}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                >
                  View all {document.redFlags.length} flags...
                </Link>
              )}
            </div>
          </div>
        )}

        {/* URL Link */}
        {document.url && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              Source
            </h3>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] flex items-center gap-1"
            >
              View on Cornell Law
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Content preview */}
        {document.content && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              Content Preview
            </h3>
            <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-neutral-50)] p-3 rounded-[var(--radius-md)] max-h-40 overflow-y-auto">
              {document.content.substring(0, 500)}
              {document.content.length > 500 && '...'}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default DetailPanel;
