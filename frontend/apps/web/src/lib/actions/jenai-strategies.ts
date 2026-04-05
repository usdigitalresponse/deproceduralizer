'use server';

import 'server-only';
import {
  db,
  JenAIRepository,
  type JurisdictionCode,
  type JenAIIssueWithContext,
  type PaginatedJenAIResult,
  sql,
} from '@deproceduralizer/database';
import { normalizeJurisdiction, JENAI_CATEGORIES } from '@deproceduralizer/database/schema';
import { type ActionResult, runAction, runCachedAction } from './types';

const jenaiRepo = new JenAIRepository(db);

// Raw SQL row shape returned by queryStrategyPaginated — typed once here
// so the mapper below doesn't need per-field casts.
interface RawJenAIRow {
  id: number;
  analysis_id: number;
  document_id: number | null;
  guidance_document_id: number | null;
  category: string;
  explanation: string;
  severity: number;
  complexity: string;
  confidence: number;
  matched_phrases: string[] | null;
  implementation_approach: string | null;
  effort_estimate: string | null;
  text_examples: string[] | null;
  tags: string[] | null;
  is_verbatim: boolean | null;
  review_status: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  justification_notes: string | null;
  team_notes: string | null;
  priority: number | null;
  impact_type: string | null;
  developer_status: string | null;
  developer_assigned: string | null;
  developer_notes: string | null;
  resolution_type: string | null;
  resolution_comments: string | null;
  developer_question: string | null;
  developer_checked_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  source_type: 'regulation' | 'guidance';
  reg_id: number | null;
  reg_title: string | null;
  reg_nycrr_title: number | null;
  reg_nycrr_part: string | null;
  reg_nycrr_section: string | null;
  reg_url: string | null;
  reg_summary: string | null;
  reg_section_type: string | null;
  reg_has_form: boolean | null;
  reg_has_ibr: boolean | null;
  guid_id: number | null;
  guid_title: string | null;
  guid_agency: string | null;
  guid_doc_type: string | null;
  guid_url: string | null;
  guid_year: number | null;
  guid_date_published: string | null;
  guid_status: string | null;
  guid_policy_category: string | null;
}

function mapRawRow(row: RawJenAIRow): JenAIIssueWithContext {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    documentId: row.document_id,
    guidanceDocumentId: row.guidance_document_id,
    category: row.category,
    explanation: row.explanation,
    severity: row.severity,
    complexity: row.complexity,
    confidence: row.confidence,
    matchedPhrases: row.matched_phrases,
    implementationApproach: row.implementation_approach,
    effortEstimate: row.effort_estimate,
    textExamples: row.text_examples,
    tags: row.tags,
    isVerbatim: row.is_verbatim,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    justificationNotes: row.justification_notes,
    teamNotes: row.team_notes,
    priority: row.priority,
    impactType: row.impact_type,
    developerStatus: row.developer_status,
    developerAssigned: row.developer_assigned,
    developerNotes: row.developer_notes,
    resolutionType: row.resolution_type,
    resolutionComments: row.resolution_comments,
    developerQuestion: row.developer_question,
    developerCheckedAt: row.developer_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceType: row.source_type,
    regulation: row.reg_id ? {
      id: row.reg_id,
      title: row.reg_title,
      nycrrTitle: row.reg_nycrr_title,
      nycrrPart: row.reg_nycrr_part,
      nycrrSection: row.reg_nycrr_section,
      url: row.reg_url,
      summary: row.reg_summary,
      sectionType: row.reg_section_type,
      hasForm: row.reg_has_form,
      hasIbr: row.reg_has_ibr,
      content: null,
    } : null,
    guidance: row.guid_id ? {
      id: row.guid_id,
      title: row.guid_title,
      agency: row.guid_agency,
      docType: row.guid_doc_type,
      url: row.guid_url,
      year: row.guid_year,
      datePublished: row.guid_date_published,
      status: row.guid_status,
      policyCategory: row.guid_policy_category,
      supersedes: null,
      supersededBy: null,
      revisionOf: null,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Strategy definitions
// ---------------------------------------------------------------------------

export type StrategyKey = 'best-stories' | 'surprises' | 'pahlka' | 'action-plan';

const BEST_STORIES_CATEGORIES = [
  'ADMINISTRATIVE_BURDENS',
  'DEAD_SUPERSEDED_REFERENCES',
  'FROZEN_TECHNOLOGY',
  'FEE_COST_BURDENS',
  'MISSING_DIGITAL_AUTHORIZATION',
  'ACCESS_ASSUMPTION_BARRIERS',
];

const SURPRISES_CATEGORIES = [
  'UNCLEAR_DELEGATION',
  'DEAD_SUPERSEDED_REFERENCES',
  'FROZEN_TECHNOLOGY',
  'MISSING_DIGITAL_AUTHORIZATION',
  'ACCESS_ASSUMPTION_BARRIERS',
];

const ALL_NON_OTHER_CATEGORIES = JENAI_CATEGORIES.filter(c => c !== 'OTHER');

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface StrategyOverlap {
  strategy1: string;
  strategy2: string;
  overlap: number;
}

export interface JenAIStrategyStats {
  total: number;
  bestStories: number;
  surprises: number;
  pahlka: number;
  actionPlan: number;
  byCategory: { category: string; count: number }[];
  bySeverity: { severity: number; count: number }[];
  overlaps: StrategyOverlap[];
}

export async function getJenAIStrategyStats(
  state: JurisdictionCode
): Promise<ActionResult<JenAIStrategyStats>> {
  const normalized = normalizeJurisdiction(state);

  return runCachedAction(
    'getJenAIStrategyStats',
    async () => {
      // Run all independent queries in parallel
      const [
        totalResult,
        bestStoriesResult,
        surprisesResult,
        pahlkaResult,
        categoryResult,
        severityResult,
        overlapResult,
      ] = await Promise.all([
        // Total count (excluding OTHER)
        db.execute(sql`
          SELECT COUNT(*)::int AS total
          FROM jenai_issues ji
          INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
          WHERE ja.jurisdiction = ${normalized}
            AND ji.category != 'OTHER'
        `),
        // Best Stories: severity >= 6 AND category IN narrative categories
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt
          FROM jenai_issues ji
          INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
          WHERE ja.jurisdiction = ${normalized}
            AND ji.severity >= 6
            AND ji.category = ANY(ARRAY['ADMINISTRATIVE_BURDENS','DEAD_SUPERSEDED_REFERENCES','FROZEN_TECHNOLOGY','FEE_COST_BURDENS','MISSING_DIGITAL_AUTHORIZATION','ACCESS_ASSUMPTION_BARRIERS']::text[])
        `),
        // Surprises: severity >= 4 AND category IN surprise categories
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt
          FROM jenai_issues ji
          INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
          WHERE ja.jurisdiction = ${normalized}
            AND ji.severity >= 4
            AND ji.category = ANY(ARRAY['UNCLEAR_DELEGATION','DEAD_SUPERSEDED_REFERENCES','FROZEN_TECHNOLOGY','MISSING_DIGITAL_AUTHORIZATION','ACCESS_ASSUMPTION_BARRIERS']::text[])
        `),
        // Pahlka: severity >= 5 AND category != OTHER
        db.execute(sql`
          SELECT COUNT(*)::int AS cnt
          FROM jenai_issues ji
          INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
          WHERE ja.jurisdiction = ${normalized}
            AND ji.severity >= 5
            AND ji.category != 'OTHER'
        `),
        // Category breakdown
        db.execute(sql`
          SELECT ji.category, COUNT(*)::int AS count
          FROM jenai_issues ji
          INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
          WHERE ja.jurisdiction = ${normalized}
            AND ji.category != 'OTHER'
          GROUP BY ji.category
          ORDER BY count DESC
        `),
        // Severity breakdown
        db.execute(sql`
          SELECT ji.severity, COUNT(*)::int AS count
          FROM jenai_issues ji
          INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
          WHERE ja.jurisdiction = ${normalized}
            AND ji.category != 'OTHER'
          GROUP BY ji.severity
          ORDER BY ji.severity DESC
        `),
        // Overlap matrix: count findings in each pair of strategies
        db.execute(sql`
          WITH tagged AS (
            SELECT ji.id,
              CASE WHEN ji.severity >= 6
                AND ji.category = ANY(ARRAY['ADMINISTRATIVE_BURDENS','DEAD_SUPERSEDED_REFERENCES','FROZEN_TECHNOLOGY','FEE_COST_BURDENS','MISSING_DIGITAL_AUTHORIZATION','ACCESS_ASSUMPTION_BARRIERS']::text[])
                THEN true ELSE false END AS best_stories,
              CASE WHEN ji.severity >= 4
                AND ji.category = ANY(ARRAY['UNCLEAR_DELEGATION','DEAD_SUPERSEDED_REFERENCES','FROZEN_TECHNOLOGY','MISSING_DIGITAL_AUTHORIZATION','ACCESS_ASSUMPTION_BARRIERS']::text[])
                THEN true ELSE false END AS surprises,
              CASE WHEN ji.severity >= 5 AND ji.category != 'OTHER'
                THEN true ELSE false END AS pahlka,
              CASE WHEN ji.category != 'OTHER'
                THEN true ELSE false END AS action_plan
            FROM jenai_issues ji
            INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
            WHERE ja.jurisdiction = ${normalized} AND ji.category != 'OTHER'
          )
          SELECT
            COUNT(*) FILTER (WHERE best_stories AND surprises)::int AS bs_su,
            COUNT(*) FILTER (WHERE best_stories AND pahlka)::int AS bs_pa,
            COUNT(*) FILTER (WHERE best_stories AND action_plan)::int AS bs_ap,
            COUNT(*) FILTER (WHERE surprises AND pahlka)::int AS su_pa,
            COUNT(*) FILTER (WHERE surprises AND action_plan)::int AS su_ap,
            COUNT(*) FILTER (WHERE pahlka AND action_plan)::int AS pa_ap
          FROM tagged
        `),
      ]);

      const total = (totalResult.rows[0] as { total: number }).total;
      const ov = overlapResult.rows[0] as Record<string, number>;
      const overlaps: StrategyOverlap[] = [
        { strategy1: 'best-stories', strategy2: 'surprises', overlap: ov.bs_su },
        { strategy1: 'best-stories', strategy2: 'pahlka', overlap: ov.bs_pa },
        { strategy1: 'best-stories', strategy2: 'action-plan', overlap: ov.bs_ap },
        { strategy1: 'surprises', strategy2: 'pahlka', overlap: ov.su_pa },
        { strategy1: 'surprises', strategy2: 'action-plan', overlap: ov.su_ap },
        { strategy1: 'pahlka', strategy2: 'action-plan', overlap: ov.pa_ap },
      ];

      return {
        total,
        bestStories: (bestStoriesResult.rows[0] as { cnt: number }).cnt,
        surprises: (surprisesResult.rows[0] as { cnt: number }).cnt,
        pahlka: (pahlkaResult.rows[0] as { cnt: number }).cnt,
        actionPlan: total,
        byCategory: categoryResult.rows as { category: string; count: number }[],
        bySeverity: severityResult.rows as { severity: number; count: number }[],
        overlaps,
      };
    },
    [`jenai-strategy-stats-${state}`],
    { revalidate: 120, tags: ['jenai-strategies'] }
  );
}

// ---------------------------------------------------------------------------
// Paginated query
// ---------------------------------------------------------------------------

export interface JenAIStrategyFilters {
  strategy?: StrategyKey;
  category?: string;
  severity?: string;
  search?: string;
}

export type { JenAIIssueWithContext, PaginatedJenAIResult };

export async function getJenAIStrategyPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy?: 'severity' | 'category' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    filters?: JenAIStrategyFilters;
  }
): Promise<ActionResult<PaginatedJenAIResult>> {
  const { page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;

  // Build repo-compatible filters
  const repoFilters: {
    status?: string;
    severity?: 'high' | 'medium' | 'low';
    categories?: string[];
    search?: string;
  } = {};

  // Strategy-based category/severity filters
  if (filters?.strategy === 'best-stories') {
    repoFilters.categories = BEST_STORIES_CATEGORIES;
    // severity >= 6 is between "medium" (4-6) and "high" (7+), so we use custom query
  } else if (filters?.strategy === 'surprises') {
    repoFilters.categories = SURPRISES_CATEGORIES;
  } else if (filters?.strategy === 'pahlka') {
    // category != OTHER, severity >= 5 — need custom handling
  } else if (filters?.strategy === 'action-plan') {
    // category != OTHER — broadest view
  }

  // User-selected category filter (on top of strategy)
  if (filters?.category) {
    const cats = filters.category.split(',').filter(Boolean);
    if (cats.length > 0) {
      // If strategy already restricts categories, intersect
      if (repoFilters.categories) {
        repoFilters.categories = repoFilters.categories.filter(c => cats.includes(c));
      } else {
        repoFilters.categories = cats;
      }
    }
  }

  // Severity filter from user
  if (filters?.severity) {
    const sev = filters.severity;
    if (sev === 'high' || sev === 'medium' || sev === 'low') {
      repoFilters.severity = sev;
    }
  }

  if (filters?.search) {
    repoFilters.search = filters.search;
  }

  // For strategies that need custom severity thresholds, use raw SQL
  const strategy = filters?.strategy;
  const needsCustomQuery = strategy === 'best-stories' || strategy === 'surprises' || strategy === 'pahlka';

  if (needsCustomQuery) {
    return runAction('getJenAIStrategyPaginated', async () => {
      return queryStrategyPaginated(state, {
        page,
        pageSize,
        sortBy,
        sortOrder,
        strategy: strategy!,
        categoryFilter: filters?.category?.split(',').filter(Boolean),
        severityFilter: filters?.severity,
        search: filters?.search,
      });
    });
  }

  // For action-plan, use the existing repo but exclude OTHER
  const cacheKey = `jenai-strat-${state}-${page}-${pageSize}-${sortBy}-${sortOrder}-${filters?.strategy ?? ''}-${filters?.category ?? ''}-${filters?.severity ?? ''}-${filters?.search ?? ''}`;

  return runCachedAction(
    'getJenAIStrategyPaginated',
    () => {
      // Exclude OTHER for action-plan — if no user category filter, pass all non-OTHER categories
      const cats = repoFilters.categories && repoFilters.categories.length > 0
        ? repoFilters.categories
        : ALL_NON_OTHER_CATEGORIES;
      return jenaiRepo.getAllPaginated({
        jurisdiction: state,
        page,
        pageSize,
        sortBy: sortBy === 'createdAt' ? 'severity' : sortBy,
        sortOrder,
        filters: {
          status: 'all',
          ...(cats.length > 0 ? { categories: cats } : {}),
          ...(repoFilters.severity ? { severity: repoFilters.severity } : {}),
          ...(repoFilters.search ? { search: repoFilters.search } : {}),
        },
      });
    },
    [cacheKey],
    { revalidate: 120, tags: ['jenai-strategies'] }
  );
}

// ---------------------------------------------------------------------------
// Custom strategy query with severity thresholds
// ---------------------------------------------------------------------------

async function queryStrategyPaginated(
  state: JurisdictionCode,
  options: {
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: string;
    strategy: StrategyKey;
    categoryFilter?: string[];
    severityFilter?: string;
    search?: string;
  }
): Promise<PaginatedJenAIResult> {
  const normalized = normalizeJurisdiction(state);
  const { page, pageSize, sortBy, sortOrder, strategy, categoryFilter, severityFilter, search } = options;
  const offset = (page - 1) * pageSize;

  // Build WHERE fragments
  let strategyCategories: string[] | null = null;
  let minSeverity = 0;

  if (strategy === 'best-stories') {
    strategyCategories = BEST_STORIES_CATEGORIES;
    minSeverity = 6;
  } else if (strategy === 'surprises') {
    strategyCategories = SURPRISES_CATEGORIES;
    minSeverity = 4;
  } else if (strategy === 'pahlka') {
    minSeverity = 5;
  }

  // If user has a category filter, intersect with strategy categories
  let effectiveCategories = strategyCategories;
  if (categoryFilter && categoryFilter.length > 0) {
    if (effectiveCategories) {
      effectiveCategories = effectiveCategories.filter(c => categoryFilter.includes(c));
    } else {
      effectiveCategories = categoryFilter;
    }
  }

  // User severity filter overrides strategy minimum
  let severityFragment = minSeverity > 0 ? sql`AND ji.severity >= ${minSeverity}` : sql``;
  if (severityFilter) {
    const numericSeverity = parseInt(severityFilter, 10);
    if (!isNaN(numericSeverity) && numericSeverity >= 1 && numericSeverity <= 10) {
      severityFragment = sql`AND ji.severity = ${numericSeverity}`;
    }
  }

  const categoryFragment = effectiveCategories && effectiveCategories.length > 0
    ? sql`AND ji.category = ANY(${sql`ARRAY[${sql.join(effectiveCategories.map(c => sql`${c}`), sql`, `)}]::text[]`})`
    : sql`AND ji.category != 'OTHER'`;

  const searchFragment = search
    ? sql`AND (ji.explanation ILIKE ${'%' + search + '%'} OR COALESCE(rd.title, gd.title) ILIKE ${'%' + search + '%'})`
    : sql``;

  const sortFragment = sortBy === 'category' ? sql`ji.category` : sql`ji.severity`;
  const dirFragment = sortOrder === 'asc' ? sql`ASC NULLS LAST` : sql`DESC NULLS LAST`;

  // Count
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM jenai_issues ji
    INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
    LEFT JOIN regulatory_documents rd ON ji.document_id = rd.id
    LEFT JOIN guidance_documents gd ON ji.guidance_document_id = gd.id
    WHERE ja.jurisdiction = ${normalized}
      ${categoryFragment}
      ${severityFragment}
      ${searchFragment}
  `);

  const total = (countResult.rows[0] as { total: number }).total;

  // Data query - use repo for actual data fetch with proper mapping
  // We'll do a simpler approach: use the repo's getAllPaginated with computed filters
  // But since repo doesn't support minSeverity directly, use raw SQL for data too
  const dataResult = await db.execute(sql`
    SELECT
      ji.id, ji.analysis_id, ji.document_id, ji.guidance_document_id,
      ji.category, ji.explanation, ji.severity, ji.complexity, ji.confidence,
      ji.matched_phrases, ji.implementation_approach, ji.effort_estimate,
      ji.text_examples, ji.tags, ji.is_verbatim,
      ji.review_status, ji.reviewed_by, ji.reviewed_at,
      ji.justification_notes, ji.team_notes, ji.priority, ji.impact_type,
      ji.developer_status, ji.developer_assigned, ji.developer_notes,
      ji.resolution_type, ji.resolution_comments, ji.developer_question,
      ji.developer_checked_at, ji.created_at, ji.updated_at,
      CASE WHEN ji.guidance_document_id IS NOT NULL THEN 'guidance' ELSE 'regulation' END AS source_type,
      rd.id AS reg_id, rd.title AS reg_title, rd.nycrr_title AS reg_nycrr_title,
      rd.nycrr_part AS reg_nycrr_part, rd.nycrr_section AS reg_nycrr_section,
      rd.url AS reg_url, rd.summary AS reg_summary, rd.section_type AS reg_section_type,
      rd.has_form AS reg_has_form, rd.has_ibr AS reg_has_ibr,
      gd.id AS guid_id, gd.title AS guid_title, gd.agency AS guid_agency,
      gd.doc_type AS guid_doc_type, gd.url AS guid_url, gd.year AS guid_year,
      gd.date_published AS guid_date_published, gd.status AS guid_status,
      gd.policy_category AS guid_policy_category
    FROM jenai_issues ji
    INNER JOIN jenai_analyses ja ON ji.analysis_id = ja.id
    LEFT JOIN regulatory_documents rd ON ji.document_id = rd.id
    LEFT JOIN guidance_documents gd ON ji.guidance_document_id = gd.id
    WHERE ja.jurisdiction = ${normalized}
      ${categoryFragment}
      ${severityFragment}
      ${searchFragment}
    ORDER BY ${sortFragment} ${dirFragment}, ji.id ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  // Single boundary cast: raw SQL rows → typed interface (avoids per-field `as` casts)
  const rows: RawJenAIRow[] = dataResult.rows as never;
  const data: JenAIIssueWithContext[] = rows.map(mapRawRow);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// Tournament results (mega-patterns + named findings)
// ---------------------------------------------------------------------------

export interface TournamentExample {
  id: number;
  citation: string;
  category: string | null;
  severity: number | null;
  explanation: string;
  fix: string;
  whyItMatters: string;
  domain: string;
}

export interface TournamentPattern {
  id: number;
  pass: 'pass1' | 'pass2';
  name: string;
  description: string;
  regulationCount: number;
  domainBreakdown: Record<string, number>;
  examples: TournamentExample[];
}

export interface TournamentNamedFinding {
  id: number;
  name: string;
  fix: string;
  citations: string[];
  why: string;
}

export interface TournamentResults {
  pass1Patterns: TournamentPattern[];
  pass2Patterns: TournamentPattern[];
  namedFindings: TournamentNamedFinding[];
}

export async function getTournamentResults(): Promise<ActionResult<TournamentResults>> {
  return runCachedAction(
    'getTournamentResults',
    async () => {
      const [patternsResult, examplesResult, findingsResult] = await Promise.all([
        db.execute(sql`
          SELECT id, pass, name, description, regulation_count
          FROM tournament_patterns
          ORDER BY pass, regulation_count DESC
        `),
        db.execute(sql`
          SELECT id, pattern_id, jenai_issue_id, citation, category, severity,
                 explanation, fix, why_it_matters,
                 CASE
                   WHEN citation ~ '^18 NYCRR (41[1-9]|418-|419|450|451|46[2-9]|47[0-7]|48[12]|900|1001)\.' THEN 'Childcare'
                   WHEN citation ~ '^18 NYCRR (42[0-9]|43[0-9]|44[0-9]|507|516|625|626|628|801)\.' THEN 'Child Welfare & Foster Care'
                   WHEN citation ~ '^18 NYCRR (3[5-9][0-9]|39[0-9]|408|491|600|609|620)\.' THEN 'Public Assistance & SNAP'
                   WHEN citation ~ '^18 NYCRR (50[0-9]|51[0-9]|52[0-7]|53[0-8]|54[02]|603|627|633|635|655)\.' THEN 'Medicaid'
                   WHEN citation ~ '^18 NYCRR (48[5-9]|49[034])\.' THEN 'Adult Care Facilities'
                   WHEN citation ~ '^18 NYCRR' THEN 'Social Services'
                   WHEN citation ~ '^10 NYCRR' THEN 'Health'
                   WHEN citation ~ '^14 NYCRR' THEN 'Mental Hygiene'
                   WHEN citation ~ '^8 NYCRR' THEN 'Education'
                   ELSE 'Other'
                 END as domain
          FROM tournament_examples
          ORDER BY pattern_id, severity DESC NULLS LAST
        `),
        db.execute(sql`
          SELECT id, name, fix, citations, why
          FROM tournament_named_findings
          ORDER BY id
        `),
      ]);

      const examplesByPattern = new Map<number, TournamentExample[]>();
      for (const row of examplesResult.rows as Record<string, unknown>[]) {
        const patternId = row.pattern_id as number;
        if (!examplesByPattern.has(patternId)) {
          examplesByPattern.set(patternId, []);
        }
        examplesByPattern.get(patternId)!.push({
          id: row.id as number,
          citation: row.citation as string,
          category: row.category as string | null,
          severity: row.severity as number | null,
          explanation: row.explanation as string,
          fix: row.fix as string,
          whyItMatters: row.why_it_matters as string,
          domain: row.domain as string,
        });
      }

      const allPatterns: TournamentPattern[] = (patternsResult.rows as Record<string, unknown>[]).map(row => {
        const examples = examplesByPattern.get(row.id as number) ?? [];
        // Compute domain breakdown from examples
        const domainBreakdown: Record<string, number> = {};
        for (const ex of examples) {
          domainBreakdown[ex.domain] = (domainBreakdown[ex.domain] || 0) + 1;
        }
        return {
          id: row.id as number,
          pass: row.pass as 'pass1' | 'pass2',
          name: row.name as string,
          description: row.description as string,
          regulationCount: row.regulation_count as number,
          domainBreakdown,
          examples,
        };
      });

      const namedFindings: TournamentNamedFinding[] = (findingsResult.rows as Record<string, unknown>[]).map(row => ({
        id: row.id as number,
        name: row.name as string,
        fix: row.fix as string,
        citations: row.citations as string[],
        why: row.why as string,
      }));

      return {
        pass1Patterns: allPatterns.filter(p => p.pass === 'pass1'),
        pass2Patterns: allPatterns.filter(p => p.pass === 'pass2'),
        namedFindings,
      };
    },
    ['tournament-results'],
    { revalidate: 3600, tags: ['tournament'] }
  );
}
