import { sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { StateCode, normalizeState } from '../schema/constants';
import { shouldExcludeStatutes, shouldExcludeRegulations, shouldSkipAnalyses } from './search-filters';

// ============================================
// Types
// ============================================

export interface SearchResultItem {
  id: number;
  type: 'regulation' | 'statute';
  title: string;
  citation: string | null;
  hierarchyPath: string | null;
  snippet: string;
  rank: number;
  sectionType: string | null;
  issueCount: number;
  burdensomeCount: number;
  justifiedCount: number;
  maxSeverity: number | null;
  hasFederalMandate: boolean;
  easyCleanupCount: number;
}

export interface CommentaryHit {
  id: number;
  type: 'analysis' | 'definition';
  documentId: number;
  documentTitle: string;
  documentCitation: string | null;
  snippet: string;
  label: string;
  rank: number;
  classification: string | null;
  severity: number | null;
  /** Text to highlight on the regulation detail page.
   * For analyses: the regex_match_context from compliance_issues (the exact flagged text).
   * For definitions: the term name. */
  highlightText: string | null;
}

export interface SearchResults {
  items: SearchResultItem[];
  commentary: CommentaryHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchFilterOptions {
  hierarchyLevels: string[];
  sectionTypes: string[];
}

export interface SearchOptions {
  state: StateCode;
  query: string;
  page?: number;
  pageSize?: number;
  sectionType?: string | null;
  hierarchyLevel?: string | null;
  parentPath?: string | null;
  hasAnalysis?: string | null;
  classification?: string | null;
  docType?: string | null;
}

// ============================================
// Repository
// ============================================

export class SearchRepository extends BaseRepository {
  async search(options: SearchOptions): Promise<SearchResults> {
    const {
      state,
      query,
      page = 1,
      pageSize = 20,
      sectionType,
      hierarchyLevel,
      parentPath,
      hasAnalysis,
      classification,
      docType,
    } = options;

    const offset = (page - 1) * pageSize;

    // Build optional filter clauses for regulations
    const regSectionTypeFilter = sectionType
      ? sql`AND rd.section_type = ${sectionType}`
      : sql``;
    const regHierarchyLevelFilter = hierarchyLevel
      ? sql`AND rd.hierarchy_level = ${hierarchyLevel}`
      : sql``;
    const regParentPathFilter = parentPath
      ? sql`AND rd.hierarchy_path LIKE ${parentPath + '%'}`
      : sql``;

    // Analysis existence filter
    const regHasAnalysisFilter = hasAnalysis === 'true'
      ? sql`AND EXISTS (SELECT 1 FROM compliance_issue_analyses cia2 WHERE cia2.document_id = rd.id AND cia2.requirement_found = true)`
      : hasAnalysis === 'false'
        ? sql`AND NOT EXISTS (SELECT 1 FROM compliance_issue_analyses cia2 WHERE cia2.document_id = rd.id AND cia2.requirement_found = true)`
        : sql``;

    // Classification filter
    const regClassificationFilter = classification
      ? sql`AND EXISTS (SELECT 1 FROM compliance_issue_analyses cia2 WHERE cia2.document_id = rd.id AND cia2.requirement_found = true AND cia2.tier2_classification = ${classification})`
      : sql``;

    // Document type filter — exclude entire branch when filtering to the other type.
    // Also exclude statutes when regulation-specific filters are active
    // (statutes have no section_type, hierarchy_level, or analyses).
    const excludeRegulations = shouldExcludeRegulations({ docType });
    const excludeStatutes = shouldExcludeStatutes({ docType, sectionType, hierarchyLevel, hasAnalysis, classification });

    // Primary search: regulations + statutes via UNION ALL
    const results = await this.db.execute(sql`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${query}) AS q
      )
      SELECT * FROM (
        SELECT
          rd.id,
          'regulation' AS type,
          rd.title,
          rd.citation,
          rd.hierarchy_path AS "hierarchyPath",
          ts_headline('english', coalesce(rd.content, rd.title, ''), sq.q,
            'MaxFragments=2, MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
          ) AS snippet,
          ts_rank(rd.search_vector, sq.q, 32) AS rank,
          rd.section_type AS "sectionType",
          coalesce(astats.issue_count, 0) AS "issueCount",
          coalesce(astats.burdensome_count, 0) AS "burdensomeCount",
          coalesce(astats.justified_count, 0) AS "justifiedCount",
          astats.max_severity AS "maxSeverity",
          coalesce(astats.has_federal_mandate, false) AS "hasFederalMandate",
          coalesce(astats.easy_cleanup_count, 0) AS "easyCleanupCount"
        FROM regulatory_documents rd
        CROSS JOIN search_query sq
        LEFT JOIN LATERAL (
          SELECT
            count(*)::int AS issue_count,
            count(*) FILTER (WHERE cia.tier2_classification = 'burdensome')::int AS burdensome_count,
            count(*) FILTER (WHERE cia.tier2_classification = 'justified')::int AS justified_count,
            max(cia.severity) AS max_severity,
            bool_or(cia.federal_mandate_found) AS has_federal_mandate,
            count(*) FILTER (WHERE cia.easy_cleanup_candidate = true)::int AS easy_cleanup_count
          FROM compliance_issue_analyses cia
          WHERE cia.document_id = rd.id
            AND cia.requirement_found = true
        ) astats ON true
        WHERE rd.state = ${normalizeState(state)}
          AND rd.search_vector @@ sq.q
          ${excludeRegulations ? sql`AND false` : sql``}
          ${regSectionTypeFilter}
          ${regHierarchyLevelFilter}
          ${regParentPathFilter}
          ${regHasAnalysisFilter}
          ${regClassificationFilter}

        UNION ALL

        SELECT
          s.id,
          'statute' AS type,
          s.title,
          s.citation,
          NULL AS "hierarchyPath",
          ts_headline('english', coalesce(s.content, s.title, ''), sq.q,
            'MaxFragments=2, MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
          ) AS snippet,
          ts_rank(s.search_vector, sq.q, 32) AS rank,
          NULL AS "sectionType",
          0 AS "issueCount",
          0 AS "burdensomeCount",
          0 AS "justifiedCount",
          NULL AS "maxSeverity",
          false AS "hasFederalMandate",
          0 AS "easyCleanupCount"
        FROM statutes s, search_query sq
        WHERE s.state = ${normalizeState(state)}
          AND s.search_vector @@ sq.q
          ${excludeStatutes ? sql`AND false` : sql``}
      ) combined
      ORDER BY rank DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    // Count query
    const countResult = await this.db.execute(sql`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${query}) AS q
      )
      SELECT
        (
          SELECT count(*)::int FROM regulatory_documents rd, search_query sq
          WHERE rd.state = ${normalizeState(state)}
            AND rd.search_vector @@ sq.q
            ${excludeRegulations ? sql`AND false` : sql``}
            ${regSectionTypeFilter}
            ${regHierarchyLevelFilter}
            ${regParentPathFilter}
            ${regHasAnalysisFilter}
            ${regClassificationFilter}
        ) + (
          SELECT count(*)::int FROM statutes s, search_query sq
          WHERE s.state = ${normalizeState(state)}
            AND s.search_vector @@ sq.q
            ${excludeStatutes ? sql`AND false` : sql``}
        ) AS total
    `);

    const total = Number((countResult.rows[0] as unknown as { total: number }).total) || 0;
    const items = results.rows as unknown as SearchResultItem[];

    // Commentary sidebar query (analysis + definition hits, filtered to match active filters)
    const commentary = await this.searchCommentary(state, query, { classification, hasAnalysis });

    return {
      items,
      commentary,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async searchCommentary(
    state: StateCode,
    query: string,
    filters?: { classification?: string | null; hasAnalysis?: string | null },
  ): Promise<CommentaryHit[]> {
    // Filter analysis hits by classification when active
    const classificationFilter = filters?.classification
      ? sql`AND cia.tier2_classification = ${filters.classification}`
      : sql``;

    // When filtering to "not analyzed", skip the analysis branch entirely
    const skipAnalyses = shouldSkipAnalyses(filters?.hasAnalysis);

    const results = await this.db.execute(sql`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${query}) AS q
      )
      (
        SELECT
          cia.id,
          'analysis' AS type,
          cia.document_id AS "documentId",
          rd.title AS "documentTitle",
          rd.citation AS "documentCitation",
          ts_headline('english',
            coalesce(cia.tier2_reasoning, '') || ' ' || coalesce(cia.tier3_reasoning, ''),
            sq.q,
            'MaxFragments=1, MaxWords=30, MinWords=10, StartSel=<mark>, StopSel=</mark>'
          ) AS snippet,
          cia.issue_type AS label,
          ts_rank(cia.search_vector, sq.q, 32) AS rank,
          cia.tier2_classification AS classification,
          cia.severity,
          match_ctx.regex_match_context AS "highlightText"
        FROM compliance_issue_analyses cia
        JOIN regulatory_documents rd ON rd.id = cia.document_id
        CROSS JOIN search_query sq
        LEFT JOIN LATERAL (
          SELECT ci.regex_match_context
          FROM compliance_issues ci
          WHERE ci.analysis_id = cia.id
          LIMIT 1
        ) match_ctx ON true
        WHERE rd.state = ${normalizeState(state)}
          AND cia.search_vector @@ sq.q
          ${classificationFilter}
          ${skipAnalyses ? sql`AND false` : sql``}
        ORDER BY rank DESC
        LIMIT 30
      )
      UNION ALL
      (
        SELECT
          d.id,
          'definition' AS type,
          d.document_id AS "documentId",
          rd.title AS "documentTitle",
          rd.citation AS "documentCitation",
          d.verbatim_text AS snippet,
          d.term AS label,
          0 AS rank,
          NULL AS classification,
          NULL AS severity,
          d.term AS "highlightText"
        FROM definitions d
        JOIN regulatory_documents rd ON rd.id = d.document_id
        WHERE rd.state = ${normalizeState(state)}
          AND d.verbatim_text ILIKE ${'%' + query + '%'}
        LIMIT 20
      )
    `);

    return results.rows as unknown as CommentaryHit[];
  }

  /**
   * Returns the distinct hierarchy levels and section types for a given state,
   * ordered by frequency (most common first). Used to populate filter dropdowns
   * with only the options that exist in the current state's corpus.
   */
  async getFilterOptions(state: StateCode): Promise<SearchFilterOptions> {
    const [levelResult, sectionResult] = await Promise.all([
      this.db.execute(sql`
        SELECT hierarchy_level AS value, count(*)::int AS cnt
        FROM regulatory_documents
        WHERE state = ${normalizeState(state)}
          AND hierarchy_level IS NOT NULL
          AND hierarchy_level != ''
        GROUP BY hierarchy_level
        ORDER BY count(*) DESC
      `),
      this.db.execute(sql`
        SELECT section_type AS value, count(*)::int AS cnt
        FROM regulatory_documents
        WHERE state = ${normalizeState(state)}
          AND section_type IS NOT NULL
          AND section_type != ''
        GROUP BY section_type
        HAVING count(*) >= 50
        ORDER BY count(*) DESC
      `),
    ]);

    return {
      hierarchyLevels: (levelResult.rows as { value: string }[]).map(r => r.value),
      sectionTypes: (sectionResult.rows as { value: string }[]).map(r => r.value),
    };
  }
}
