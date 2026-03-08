'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { FileText, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui';
import { RegulationContent } from '@/components/regulations';
import { HierarchyBreadcrumbs } from '../HierarchyBreadcrumbs';
import { getJurisdictionFromPathname } from '@/hooks';
import { useDetailPanelData } from './hooks/useDetailPanelData';
import { Header } from './Header';
import { SummarySection } from './SummarySection';
import { MetadataSection } from './MetadataSection';
import { ComplianceIssuesSection } from './ComplianceIssuesSection';
import { CrossReferencesSection } from './CrossReferencesSection';
import { IncomingReferencesSection } from './IncomingReferencesSection';
import { StatuteLinksSection } from './StatuteLinksSection';
import type { DetailPanelProps } from './types';

export function DetailPanel({ documentId, onClose, onNavigate, fullScreen = false }: DetailPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const heightClass = fullScreen ? 'h-full' : 'h-[calc(100vh-16rem)]';
  const jurisdiction = getJurisdictionFromPathname(pathname, 'ny');

  const currentUrl = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const { document, complianceIssues, crossRefs, incomingRefs, statuteLinks, isLoading, error } = useDetailPanelData(documentId);

  // Empty state
  if (!documentId) {
    return (
      <Card className={`${heightClass} flex items-center justify-center`}>
        <div className="text-center text-[var(--color-text-muted)]">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Select a regulation</p>
          <p className="text-xs mt-1">Click on an item in the tree to view details</p>
        </div>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={`${heightClass} flex items-center justify-center`}>
        <div className="text-center text-[var(--color-text-muted)]">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm">Loading document...</p>
        </div>
      </Card>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <Card className={`${heightClass} flex items-center justify-center`}>
        <div className="text-center text-[var(--color-danger)]">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">{error || 'Document not found'}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className={`${heightClass} flex flex-col overflow-hidden`}>
      <Header
        document={document}
        state={jurisdiction}
        currentUrl={currentUrl}
        onClose={onClose}
      />

      {/* Hierarchy Breadcrumbs */}
      <div className="px-4 py-2 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
        <HierarchyBreadcrumbs
          documentId={document.id}
          currentTitle={document.title}
          currentLevel={document.hierarchyLevel}
          onNavigate={onNavigate}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SummarySection summary={document.summary} />

        <MetadataSection document={document} />

        <ComplianceIssuesSection
          issues={complianceIssues}
          state={jurisdiction}
          documentId={document.id}
          currentUrl={currentUrl}
        />

        <CrossReferencesSection
          refs={crossRefs}
          state={jurisdiction}
          documentId={document.id}
          currentUrl={currentUrl}
        />

        <IncomingReferencesSection
          refs={incomingRefs}
          state={jurisdiction}
          documentId={document.id}
          currentUrl={currentUrl}
        />

        <StatuteLinksSection
          links={statuteLinks}
          state={jurisdiction}
          documentId={document.id}
          currentUrl={currentUrl}
        />

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
          <RegulationContent
            content={document.content}
            heading="Content Preview"
            truncateAt={500}
            maxHeight="10rem"
          />
        )}
      </div>
    </Card>
  );
}
