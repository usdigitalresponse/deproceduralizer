import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Alert } from '@/components/ui';
import { formatStateCitation } from '@/lib/formatters/citations';
import { getRegulationById } from '@/lib/actions/regulations';
import { getComplianceIssuesByDocumentId } from '@/lib/actions/compliance-issues';
import { getDefinitionsWithContext } from '@/lib/actions/definitions';
import { getNotesByDocumentId } from '@/lib/actions/document-notes';
import { getCrossReferencesForDocument, getIncomingReferences, getCrossReferencesForHighlighting, getGuidanceReferencingDocument } from '@/lib/actions/cross-references';
import { getStatuteLinksForRegulation, getEnablingAuthorityForRegulation } from '@/lib/actions/statutes';
import { getJenAIIssuesForDocument } from '@/lib/actions/jenai';
import { computeComplianceHighlights } from '@/lib/utils/complianceHighlights';
import { RegulationDetailClient } from './RegulationDetailClient';
import { RegulationDetailLayout } from './RegulationDetailLayout';
import { RegulationDetailSidebar } from './RegulationDetailSidebar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string; id: string }>;
  searchParams: Promise<{ from?: string; highlight?: string }>;
}

export default async function RegulationDetailPage({ params, searchParams }: PageProps) {
  const { state, id } = await params;
  const { from, highlight } = await searchParams;

  // Decode the back URL, default to browse page
  const backUrl = from ? decodeURIComponent(from) : `/${state}/browse`;
  const regulationId = parseInt(id, 10);

  if (isNaN(regulationId)) {
    notFound();
  }

  const [regulationResult, complianceIssuesResult, definitionsResult, notesResult, crossRefsResult, incomingRefsResult, highlightRefsResult, statuteLinksResult, enablingAuthorityResult, guidanceRefsResult, jenaiIssuesResult] = await Promise.all([
    getRegulationById(regulationId),
    getComplianceIssuesByDocumentId(regulationId),
    getDefinitionsWithContext(regulationId),
    getNotesByDocumentId(regulationId),
    getCrossReferencesForDocument(regulationId),
    getIncomingReferences(regulationId),
    getCrossReferencesForHighlighting(regulationId),
    getStatuteLinksForRegulation(regulationId),
    getEnablingAuthorityForRegulation(regulationId),
    getGuidanceReferencingDocument(regulationId),
    getJenAIIssuesForDocument(regulationId, 'regulation'),
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

  // Filter to only show confirmed compliance issues (requirementFound === true)
  // LLM-rejected issues (requirementFound === false) should not appear on detail pages
  const complianceIssues = complianceIssuesResult.data.filter(
    issue => issue.requirementFound !== false
  );

  // Compute inline highlights for compliance issues in the regulation text
  const complianceHighlights = regulation.content
    ? computeComplianceHighlights(regulation.content, complianceIssues)
    : [];

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
  // Statute links (excluding enabling authority, which is shown separately)
  const statuteLinks = statuteLinksResult.success ? statuteLinksResult.data : [];
  const enablingAuthority = enablingAuthorityResult.success ? enablingAuthorityResult.data : [];
  // Guidance references
  const guidanceRefs = guidanceRefsResult.success ? guidanceRefsResult.data : [];
  // JenAI issues
  const jenaiIssues = jenaiIssuesResult.success ? jenaiIssuesResult.data : [];
  // IDs of definitions defined here
  const definedHereIds = new Set(usedInText.definedHere.map(d => d.id));

  const citation = formatStateCitation(state, regulation);

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={regulation.title || 'Untitled Regulation'}
        description={citation || undefined}
      />

      <Container size="xl" className="py-6">
        <RegulationDetailLayout
          sidebar={
            <RegulationDetailSidebar
              regulation={regulation}
              regulationId={regulationId}
              state={state}
              backUrl={backUrl}
              complianceIssues={complianceIssues}
              crossRefs={crossRefs}
              incomingRefs={incomingRefs}
              statuteLinks={statuteLinks}
              enablingAuthority={enablingAuthority}
              guidanceRefs={guidanceRefs}
              usedDefinitions={usedDefinitions}
              availableButNotUsed={availableButNotUsed}
              definedHereIds={definedHereIds}
              jenaiIssues={jenaiIssues}
            />
          }
          content={
            <RegulationDetailClient
              content={regulation.content || ''}
              documentId={regulationId}
              state={state}
              initialNotes={notes}
              applicableDefinitions={usedDefinitions}
              crossRefHighlights={highlightRefs}
              initialHighlight={highlight}
              complianceHighlights={complianceHighlights}
            />
          }
        />
      </Container>
    </div>
  );
}
