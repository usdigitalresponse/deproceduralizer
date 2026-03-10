import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getGuidanceById, getDocumentLineage, getGuidanceResolvedCitations, getGuidanceComplianceAnalysisSummary } from '@/lib/actions/guidance-documents';
import { getGuidanceCrossRefsForHighlighting } from '@/lib/actions/cross-references';
import { getJenAIIssuesForDocument } from '@/lib/actions/jenai';
import { GuidanceDetailSidebar } from '@/components/guidance/GuidanceDetailSidebar';
import { GuidanceDetailContent } from '@/components/guidance/GuidanceDetailContent';
import { GuidanceComplianceCard } from '@/components/guidance/GuidanceComplianceCard';
import { JenAIIssuesList } from '@/components/jenai';
import { DocumentLineageViewer } from '@/components/guidance/DocumentLineageViewer';
import { GuidanceStatusBadge } from '@/components/guidance/GuidanceStatusBadge';
import { GuidanceBookmarkButton } from '@/components/guidance/GuidanceBookmarkButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { isValidJurisdiction } from '@/types/state';

interface GuidanceDetailPageProps {
  params: Promise<{ state: string; id: string }>;
}

export default async function GuidanceDetailPage({ params }: GuidanceDetailPageProps) {
  const { state, id } = await params;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const docId = parseInt(id, 10);
  if (isNaN(docId)) {
    notFound();
  }

  const [result, lineageResult, resolvedCitationsResult, complianceSummaryResult, crossRefResult, jenaiIssuesResult] = await Promise.all([
    getGuidanceById(docId),
    getDocumentLineage(docId),
    getGuidanceResolvedCitations(docId),
    getGuidanceComplianceAnalysisSummary(docId),
    getGuidanceCrossRefsForHighlighting(docId),
    getJenAIIssuesForDocument(docId, 'guidance'),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const doc = result.data;
  const lineage = lineageResult.success ? lineageResult.data : null;
  const resolvedCitations = resolvedCitationsResult.success ? resolvedCitationsResult.data : [];
  const complianceSummary = complianceSummaryResult.success ? complianceSummaryResult.data : null;
  const crossRefHighlights = crossRefResult.success ? crossRefResult.data : [];
  const jenaiIssues = jenaiIssuesResult.success ? jenaiIssuesResult.data : [];

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={doc.title}
        description={doc.canonicalRef ?? undefined}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={`/${state}/guidance`}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Guidance
            </Link>
            <GuidanceStatusBadge status={doc.status} />
            <GuidanceBookmarkButton
              guidanceDocumentId={docId}
              jurisdiction={state}
            />
          </div>
        }
      />
      <Container size="2xl" className="py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content — second on mobile, left on desktop */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
            <GuidanceDetailContent doc={doc} state={state} crossRefHighlights={crossRefHighlights} />
          </div>

          {/* Sidebar — first on mobile, right on desktop */}
          <div className="order-1 lg:order-2 space-y-4">
            <GuidanceDetailSidebar doc={doc} state={state} resolvedCitations={resolvedCitations} />
            {complianceSummary && complianceSummary.totalIssues > 0 && (
              <GuidanceComplianceCard summary={complianceSummary} state={state} guidanceDocumentId={docId} />
            )}
            {jenaiIssues.length > 0 && (
              <JenAIIssuesList issues={jenaiIssues} state={state} />
            )}
            {lineage && lineage.chain.length > 1 && (
              <DocumentLineageViewer
                lineage={lineage}
                state={state}
              />
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
