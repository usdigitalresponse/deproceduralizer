import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui';
import { RedFlagsList } from '@/components/flags';
import { ComplianceIssuesList } from '@/components/issues';
import { DefinitionsList, ApplicableDefinitions } from '@/components/definitions';
import { CrossReferenceList, IncomingReferenceList } from '@/components/cross-references';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { formatDisplayTitle } from '@/lib/format';
import {
  RegulationHierarchyDetails,
  RegulationMetadata,
  RegulationSummary,
  ExclusionToggle,
} from '@/components/regulations';
import { HierarchyBreadcrumbsServer } from '@/components/regulations/HierarchyBreadcrumbsServer';
import { ChildrenListServer } from '@/components/regulations/ChildrenListServer';
import { getRegulationById } from '@/lib/actions/regulations';
import { getComplianceIssuesByDocumentId } from '@/lib/actions/compliance-issues';
import { getDefinitionsWithContext } from '@/lib/actions/definitions';
import { getNotesByDocumentId } from '@/lib/actions/document-notes';
import { getCrossReferencesForDocument, getIncomingReferences, getCrossReferencesForHighlighting } from '@/lib/actions/cross-references';
import { RegulationDetailClient } from './RegulationDetailClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function RegulationDetailPage({ params, searchParams }: PageProps) {
  const { state, id } = await params;
  const { from } = await searchParams;

  // Decode the back URL, default to browse page
  const backUrl = from ? decodeURIComponent(from) : `/${state}/browse`;
  const regulationId = parseInt(id, 10);

  if (isNaN(regulationId)) {
    notFound();
  }

  const [regulationResult, complianceIssuesResult, definitionsResult, notesResult, crossRefsResult, incomingRefsResult, highlightRefsResult] = await Promise.all([
    getRegulationById(regulationId),
    getComplianceIssuesByDocumentId(regulationId),
    getDefinitionsWithContext(regulationId),
    getNotesByDocumentId(regulationId),
    getCrossReferencesForDocument(regulationId),
    getIncomingReferences(regulationId),
    getCrossReferencesForHighlighting(regulationId),
  ]);

  // Handle errors - display them obviously
  if (!regulationResult.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title="Error Loading Regulation"
          description={undefined}
        />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load regulation: {regulationResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const regulation = regulationResult.data;
  if (!regulation) {
    notFound();
  }

  if (!complianceIssuesResult.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={regulation.title || 'Untitled Regulation'}
          description={undefined}
        />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load compliance issues: {complianceIssuesResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!definitionsResult.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={regulation.title || 'Untitled Regulation'}
          description={undefined}
        />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load definitions: {definitionsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!notesResult.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={regulation.title || 'Untitled Regulation'}
          description={undefined}
        />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load document notes: {notesResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const complianceIssues = complianceIssuesResult.data;
  // Safely destructure definitions data with fallbacks
  const definitionsData = definitionsResult.data ?? { usedInText: { definedHere: [], inherited: [] }, availableButNotUsed: [] };
  const usedInText = definitionsData.usedInText ?? { definedHere: [], inherited: [] };
  const availableButNotUsed = definitionsData.availableButNotUsed ?? [];
  // Combine all definitions that appear in text (both defined here and inherited)
  const usedDefinitions = [...(usedInText.definedHere ?? []), ...(usedInText.inherited ?? [])];
  const notes = notesResult.data;
  // Cross-references (outgoing and incoming)
  const crossRefs = crossRefsResult.success ? crossRefsResult.data : [];
  const incomingRefs = incomingRefsResult.success ? incomingRefsResult.data : [];
  // Cross-refs for inline highlighting
  const highlightRefs = highlightRefsResult.success ? highlightRefsResult.data : [];

  const nycrrCitation = formatNycrrCitation(
    regulation.nycrrTitle,
    regulation.nycrrPart,
    regulation.nycrrSection
  );

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={regulation.title || 'Untitled Regulation'}
        description={nycrrCitation || undefined}
      />

      <Container size="xl" className="py-6">
        {/* Back Button */}
        <div className="mb-6">
          <Link href={backUrl}>
            <Button variant="ghost" size="sm">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Browse
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* Hierarchy Breadcrumbs */}
          <Card>
            <h2 className="font-semibold text-[var(--color-primary)] mb-3">Hierarchy</h2>
            <HierarchyBreadcrumbsServer
              documentId={regulationId}
              currentTitle={formatDisplayTitle(regulation) || 'Untitled'}
              state={state}
            />

            {/* Additional hierarchy details */}
            <RegulationHierarchyDetails
              regulation={regulation}
              className="mt-4 pt-4 border-t border-[var(--color-neutral-200)]"
            />
          </Card>

          {/* Metadata Grid */}
          <Card>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Metadata</h2>
            <RegulationMetadata regulation={regulation} layout="grid" />
          </Card>

          {/* Exclusion Toggle */}
          <Card>
            <ExclusionToggle
              documentId={regulationId}
              isExcluded={regulation.excludeFromAnalysis ?? false}
              excludedBy={regulation.excludedBy}
              excludedAt={regulation.excludedAt}
              excludedReason={regulation.excludedReason}
            />
          </Card>

          {/* Summary */}
          <Card>
            <RegulationSummary summary={regulation.summary} showHeading />
          </Card>

          {/* Children (sub-sections, parts, etc.) - only renders if document has children */}
          <ChildrenListServer documentId={regulationId} state={state} />

          {/* Red Flags Details */}
          {regulation.redFlags && regulation.redFlags.length > 0 && (
            <RedFlagsList initialFlags={regulation.redFlags} />
          )}

          {/* Compliance Issues */}
          {complianceIssues && complianceIssues.length > 0 && (
            <ComplianceIssuesList
              initialIssues={complianceIssues}
              regulationContent={regulation.content}
            />
          )}

          {/* Cross-References - outgoing references to other regulations */}
          {crossRefs.length > 0 && (
            <Card>
              <CrossReferenceList
                crossRefs={crossRefs}
                state={state as 'nj' | 'ny'}
                title="Cross-References"
              />
            </Card>
          )}

          {/* Incoming References - other documents that cite this one */}
          {incomingRefs.length > 0 && (
            <Card>
              <IncomingReferenceList
                crossRefs={incomingRefs}
                state={state as 'nj' | 'ny'}
                title="Cited By"
              />
            </Card>
          )}

          {/* Definitions Used - terms that appear in this document's text */}
          {usedDefinitions.length > 0 && (
            <DefinitionsList
              definitions={usedDefinitions}
              definedHereIds={new Set(usedInText.definedHere.map(d => d.id))}
              currentDocumentId={regulationId}
              state={state}
              title="Definitions Used"
              description="Terms that appear in this document"
            />
          )}

          {/* Available Definitions - in scope but not used */}
          {availableButNotUsed.length > 0 && (
            <ApplicableDefinitions
              definitions={availableButNotUsed}
              state={state}
              title="Other Available Definitions"
              description="Terms in scope but not used in this document"
              collapsed={true}
            />
          )}

          {/* Regulation Text with Notes */}
          <RegulationDetailClient
            content={regulation.content || ''}
            documentId={regulationId}
            state={state}
            initialNotes={notes}
            applicableDefinitions={usedDefinitions}
            crossRefHighlights={highlightRefs}
          />
        </div>
      </Container>
    </div>
  );
}
