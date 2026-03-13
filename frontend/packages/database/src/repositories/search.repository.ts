import { sql, type SQL } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { JurisdictionCode, normalizeJurisdiction } from '../schema/constants';
import { shouldExcludeStatutes, shouldExcludeRegulations, shouldExcludeGuidance, shouldSkipAnalyses } from './search-filters';

// ============================================
// Issue system filter helpers
// ============================================

/** @internal Exported for testing only. */
export function sqlTextArray(values: string[]): SQL {
  return sql`ARRAY[${sql.join(values.map(v => sql`${v}`), sql`, `)}]::text[]`;
}

/** @internal Exported for testing only. */
export function buildSeverityCondition(severities: string[], alias: string): SQL {
  const conds: SQL[] = [];
  if (severities.includes('high')) conds.push(sql.raw(`${alias}.severity >= 7`));
  if (severities.includes('medium')) conds.push(sql.raw(`(${alias}.severity >= 4 AND ${alias}.severity < 7)`));
  if (severities.includes('low')) conds.push(sql.raw(`(${alias}.severity >= 1 AND ${alias}.severity < 4)`));
  if (conds.length === 0) return sql``;
  return sql`AND (${sql.join(conds, sql` OR `)})`;
}

/** @internal Exported for testing only. */
export function buildComplianceExists(
  docCol: string,
  classification?: string | null,
  issueTypes?: string[] | null,
  issueSeverities?: string[] | null,
  isGuidance = false,
): SQL {
  const classFilter = classification
    ? sql`AND cia_f.tier2_classification = ${classification}`
    : sql``;
  const typeFilter = issueTypes?.length
    ? sql`AND cia_f.issue_type = ANY(${sqlTextArray(issueTypes)})`
    : sql``;
  const sevFilter = issueSeverities?.length
    ? buildSeverityCondition(issueSeverities, 'cia_f')
    : sql``;
  const fkCol = isGuidance ? 'guidance_document_id' : 'document_id';
  return sql`EXISTS (
    SELECT 1 FROM compliance_issue_analyses cia_f
    WHERE cia_f.${sql.raw(fkCol)} = ${sql.raw(docCol)}
      AND cia_f.requirement_found = true
      ${classFilter} ${typeFilter} ${sevFilter}
  )`;
}

/** @internal Exported for testing only. */
export function buildJenaiExists(
  docCol: string,
  issueCategories?: string[] | null,
  issueSeverities?: string[] | null,
  isGuidance = false,
): SQL {
  const catFilter = issueCategories?.length
    ? sql`AND ji_f.category = ANY(${sqlTextArray(issueCategories)})`
    : sql``;
  const sevFilter = issueSeverities?.length
    ? buildSeverityCondition(issueSeverities, 'ji_f')
    : sql``;
  const joinCol = isGuidance ? 'ja_f.guidance_document_id' : 'ja_f.document_id';
  return sql`EXISTS (
    SELECT 1 FROM jenai_issues ji_f
    JOIN jenai_analyses ja_f ON ja_f.id = ji_f.analysis_id
    WHERE ${sql.raw(joinCol)} = ${sql.raw(docCol)}
      ${catFilter} ${sevFilter}
  )`;
}

/** @internal Exported for testing only. */
export function buildIssueFilter(
  docCol: string,
  issueSystem?: string | null,
  classification?: string | null,
  issueTypes?: string[] | null,
  issueCategories?: string[] | null,
  issueSeverities?: string[] | null,
  isGuidance = false,
): SQL {
  if (!issueSystem) return sql``;

  switch (issueSystem) {
    case 'compliance':
      return sql`AND ${buildComplianceExists(docCol, classification, issueTypes, issueSeverities, isGuidance)}`;
    case 'jenai':
      return sql`AND ${buildJenaiExists(docCol, issueCategories, issueSeverities, isGuidance)}`;
    case 'any': {
      const comp = issueSeverities?.length
        ? buildComplianceExists(docCol, classification, issueTypes, issueSeverities, isGuidance)
        : buildComplianceExists(docCol, null, null, null, isGuidance);
      const jenai = issueSeverities?.length
        ? buildJenaiExists(docCol, issueCategories, issueSeverities, isGuidance)
        : buildJenaiExists(docCol, null, null, isGuidance);
      return sql`AND (${comp} OR ${jenai})`;
    }
    case 'none':
      return sql`AND NOT ${buildComplianceExists(docCol, null, null, null, isGuidance)} AND NOT ${buildJenaiExists(docCol, null, null, isGuidance)}`;
    default:
      return sql``;
  }
}

// ============================================
// Types
// ============================================

export interface SearchResultItem {
  id: number;
  type: 'regulation' | 'statute' | 'guidance';
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
  type: 'analysis' | 'definition' | 'jenai_issue';
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
  jurisdiction: JurisdictionCode;
  query: string;
  page?: number;
  pageSize?: number;
  sectionType?: string | null;
  hierarchyLevel?: string | null;
  parentPath?: string | null;
  issueSystem?: string | null;
  issueTypes?: string[] | null;
  issueCategories?: string[] | null;
  issueSeverities?: string[] | null;
  classification?: string | null;
  docType?: string | null;
}

// ============================================
// Repository
// ============================================

export class SearchRepository extends BaseRepository {
  async search(options: SearchOptions): Promise<SearchResults> {
    const {
      jurisdiction,
      query,
      page = 1,
      pageSize = 20,
      sectionType,
      hierarchyLevel,
      parentPath,
      issueSystem,
      issueTypes,
      issueCategories,
      issueSeverities,
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

    // Issue system filter for regulations (document_id)
    const regIssueFilter = buildIssueFilter('rd.id', issueSystem, classification, issueTypes, issueCategories, issueSeverities);
    // Issue system filter for guidance (guidance_document_id)
    const guidanceIssueFilter = buildIssueFilter('gd.id', issueSystem, classification, issueTypes, issueCategories, issueSeverities, true);

    // Document type filter — exclude entire branch when filtering to the other type.
    // Also exclude statutes when regulation-specific filters are active
    // (statutes have no section_type, hierarchy_level, or analyses).
    const excludeRegulations = shouldExcludeRegulations({ docType });
    const excludeStatutes = shouldExcludeStatutes({ docType, sectionType, hierarchyLevel, issueSystem, classification });
    const excludeGuidance = shouldExcludeGuidance({ docType, sectionType, hierarchyLevel, issueSystem, classification });

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
        WHERE rd.jurisdiction =${normalizeJurisdiction(jurisdiction)}
          AND rd.search_vector @@ sq.q
          ${excludeRegulations ? sql`AND false` : sql``}
          ${regSectionTypeFilter}
          ${regHierarchyLevelFilter}
          ${regParentPathFilter}
          ${regIssueFilter}

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
        WHERE s.jurisdiction =${normalizeJurisdiction(jurisdiction)}
          AND s.search_vector @@ sq.q
          ${excludeStatutes ? sql`AND false` : sql``}

        UNION ALL

        SELECT
          gd.id,
          'guidance' AS type,
          gd.title,
          gd.canonical_ref AS "citation",
          NULL AS "hierarchyPath",
          ts_headline('english', coalesce(gd.content, gd.title, ''), sq.q,
            'MaxFragments=2, MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
          ) AS snippet,
          ts_rank(gd.search_vector, sq.q, 32) AS rank,
          gd.policy_category AS "sectionType",
          0 AS "issueCount",
          0 AS "burdensomeCount",
          0 AS "justifiedCount",
          NULL AS "maxSeverity",
          false AS "hasFederalMandate",
          0 AS "easyCleanupCount"
        FROM guidance_documents gd
        CROSS JOIN search_query sq
        WHERE gd.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
          AND gd.search_vector @@ sq.q
          ${excludeGuidance ? sql`AND false` : sql``}
          ${guidanceIssueFilter}
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
          WHERE rd.jurisdiction =${normalizeJurisdiction(jurisdiction)}
            AND rd.search_vector @@ sq.q
            ${excludeRegulations ? sql`AND false` : sql``}
            ${regSectionTypeFilter}
            ${regHierarchyLevelFilter}
            ${regParentPathFilter}
            ${regIssueFilter}
        ) + (
          SELECT count(*)::int FROM statutes s, search_query sq
          WHERE s.jurisdiction =${normalizeJurisdiction(jurisdiction)}
            AND s.search_vector @@ sq.q
            ${excludeStatutes ? sql`AND false` : sql``}
        ) + (
          SELECT count(*)::int FROM guidance_documents gd, search_query sq
          WHERE gd.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
            AND gd.search_vector @@ sq.q
            ${excludeGuidance ? sql`AND false` : sql``}
            ${guidanceIssueFilter}
        ) AS total
    `);

    const total = Number((countResult.rows[0] as unknown as { total: number }).total) || 0;
    const items = results.rows as unknown as SearchResultItem[];

    // Commentary sidebar query (analysis + definition + jenai hits, filtered to match active filters)
    const commentary = await this.searchCommentary(jurisdiction, query, {
      classification,
      issueSystem,
      issueTypes,
      issueCategories,
      issueSeverities,
    });

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
    jurisdiction: JurisdictionCode,
    query: string,
    filters?: {
      classification?: string | null;
      issueSystem?: string | null;
      issueTypes?: string[] | null;
      issueCategories?: string[] | null;
      issueSeverities?: string[] | null;
    },
  ): Promise<CommentaryHit[]> {
    // Compliance sub-filters
    const classificationFilter = filters?.classification
      ? sql`AND cia.tier2_classification = ${filters.classification}`
      : sql``;
    const issueTypeFilter = filters?.issueTypes?.length
      ? sql`AND cia.issue_type = ANY(${sqlTextArray(filters.issueTypes)})`
      : sql``;
    const compSevFilter = filters?.issueSeverities?.length
      ? buildSeverityCondition(filters.issueSeverities, 'cia')
      : sql``;

    // JenAI sub-filters
    const categoryFilter = filters?.issueCategories?.length
      ? sql`AND ji.category = ANY(${sqlTextArray(filters.issueCategories)})`
      : sql``;
    const jenaiSevFilter = filters?.issueSeverities?.length
      ? buildSeverityCondition(filters.issueSeverities, 'ji')
      : sql``;

    // Gate branches by issueSystem
    const skipCompliance = shouldSkipAnalyses(filters?.issueSystem); // true for 'none' and 'jenai'
    const skipJenai = filters?.issueSystem === 'none' || filters?.issueSystem === 'compliance';

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
        WHERE rd.jurisdiction =${normalizeJurisdiction(jurisdiction)}
          AND cia.search_vector @@ sq.q
          ${classificationFilter}
          ${issueTypeFilter}
          ${compSevFilter}
          ${skipCompliance ? sql`AND false` : sql``}
        ORDER BY rank DESC
        LIMIT 30
      )
      UNION ALL
      (
        SELECT
          ji.id,
          'jenai_issue' AS type,
          coalesce(ji.document_id, ji.guidance_document_id)::int AS "documentId",
          coalesce(rd.title, gd.title) AS "documentTitle",
          coalesce(rd.citation, gd.canonical_ref) AS "documentCitation",
          left(ji.explanation, 200) AS snippet,
          ji.category AS label,
          0 AS rank,
          NULL AS classification,
          ji.severity,
          NULL AS "highlightText"
        FROM jenai_issues ji
        JOIN jenai_analyses ja ON ja.id = ji.analysis_id
        LEFT JOIN regulatory_documents rd ON ji.document_id = rd.id
        LEFT JOIN guidance_documents gd ON ji.guidance_document_id = gd.id
        WHERE ja.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
          AND ji.explanation ILIKE ${'%' + query + '%'}
          ${categoryFilter}
          ${jenaiSevFilter}
          ${skipJenai ? sql`AND false` : sql``}
        LIMIT 20
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
        WHERE rd.jurisdiction =${normalizeJurisdiction(jurisdiction)}
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
  async getFilterOptions(jurisdiction: JurisdictionCode): Promise<SearchFilterOptions> {
    const [levelResult, sectionResult] = await Promise.all([
      this.db.execute(sql`
        SELECT hierarchy_level AS value, count(*)::int AS cnt
        FROM regulatory_documents
        WHERE jurisdiction =${normalizeJurisdiction(jurisdiction)}
          AND hierarchy_level IS NOT NULL
          AND hierarchy_level != ''
        GROUP BY hierarchy_level
        ORDER BY count(*) DESC
      `),
      this.db.execute(sql`
        SELECT section_type AS value, count(*)::int AS cnt
        FROM regulatory_documents
        WHERE jurisdiction =${normalizeJurisdiction(jurisdiction)}
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
