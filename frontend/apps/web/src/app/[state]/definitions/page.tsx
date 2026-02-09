import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui';
import { GlossaryClient } from '@/components/definitions';
import {
  getDefinitionsPaginated,
  getAlphabeticalIndex,
  getDefinitionStats,
  getAggregatedTermsPaginated,
} from '@/lib/actions/definitions';
import { type StateCode, isValidState, STATE_CONFIG } from '@/types/state';

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{
    search?: string;
    letter?: string;
    page?: string;
    view?: 'flat' | 'aggregated';
  }>;
}

const PAGE_SIZE = 20;

export default async function DefinitionsPage({ params, searchParams }: PageProps) {
  const { state } = await params;
  const queryParams = await searchParams;

  // Validate state parameter
  if (!isValidState(state)) {
    notFound();
  }

  const stateCode = state as StateCode;
  const stateConfig = STATE_CONFIG[stateCode];

  // Parse query params
  const search = queryParams.search || '';
  const letter = queryParams.letter || undefined;
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));

  // Fetch initial data in parallel
  const [definitionsResult, aggregatedResult, statsResult, alphabeticalIndexResult] = await Promise.all([
    getDefinitionsPaginated(stateCode, {
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      letter,
      sortBy: 'term',
      sortOrder: 'asc',
    }),
    getAggregatedTermsPaginated(stateCode, {
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      letter,
    }),
    getDefinitionStats(stateCode),
    getAlphabeticalIndex(stateCode),
  ]);

  // Handle errors
  if (!statsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`${stateConfig.name} Definitions Glossary`}
          description={`Browse regulatory definitions from ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load definition statistics: {statsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!alphabeticalIndexResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`${stateConfig.name} Definitions Glossary`}
          description={`Browse regulatory definitions from ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load alphabetical index: {alphabeticalIndexResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (!definitionsResult.success) {
    return (
      <div className="bg-[var(--color-background)]">
        <PageHeader
          title={`${stateConfig.name} Definitions Glossary`}
          description={`Browse regulatory definitions from ${stateConfig.regulationsLabel}`}
        />
        <Container size="2xl" className="py-6">
          <Alert variant="error">
            Failed to load definitions: {definitionsResult.error}
          </Alert>
        </Container>
      </div>
    );
  }

  const { data: definitions, total, totalPages } = definitionsResult.data;
  const aggregatedTerms = aggregatedResult.success ? aggregatedResult.data.data : [];
  const stats = statsResult.data;
  const alphabeticalIndex = alphabeticalIndexResult.data;

  return (
    <div className="bg-[var(--color-background)]">
      <PageHeader
        title={`${stateConfig.name} Definitions Glossary`}
        description={`Browse and search ${stats.total.toLocaleString()} regulatory definitions from ${stateConfig.regulationsLabel}`}
      />

      <Container size="2xl" className="py-6">
        <GlossaryClient
          state={stateCode}
          initialData={{
            definitions,
            aggregatedTerms,
            total,
            totalPages,
            stats,
            alphabeticalIndex,
          }}
        />
      </Container>
    </div>
  );
}
