import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RedFlagsList } from '@/components/RedFlagsList';
import { formatNycrrCitation } from '@/lib/formatters/nycrr';
import { HierarchyBreadcrumbsServer } from '@/components/regulations/HierarchyBreadcrumbsServer';
import { ChildrenListServer } from '@/components/regulations/ChildrenListServer';

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

  const repo = new RegulatoryDocumentsRepository(db);
  const regulation = await repo.getByIdWithAnalysis(regulationId);

  if (!regulation) {
    notFound();
  }

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
              currentTitle={regulation.title || 'Untitled'}
              state={state}
            />

            {/* Additional hierarchy details */}
            {(regulation.hierarchyLevel || regulation.nycrrTitle || regulation.nycrrPart || regulation.nycrrSection) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
                {regulation.hierarchyLevel && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Level:</span>
                    <span className="ml-2 capitalize">{regulation.hierarchyLevel}</span>
                  </div>
                )}
                {regulation.nycrrTitle && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Title:</span>
                    <span className="ml-2">{regulation.nycrrTitle}</span>
                  </div>
                )}
                {regulation.nycrrPart && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Part:</span>
                    <span className="ml-2">{regulation.nycrrPart}</span>
                  </div>
                )}
                {regulation.nycrrSection && (
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">Section:</span>
                    <span className="ml-2">{regulation.nycrrSection}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Metadata Grid */}
          <Card>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Metadata</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Source</span>
                <a
                  href={regulation.url ?? ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline text-sm"
                >
                  View Original
                </a>
              </div>
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Red Flags</span>
                <Badge variant={(regulation.numFlags ?? 0) > 0 ? 'danger' : 'default'}>
                  {regulation.numFlags || 0} flags
                </Badge>
              </div>
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Severity</span>
                {regulation.maxSeverity ? (
                  <SeverityBadge severity={regulation.maxSeverity} />
                ) : (
                  <span className="text-[var(--color-text-muted)]">–</span>
                )}
              </div>
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Complexity</span>
                {regulation.overallComplexity ? (
                  <Badge
                    variant={
                      regulation.overallComplexity === 'HIGH' ? 'danger' :
                      regulation.overallComplexity === 'MEDIUM' || regulation.overallComplexity === 'MEDIUM-HIGH' ? 'warning' :
                      'success'
                    }
                  >
                    {regulation.overallComplexity}
                  </Badge>
                ) : (
                  <span className="text-[var(--color-text-muted)]">–</span>
                )}
              </div>
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Implementation Issues</span>
                <span className="text-sm">
                  {regulation.hasImplementationIssues ? (
                    <span className="text-[var(--color-danger)]">Yes</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">No</span>
                  )}
                </span>
              </div>
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Tech Review Required</span>
                <span className="text-sm">
                  {regulation.requiresTechnicalReview ? (
                    <span className="text-[var(--color-info)]">Yes</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">No</span>
                  )}
                </span>
              </div>
              <div>
                <span className="font-semibold text-[var(--color-text-secondary)] text-sm block">Reporting Requirement</span>
                <span className="text-sm">
                  {regulation.hasReportingRequirement ? (
                    <span className="text-[var(--color-warning)]">Yes</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">No</span>
                  )}
                </span>
              </div>
            </div>
          </Card>

          {/* Summary */}
          <Card>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Summary</h2>
            <div className="bg-[var(--color-info-bg)] border-l-4 border-[var(--color-info)] p-4 rounded-[var(--radius-md)] text-sm">
              {regulation.summary || 'No summary available'}
            </div>
          </Card>

          {/* Children (sub-sections, parts, etc.) - only renders if document has children */}
          <ChildrenListServer documentId={regulationId} state={state} />

          {/* Red Flags Details */}
          {regulation.redFlags && regulation.redFlags.length > 0 && (
            <RedFlagsList initialFlags={regulation.redFlags} />
          )}

          {/* Regulation Text */}
          <Card>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Full Regulation Text</h2>
            <div className="bg-[var(--color-neutral-50)] border-l-4 border-[var(--color-neutral-400)] p-4 rounded-[var(--radius-md)] text-sm font-mono whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {regulation.content || 'No content available'}
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
