import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tag } from '@/components/ui/Tag';
import { getGuidanceById, getDocumentLineage, getGuidanceResolvedCitations, getGuidanceComplianceAnalysisSummary } from '@/lib/actions/guidance-documents';
import { getGuidanceCrossRefsForHighlighting } from '@/lib/actions/cross-references';
import { getJenAIIssuesForDocument } from '@/lib/actions/jenai';
import { GuidanceDetailContent } from '@/components/guidance/GuidanceDetailContent';
import { GuidanceComplianceCard } from '@/components/guidance/GuidanceComplianceCard';
import { ReadabilityMetricsCard } from '@/components/guidance/ReadabilityMetricsCard';
import { JenAIIssuesList } from '@/components/jenai';
import { DocumentLineageViewer } from '@/components/guidance/DocumentLineageViewer';
import { GuidanceStatusBadge } from '@/components/guidance/GuidanceStatusBadge';
import { GuidanceBookmarkButton } from '@/components/guidance/GuidanceBookmarkButton';
import { PolicyCategoryBadge } from '@/components/guidance/PolicyCategoryBadge';
import { LinkedCitationList } from '@/components/guidance/LinkedCitationList';
import { EnhancedRegulationSummary } from '@/components/regulations/EnhancedRegulationSummary';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { RegulationDetailLayout } from '@/app/[state]/regulations/[id]/RegulationDetailLayout';
import { GuidanceSidebarWithNav } from './GuidanceSidebarWithNav';
import { isValidJurisdiction } from '@/types/state';
import type { SectionConfig } from '@/hooks/useActiveSection';
import type { GuidanceDocumentDetail } from '@/lib/actions/guidance-documents';

interface GuidanceDetailPageProps {
  params: Promise<{ state: string; id: string }>;
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-2 border-b border-[var(--color-neutral-100)] last:border-b-0">
      <span className="text-xs font-medium text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="text-xs text-[var(--color-text)] text-right">{children}</span>
    </div>
  );
}

function ListSection({ label, items }: { label: string; items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="py-2 border-b border-[var(--color-neutral-100)] last:border-b-0">
      <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">{label}</span>
      <ul className="space-y-0.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-[var(--color-text)]">{item}</li>
        ))}
      </ul>
    </div>
  );
}

const directionVariant: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  public: 'success',
  government: 'info',
  both: 'warning',
};

const expertiseVariant: Record<string, 'success' | 'warning' | 'default'> = {
  lay: 'success',
  specialized: 'warning',
};

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

  const hasSummaryMetadata = doc.summary || doc.sectionType || doc.keywords?.length || doc.appliesTo?.length || doc.hasForm || doc.hasIbr;
  const hasAudience = doc.targetAudience?.length || doc.audienceDirection || doc.audienceExpertise || doc.audienceExplanation;

  // Build sections array conditionally for scrollspy nav
  const sections: SectionConfig[] = [
    ...(hasSummaryMetadata ? [{ id: 'sidebar-summary', label: 'Summary' }] : []),
    { id: 'sidebar-metadata', label: 'Metadata' },
    ...(doc.wordCount !== null ? [{ id: 'sidebar-readability', label: 'Readability' }] : []),
    ...(complianceSummary && complianceSummary.totalIssues > 0 ? [{ id: 'sidebar-compliance', label: 'Compliance', count: complianceSummary.totalIssues }] : []),
    ...(jenaiIssues.length > 0 ? [{ id: 'sidebar-jenai', label: 'JenAI', count: jenaiIssues.length }] : []),
    ...(lineage && lineage.chain.length > 1 ? [{ id: 'sidebar-lineage', label: 'Lineage' }] : []),
  ];

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
        <RegulationDetailLayout
          sidebar={
            <GuidanceSidebarWithNav sections={sections}>
              {/* Summary */}
              {hasSummaryMetadata && (
                <div id="sidebar-summary">
                  <EnhancedRegulationSummary
                    summary={doc.summary}
                    sectionType={doc.sectionType}
                    keywords={doc.keywords}
                    appliesTo={doc.appliesTo}
                    hasForm={doc.hasForm}
                    hasIbr={doc.hasIbr}
                    showHeading
                  />
                </div>
              )}

              {/* Metadata + Audience */}
              <Card id="sidebar-metadata" padding="lg">
                <CardHeader>
                  <CardTitle>Document Metadata</CardTitle>
                </CardHeader>
                <div className="pt-4">
                  <MetadataRow label="Agency">{doc.agency}</MetadataRow>
                  {doc.agencyDivision && (
                    <MetadataRow label="Division">{doc.agencyDivision}</MetadataRow>
                  )}
                  {doc.docType && (
                    <MetadataRow label="Doc Type">{doc.docType}</MetadataRow>
                  )}
                  {doc.domain && (
                    <MetadataRow label="Domain">{doc.domain}</MetadataRow>
                  )}
                  <MetadataRow label="Category">
                    <PolicyCategoryBadge category={doc.policyCategory} />
                  </MetadataRow>
                  <MetadataRow label="Status">
                    <GuidanceStatusBadge status={doc.status} />
                  </MetadataRow>
                  {doc.datePublished && (
                    <MetadataRow label="Published">{doc.datePublished}</MetadataRow>
                  )}
                  {doc.dateEffective && (
                    <MetadataRow label="Effective">{doc.dateEffective}</MetadataRow>
                  )}
                  {doc.dateRevised && (
                    <MetadataRow label="Revised">{doc.dateRevised}</MetadataRow>
                  )}
                  {doc.dateExpires && (
                    <MetadataRow label="Expires">{doc.dateExpires}</MetadataRow>
                  )}
                  {doc.senderName && (
                    <MetadataRow label="Sender">
                      {doc.senderName}{doc.senderTitle ? `, ${doc.senderTitle}` : ''}
                    </MetadataRow>
                  )}
                  {doc.complianceIssueCount > 0 && state && (
                    <MetadataRow label="Compliance Issues">
                      <Link
                        href={`/${state}/pipeline?source=guidance`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <Badge variant="warning">{doc.complianceIssueCount}</Badge>
                      </Link>
                    </MetadataRow>
                  )}
                  {hasAudience && (
                    <div className="pt-3 mt-3 border-t border-[var(--color-neutral-200)]">
                      <span className="text-xs font-semibold text-[var(--color-text)] block mb-2">Audience</span>
                      {(doc.audienceDirection || doc.audienceExpertise) && (
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {doc.audienceDirection && (
                            <Badge variant={directionVariant[doc.audienceDirection] ?? 'default'}>
                              {doc.audienceDirection}
                            </Badge>
                          )}
                          {doc.audienceExpertise && (
                            <Badge variant={expertiseVariant[doc.audienceExpertise] ?? 'default'}>
                              {doc.audienceExpertise}
                            </Badge>
                          )}
                        </div>
                      )}
                      {doc.targetAudience && doc.targetAudience.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {doc.targetAudience.map((audience) => (
                            <Tag key={audience} variant="primary" size="sm">
                              {audience}
                            </Tag>
                          ))}
                        </div>
                      )}
                      {doc.audienceExplanation && (
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                          {doc.audienceExplanation}
                        </p>
                      )}
                    </div>
                  )}
                  <ListSection label="Programs" items={doc.programs} />
                  {resolvedCitations && resolvedCitations.length > 0 && state ? (
                    <LinkedCitationList citations={resolvedCitations} state={state} />
                  ) : (
                    <ListSection label="Cited Regulations" items={doc.citesRegulations} />
                  )}
                  <ListSection label="Cited Federal Statutes" items={doc.citesFederal} />
                  <ListSection label="Cited Documents" items={doc.citesDocuments} />
                </div>
              </Card>

              {/* Readability */}
              {doc.wordCount !== null && (
                <div id="sidebar-readability">
                  <ReadabilityMetricsCard doc={doc} />
                </div>
              )}

              {/* Compliance */}
              {complianceSummary && complianceSummary.totalIssues > 0 && (
                <div id="sidebar-compliance">
                  <GuidanceComplianceCard summary={complianceSummary} state={state} guidanceDocumentId={docId} />
                </div>
              )}

              {/* JenAI */}
              {jenaiIssues.length > 0 && (
                <div id="sidebar-jenai">
                  <JenAIIssuesList issues={jenaiIssues} state={state} />
                </div>
              )}

              {/* Lineage */}
              {lineage && lineage.chain.length > 1 && (
                <div id="sidebar-lineage">
                  <DocumentLineageViewer lineage={lineage} state={state} />
                </div>
              )}
            </GuidanceSidebarWithNav>
          }
          content={
            <GuidanceDetailContent doc={doc} state={state} crossRefHighlights={crossRefHighlights} />
          }
        />
      </Container>
    </div>
  );
}
