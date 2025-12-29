'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { RegulationWithAnalysis, ComplianceIssue, CrossReferenceWithTarget, CrossReferenceWithSource } from '@deproceduralizer/database';
import { getDocumentForPanel } from '@/lib/actions/hierarchy';
import { getComplianceIssuesByDocumentId } from '@/lib/actions/compliance-issues';
import { getCrossReferencesForDocument, getIncomingReferences } from '@/lib/actions/cross-references';
import { Card, Badge, SeverityBadge, Button, Tag } from '@/components/ui';
import { SectionTypeBadge } from '@/components/ui/SectionTypeBadge';
import { KeywordTags } from '@/components/ui/KeywordTags';
import { MetadataIndicators } from '@/components/ui/MetadataIndicators';
import { RegulationQuickStats, RegulationContent } from '@/components/regulations';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatDisplayTitle } from '@/lib/format';
import { HierarchyBreadcrumbs } from './HierarchyBreadcrumbs';
import { FileText, ExternalLink, AlertTriangle, X, Loader2, ClipboardList, Link2 } from 'lucide-react';
import { CrossReferenceCard, IncomingReferenceCard } from '@/components/cross-references';
import { getStateFromPathname } from '@/hooks';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

interface DetailPanelProps {
  documentId: number | null;
  onClose: () => void;
  onNavigate?: (id: number) => void;
  /** When true, panel fills entire viewport (for mobile drawer) */
  fullScreen?: boolean;
}

export function DetailPanel({ documentId, onClose, onNavigate, fullScreen = false }: DetailPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Height class based on fullScreen mode
  const heightClass = fullScreen ? 'h-full' : 'h-[calc(100vh-16rem)]';
  const state = getStateFromPathname(pathname, 'nj');

  // Build the full current URL for back navigation
  const currentUrl = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const [document, setDocument] = useState<RegulationWithAnalysis | null>(null);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossReferenceWithTarget[]>([]);
  const [incomingRefs, setIncomingRefs] = useState<CrossReferenceWithSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
    } else {
      setDocument(null);
      setComplianceIssues([]);
      setCrossRefs([]);
      setIncomingRefs([]);
    }
  }, [documentId]);

  async function loadDocument(id: number) {
    setIsLoading(true);
    setError(null);
    try {
      const [docResult, issuesResult, crossRefsResult, incomingRefsResult] = await Promise.all([
        getDocumentForPanel(id),
        getComplianceIssuesByDocumentId(id),
        getCrossReferencesForDocument(id),
        getIncomingReferences(id),
      ]);

      if (!docResult.success) {
        setError(`Failed to load document: ${docResult.error}`);
        return;
      }

      if (!issuesResult.success) {
        console.error('Failed to load compliance issues:', issuesResult.error);
        // Continue with document, just show no compliance issues
      }

      if (!crossRefsResult.success) {
        console.error('Failed to load cross-references:', crossRefsResult.error);
      }

      if (!incomingRefsResult.success) {
        console.error('Failed to load incoming references:', incomingRefsResult.error);
      }

      setDocument(docResult.data);
      setComplianceIssues(issuesResult.success ? issuesResult.data : []);
      setCrossRefs(crossRefsResult.success ? crossRefsResult.data : []);
      setIncomingRefs(incomingRefsResult.success ? incomingRefsResult.data : []);
    } catch (err) {
      console.error('Failed to load document:', err);
      setError('Failed to load document details');
    } finally {
      setIsLoading(false);
    }
  }

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

  const nycrrCitation = formatNycrrCitation(
    document.nycrrTitle,
    document.nycrrPart,
    document.nycrrSection
  );

  return (
    <Card padding="none" className={`${heightClass} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-neutral-200)] shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--color-text)] truncate" title={document.title}>
              {formatDisplayTitle(document)}
            </h2>
            {nycrrCitation && (
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{nycrrCitation}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/${state}/regulations/${document.id}?from=${encodeURIComponent(currentUrl)}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                Full Page
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <RegulationQuickStats regulation={document} className="mt-3" />
      </div>

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
        {/* Summary */}
        {document.summary && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              Summary
            </h3>
            <p className="text-sm text-[var(--color-text)]">{document.summary}</p>
          </div>
        )}

        {/* AI-generated Metadata */}
        {(document.sectionType || document.keywords?.length || document.appliesTo?.length || document.hasForm || document.hasIbr) && (
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {document.sectionType && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">Type:</span>
                  <SectionTypeBadge type={document.sectionType} />
                </div>
              )}
              <MetadataIndicators hasForm={document.hasForm} hasIbr={document.hasIbr} size="md" />
            </div>

            {document.appliesTo && document.appliesTo.length > 0 && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">Applies to:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {document.appliesTo.map((entity) => (
                    <span
                      key={entity}
                      className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-xs"
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {document.keywords && document.keywords.length > 0 && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">Keywords:</span>
                <div className="mt-1">
                  <KeywordTags keywords={document.keywords} maxDisplay={10} />
                </div>
              </div>
            )}
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
                  href={`/${state}/regulations/${document.id}?from=${encodeURIComponent(currentUrl)}`}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                >
                  View all {document.redFlags.length} flags...
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Compliance Issues */}
        {complianceIssues.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[var(--color-warning)]" />
              Compliance Issues ({complianceIssues.length})
            </h3>
            <div className="space-y-3">
              {complianceIssues.slice(0, 3).map((issue) => (
                <div
                  key={issue.id}
                  className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="warning" className="text-xs">
                      {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                    </Badge>
                    {issue.requirementFound && (
                      <Badge variant="success" className="text-xs">LLM Confirmed</Badge>
                    )}
                  </div>
                  {issue.matchedPattern && (
                    <div className="mb-1">
                      <Tag variant="warning" size="sm">{issue.matchedPattern}</Tag>
                    </div>
                  )}
                  <p className="text-sm text-[var(--color-text)] line-clamp-2">{issue.matchedContext}</p>
                </div>
              ))}
              {complianceIssues.length > 3 && (
                <Link
                  href={`/${state}/regulations/${document.id}?from=${encodeURIComponent(currentUrl)}`}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                >
                  View all {complianceIssues.length} compliance issues...
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Cross-References (outgoing) */}
        {crossRefs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[var(--color-primary)]" />
              Cross-References ({crossRefs.length})
            </h3>
            <div className="space-y-2">
              {crossRefs.slice(0, 3).map((ref) => (
                <CrossReferenceCard
                  key={ref.id}
                  crossRef={ref}
                  state={state}
                  compact
                />
              ))}
              {crossRefs.length > 3 && (
                <Link
                  href={`/${state}/regulations/${document.id}?from=${encodeURIComponent(currentUrl)}`}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                >
                  View all {crossRefs.length} cross-references...
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Incoming References (who cites this) */}
        {incomingRefs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[var(--color-success)]" />
              Cited By ({incomingRefs.length})
            </h3>
            <div className="space-y-2">
              {incomingRefs.slice(0, 3).map((ref) => (
                <IncomingReferenceCard
                  key={ref.id}
                  crossRef={ref}
                  state={state}
                  compact
                />
              ))}
              {incomingRefs.length > 3 && (
                <Link
                  href={`/${state}/regulations/${document.id}?from=${encodeURIComponent(currentUrl)}`}
                  className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
                >
                  View all {incomingRefs.length} citing documents...
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

export default DetailPanel;
