import { notFound } from 'next/navigation';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { SearchResultsClient } from '@/components/search';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/layout/Container';
import { Alert } from '@/components/ui';
import { isValidJurisdiction, JURISDICTION_CONFIG } from '@/types/state';
import { searchRegulations, getSearchFilterOptions } from '@/lib/actions/search';
import { parseCommaSeparated } from '@/lib/url/filter-helpers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    docType?: string;
    sectionType?: string;
    hierarchyLevel?: string;
    parentPath?: string;
    issueSystem?: string;
    issueType?: string;
    issueCategory?: string;
    issueSeverity?: string;
    classification?: string;
  }>;
}

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  if (!isValidJurisdiction(state)) {
    notFound();
  }

  const stateCode = state as JurisdictionCode;
  const stateConfig = JURISDICTION_CONFIG[stateCode];
  const query = queryParams.q?.trim() || '';
  const page = queryParams.page ? parseInt(queryParams.page, 10) : 1;

  // Fetch dynamic filter options (hierarchy levels & section types for this state)
  const filterOptionsResult = await getSearchFilterOptions(stateCode);
  const filterOptions = filterOptionsResult.success ? filterOptionsResult.data : undefined;

  // If no query, show empty search page
  if (!query) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={`Search ${stateConfig.name} Regulations`}
          description="Full-text search across regulations, statutes, guidance, policy documents, and analysis"
        />
        <Container size="2xl" className="py-6">
          <SearchResultsClient jurisdiction={stateCode} initialResults={null} initialQuery="" filterOptions={filterOptions} />
        </Container>
      </div>
    );
  }

  // Parse CSV multi-select params
  const issueTypes = parseCommaSeparated(queryParams.issueType);
  const issueCategories = parseCommaSeparated(queryParams.issueCategory);
  const issueSeverities = parseCommaSeparated(queryParams.issueSeverity);

  const result = await searchRegulations({
    jurisdiction: stateCode,
    query,
    page,
    docType: queryParams.docType || null,
    sectionType: queryParams.sectionType || null,
    hierarchyLevel: queryParams.hierarchyLevel || null,
    parentPath: queryParams.parentPath || null,
    issueSystem: queryParams.issueSystem || null,
    issueTypes: issueTypes.length ? issueTypes : null,
    issueCategories: issueCategories.length ? issueCategories : null,
    issueSeverities: issueSeverities.length ? issueSeverities : null,
    classification: queryParams.classification || null,
  });

  if (!result.success) {
    return (
      <div className="bg-[var(--color-background)] min-h-screen">
        <PageHeader
          title={`Search ${stateConfig.name} Regulations`}
          description="Full-text search across regulations, statutes, guidance, policy documents, and analysis"
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">Search failed: {result.error}</Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-background)] min-h-screen">
      <PageHeader
        title={`Search ${stateConfig.name} Regulations`}
        description="Full-text search across regulations, statutes, guidance, policy documents, and analysis"
      />
      <Container size="2xl" className="py-6">
        <SearchResultsClient
          jurisdiction={stateCode}
          initialResults={result.data}
          initialQuery={query}
          filterOptions={filterOptions}
        />
      </Container>
    </div>
  );
}
