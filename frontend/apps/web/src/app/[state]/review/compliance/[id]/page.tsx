import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Alert } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { formatStateCitation } from '@/lib/formatters/citations';
import { getComplianceIssueById } from '@/lib/actions/compliance-issues';
import { ComplianceIssueDetailPage } from './ComplianceIssueDetailPage';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string; id: string }>;
}

export default async function ComplianceIssueReviewPage({ params }: PageProps) {
  const { state, id } = await params;
  const issueId = parseInt(id, 10);

  if (isNaN(issueId)) {
    notFound();
  }

  const result = await getComplianceIssueById(issueId);

  if (!result.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader title="Error" />
        <Container size="xl" className="py-6">
          <Alert variant="error">
            Failed to load compliance issue: {result.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const issue = result.data;
  if (!issue) {
    notFound();
  }

  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
  const citation = formatStateCitation(issue.jurisdiction || state, issue.regulation);

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={issueTypeLabel}
        description={citation || undefined}
      />
      <Container size="lg" className="py-6">
        <ComplianceIssueDetailPage issue={issue} state={state} />
      </Container>
    </div>
  );
}
