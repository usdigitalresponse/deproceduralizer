import { sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { normalizeJurisdiction } from '../schema/constants';
import type { JurisdictionCode } from '../schema/constants';
import type {
  TagOverviewStats,
  TagCooccurrenceResult,
  TagNetworkResult,
  TagNetworkOptions,
  TagFlowResult,
  TagFlowLink,
  TagDetailResult,
  TagDomainCount,
  TagReadabilityCrosscuts,
  TagReadabilityRow,
  TagValue,
  TagNode,
  TagEdge,
  SimilarTag,
} from './tags.types';

// ---------------------------------------------------------------------------
// Tag field registry
//
// IMPORTANT: `field` keys MUST match the frontend constants in
// `apps/web/src/lib/constants/tags.ts` — prefixed keys like
// `reg_section_type`, `guid_keywords`, `barrier_category`, etc.
// ---------------------------------------------------------------------------

type FieldKind = 'scalar' | 'array' | 'boolean';

interface TagFieldDef {
  domain: string;
  field: string;
  column: string;
  table: string;
  kind: FieldKind;
  /** SQL fragment to join to regulatory_documents for jurisdiction filter.
   *  `null` means the table has its own `jurisdiction` column. */
  jurisdictionJoin: string | null;
  /** Column that links rows back to a document (for co-occurrence joins). */
  documentIdColumn: string;
  /** Which document table this links to: 'regulatory_documents' or 'guidance_documents' */
  documentTable: string;
}

const TAG_FIELDS: TagFieldDef[] = [
  // --- regulation (regulatory_documents) ---
  { domain: 'regulation', field: 'reg_section_type', column: 'section_type', table: 'regulatory_documents', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'regulatory_documents' },
  { domain: 'regulation', field: 'reg_keywords', column: 'keywords', table: 'regulatory_documents', kind: 'array', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'regulatory_documents' },
  { domain: 'regulation', field: 'reg_applies_to', column: 'applies_to', table: 'regulatory_documents', kind: 'array', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'regulatory_documents' },
  { domain: 'regulation', field: 'reg_has_form', column: 'has_form', table: 'regulatory_documents', kind: 'boolean', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'regulatory_documents' },
  { domain: 'regulation', field: 'reg_has_ibr', column: 'has_ibr', table: 'regulatory_documents', kind: 'boolean', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'regulatory_documents' },

  // --- guidance (guidance_documents) ---
  { domain: 'guidance', field: 'guid_section_type', column: 'section_type', table: 'guidance_documents', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'guid_keywords', column: 'keywords', table: 'guidance_documents', kind: 'array', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'guid_applies_to', column: 'applies_to', table: 'guidance_documents', kind: 'array', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'guid_has_form', column: 'has_form', table: 'guidance_documents', kind: 'boolean', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'guid_has_ibr', column: 'has_ibr', table: 'guidance_documents', kind: 'boolean', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'is_attachment', column: 'is_attachment', table: 'guidance_documents', kind: 'boolean', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'policy_category', column: 'policy_category', table: 'guidance_documents', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'target_audience', column: 'target_audience', table: 'guidance_documents', kind: 'array', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'audience_direction', column: 'audience_direction', table: 'guidance_documents', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },
  { domain: 'guidance', field: 'audience_expertise', column: 'audience_expertise', table: 'guidance_documents', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'id', documentTable: 'guidance_documents' },

  // --- compliance (compliance_issue_analyses / compliance_issues) ---
  { domain: 'compliance', field: 'issue_type', column: 'issue_type', table: 'compliance_issue_analyses', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
  { domain: 'compliance', field: 'tier_classification', column: 'tier2_classification', table: 'compliance_issue_analyses', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },

  // --- barriers (barrier_issues) ---
  { domain: 'barriers', field: 'barrier_category', column: 'category', table: 'barrier_issues', kind: 'scalar', jurisdictionJoin: 'JOIN regulatory_documents rd ON ji.document_id = rd.id', documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
  { domain: 'barriers', field: 'barrier_tags', column: 'tags', table: 'barrier_issues', kind: 'array', jurisdictionJoin: 'JOIN regulatory_documents rd ON ji.document_id = rd.id', documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },

  // --- fines (fines_fees_penalties) ---
  { domain: 'fines', field: 'penalty_type', column: 'penalty_type', table: 'fines_fees_penalties', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
  { domain: 'fines', field: 'who_pays_normalized', column: 'who_pays_normalized', table: 'fines_fees_penalties', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
  { domain: 'fines', field: 'activity_category', column: 'activity_category', table: 'fines_fees_penalties', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
  { domain: 'fines', field: 'estimated_annual_payers', column: 'estimated_annual_payers', table: 'fines_fees_penalties', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
  { domain: 'fines', field: 'jurisdiction_level', column: 'jurisdiction_level', table: 'fines_fees_penalties', kind: 'scalar', jurisdictionJoin: null, documentIdColumn: 'document_id', documentTable: 'regulatory_documents' },
];

/** Look up a field definition by its field key. */
function findField(field: string): TagFieldDef | undefined {
  return TAG_FIELDS.find((f) => f.field === field);
}

/** Fields where fuzzy (trigram) similarity makes sense. */
const FREE_TEXT_FIELDS = new Set([
  'reg_keywords',
  'reg_applies_to',
  'guid_keywords',
  'guid_applies_to',
  'barrier_tags',
  'target_audience',
]);

// ---------------------------------------------------------------------------
// Guidance-only jurisdiction filter
// ---------------------------------------------------------------------------

/**
 * guidance_documents doesn't have a `jurisdiction` column — all guidance
 * is NY-only at this time. We approximate by returning TRUE when the
 * requested jurisdiction is NY (matching all guidance rows) and FALSE
 * otherwise, effectively filtering guidance out for NJ/NYC.
 */
function guidanceJurisdictionMatches(jurisdictionUpper: string): boolean {
  return jurisdictionUpper === 'NY';
}

// ---------------------------------------------------------------------------
// Helper: build the jurisdiction WHERE clause for a table alias
// ---------------------------------------------------------------------------

function jurisdictionClause(
  def: TagFieldDef,
  alias: string,
  jurisdictionUpper: string,
): string {
  // guidance_documents don't have jurisdiction column
  if (def.table === 'guidance_documents') {
    // We filter in application layer; always include all guidance for NY
    return guidanceJurisdictionMatches(jurisdictionUpper) ? '1=1' : '1=0';
  }

  // barrier_issues need a join to regulatory_documents for jurisdiction
  if (def.jurisdictionJoin) {
    return `rd.jurisdiction = '${jurisdictionUpper}'`;
  }

  return `${alias}.jurisdiction = '${jurisdictionUpper}'`;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

/**
 * Repository for tag analytics queries.
 *
 * All methods use raw SQL via `this.db.execute(sql\`...\`)` to build
 * UNION ALL / CTE queries across multiple tag tables.
 */
export class TagsRepository extends BaseRepository {

  // =========================================================================
  // 1. getTagOverview
  // =========================================================================

  async getTagOverview(jurisdiction: JurisdictionCode): Promise<TagOverviewStats> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    // Build UNION ALL sub-selects for every tag field
    const unionParts: string[] = [];

    for (const def of TAG_FIELDS) {
      // Skip boolean fields — "true"/"false" values pollute the tag overview
      // (e.g., "false" for has_ibr becomes the "most common tag")
      if (def.kind === 'boolean') continue;

      const alias = def.table === 'barrier_issues' ? 'ji' : 't';
      const fromClause = def.jurisdictionJoin
        ? `${def.table} ${alias} ${def.jurisdictionJoin}`
        : `${def.table} ${alias}`;
      const jWhere = jurisdictionClause(def, alias, jurisdictionUpper);

      if (def.kind === 'scalar') {
        unionParts.push(`
          SELECT
            '${def.domain}' AS domain,
            '${def.field}' AS field,
            ${alias}.${def.column} AS value,
            LOWER(TRIM(${alias}.${def.column}::text)) AS normalized_value
          FROM ${fromClause}
          WHERE ${jWhere}
            AND ${alias}.${def.column} IS NOT NULL
        `);
      } else if (def.kind === 'array') {
        unionParts.push(`
          SELECT
            '${def.domain}' AS domain,
            '${def.field}' AS field,
            kw AS value,
            LOWER(TRIM(kw)) AS normalized_value
          FROM ${fromClause},
               LATERAL unnest(${alias}.${def.column}) AS kw
          WHERE ${jWhere}
            AND array_length(${alias}.${def.column}, 1) > 0
        `);
      } else {
        // boolean
        unionParts.push(`
          SELECT
            '${def.domain}' AS domain,
            '${def.field}' AS field,
            CASE WHEN ${alias}.${def.column} THEN 'true' ELSE 'false' END AS value,
            CASE WHEN ${alias}.${def.column} THEN 'true' ELSE 'false' END AS normalized_value
          FROM ${fromClause}
          WHERE ${jWhere}
            AND ${alias}.${def.column} IS NOT NULL
        `);
      }
    }

    const unionQuery = unionParts.join('\nUNION ALL\n');

    const results = await this.db.execute(sql.raw(`
      WITH all_tags AS (
        ${unionQuery}
      ),
      grouped AS (
        SELECT
          domain,
          field,
          normalized_value,
          MIN(value) AS display_value,
          COUNT(*)::int AS cnt
        FROM all_tags
        GROUP BY domain, field, normalized_value
      ),
      stats AS (
        SELECT
          COUNT(DISTINCT field || ':' || normalized_value)::int AS total_unique,
          SUM(cnt)::int AS total_count
        FROM grouped
      ),
      domain_stats AS (
        SELECT domain, SUM(cnt)::int AS domain_count
        FROM grouped
        GROUP BY domain
        ORDER BY domain_count DESC
      ),
      top_values AS (
        SELECT domain, field, display_value AS value, normalized_value AS "normalizedValue", cnt AS count
        FROM grouped
        ORDER BY cnt DESC
        LIMIT 500
      )
      SELECT
        'values' AS _type,
        domain, field, value, "normalizedValue", count,
        NULL::int AS total_unique, NULL::int AS total_count, NULL::int AS domain_count
      FROM top_values
      UNION ALL
      SELECT
        'stats' AS _type,
        NULL, NULL, NULL, NULL, NULL,
        total_unique, total_count, NULL
      FROM stats
      UNION ALL
      SELECT
        'domain_stats' AS _type,
        domain, NULL, NULL, NULL, NULL,
        NULL, NULL, domain_count
      FROM domain_stats
    `));

    const allRows = results.rows as unknown as Array<Record<string, unknown>>;

    // Parse the three result types from the UNION ALL
    const valueRows = allRows.filter((r) => r._type === 'values');
    const statsRow = allRows.find((r) => r._type === 'stats');
    const domainRows = allRows.filter((r) => r._type === 'domain_stats');

    const tagValues: TagValue[] = valueRows.map((r) => ({
      domain: r.domain as string,
      field: r.field as string,
      value: r.value as string,
      normalizedValue: r.normalizedValue as string,
      count: Number(r.count),
    }));

    const totalUniqueValues = Number(statsRow?.total_unique ?? 0);
    const mostCommonTag = tagValues.length > 0 ? tagValues[0] : undefined;

    const tagsByDomain: TagOverviewStats['tagsByDomain'] = domainRows
      .map((r) => ({ domain: r.domain as string, count: Number(r.domain_count), samples: [] }))
      .sort((a, b) => b.count - a.count);

    const domainWithMostTags = tagsByDomain.length > 0 ? tagsByDomain[0].domain : undefined;

    // Fuzzy cluster count from the top 500 values (approximation)
    const normalizedCounts = new Map<string, Set<string>>();
    for (const r of valueRows) {
      const key = `${r.field}:${r.normalizedValue}`;
      if (!normalizedCounts.has(key)) normalizedCounts.set(key, new Set());
      normalizedCounts.get(key)!.add(r.value as string);
    }
    let fuzzyClusterCount = 0;
    for (const vals of normalizedCounts.values()) {
      if (vals.size > 1) fuzzyClusterCount++;
    }

    return {
      totalUniqueValues,
      mostCommonTag,
      domainWithMostTags,
      fuzzyClusterCount,
      tagsByDomain,
      tagValues,
    };
  }

  // =========================================================================
  // 2. getTagDetail
  // =========================================================================

  async getTagDetail(
    jurisdiction: JurisdictionCode,
    field: string,
    value: string,
    contextDocumentId?: number,
  ): Promise<TagDetailResult> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);
    const lowerValue = value.toLowerCase().trim();

    // Find all field definitions matching this field key (may span multiple domains)
    const matchingDefs = TAG_FIELDS.filter((f) => f.field === field);

    if (matchingDefs.length === 0) {
      return { field, value, totalCount: 0, domainCounts: [], relatedTags: [], similarTags: [] };
    }

    let totalCount = 0;
    const domainCounts: TagDomainCount[] = [];

    for (const def of matchingDefs) {
      const alias = def.table === 'barrier_issues' ? 'ji' : 't';
      const fromClause = def.jurisdictionJoin
        ? `${def.table} ${alias} ${def.jurisdictionJoin}`
        : `${def.table} ${alias}`;
      const jWhere = jurisdictionClause(def, alias, jurisdictionUpper);

      let cnt: number;
      if (def.kind === 'scalar') {
        const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS cnt
          FROM ${sql.raw(fromClause)}
          WHERE ${sql.raw(jWhere)}
            AND LOWER(TRIM(${sql.raw(alias)}.${sql.raw(def.column)}::text)) = ${lowerValue}`);
        cnt = Number((countResult.rows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
      } else if (def.kind === 'array') {
        const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS cnt
          FROM ${sql.raw(fromClause)},
               LATERAL unnest(${sql.raw(alias)}.${sql.raw(def.column)}) AS kw
          WHERE ${sql.raw(jWhere)}
            AND LOWER(TRIM(kw)) = ${lowerValue}`);
        cnt = Number((countResult.rows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
      } else {
        const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS cnt
          FROM ${sql.raw(fromClause)}
          WHERE ${sql.raw(jWhere)}
            AND ${sql.raw(alias)}.${sql.raw(def.column)} IS NOT NULL
            AND (CASE WHEN ${sql.raw(alias)}.${sql.raw(def.column)} THEN 'true' ELSE 'false' END) = ${lowerValue}`);
        cnt = Number((countResult.rows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
      }

      if (cnt === 0) continue;
      totalCount += cnt;

      // Get 3 sample documents
      let sampleResult;
      if (def.table === def.documentTable) {
        // Same table (regulatory_documents or guidance_documents)
        if (def.kind === 'scalar') {
          sampleResult = await this.db.execute(sql`SELECT ${sql.raw(alias)}.id, ${sql.raw(alias)}.title AS title, ${sql.raw(alias)}.url AS url
            FROM ${sql.raw(fromClause)}
            WHERE ${sql.raw(jWhere)}
              AND LOWER(TRIM(${sql.raw(alias)}.${sql.raw(def.column)}::text)) = ${lowerValue}
            LIMIT 3`);
        } else if (def.kind === 'array') {
          sampleResult = await this.db.execute(sql`SELECT DISTINCT ${sql.raw(alias)}.id, ${sql.raw(alias)}.title AS title, ${sql.raw(alias)}.url AS url
            FROM ${sql.raw(fromClause)},
                 LATERAL unnest(${sql.raw(alias)}.${sql.raw(def.column)}) AS kw
            WHERE ${sql.raw(jWhere)}
              AND LOWER(TRIM(kw)) = ${lowerValue}
            LIMIT 3`);
        } else {
          sampleResult = await this.db.execute(sql`SELECT ${sql.raw(alias)}.id, ${sql.raw(alias)}.title AS title, ${sql.raw(alias)}.url AS url
            FROM ${sql.raw(fromClause)}
            WHERE ${sql.raw(jWhere)}
              AND ${sql.raw(alias)}.${sql.raw(def.column)} IS NOT NULL
              AND (CASE WHEN ${sql.raw(alias)}.${sql.raw(def.column)} THEN 'true' ELSE 'false' END) = ${lowerValue}
            LIMIT 3`);
        }
      } else {
        // Need to join to document table
        const docAlias = 'doc';
        if (def.kind === 'scalar') {
          sampleResult = await this.db.execute(sql`SELECT DISTINCT ${sql.raw(docAlias)}.id, ${sql.raw(docAlias)}.title AS title, ${sql.raw(docAlias)}.url AS url
            FROM ${sql.raw(fromClause)}
            JOIN ${sql.raw(def.documentTable)} ${sql.raw(docAlias)} ON ${sql.raw(alias)}.${sql.raw(def.documentIdColumn)} = ${sql.raw(docAlias)}.id
            WHERE ${sql.raw(jWhere)}
              AND LOWER(TRIM(${sql.raw(alias)}.${sql.raw(def.column)}::text)) = ${lowerValue}
            LIMIT 3`);
        } else if (def.kind === 'array') {
          sampleResult = await this.db.execute(sql`SELECT DISTINCT ${sql.raw(docAlias)}.id, ${sql.raw(docAlias)}.title AS title, ${sql.raw(docAlias)}.url AS url
            FROM ${sql.raw(fromClause)},
                 LATERAL unnest(${sql.raw(alias)}.${sql.raw(def.column)}) AS kw
            JOIN ${sql.raw(def.documentTable)} ${sql.raw(docAlias)} ON ${sql.raw(alias)}.${sql.raw(def.documentIdColumn)} = ${sql.raw(docAlias)}.id
            WHERE ${sql.raw(jWhere)}
              AND LOWER(TRIM(kw)) = ${lowerValue}
            LIMIT 3`);
        } else {
          sampleResult = await this.db.execute(sql`SELECT DISTINCT ${sql.raw(docAlias)}.id, ${sql.raw(docAlias)}.title AS title, ${sql.raw(docAlias)}.url AS url
            FROM ${sql.raw(fromClause)}
            JOIN ${sql.raw(def.documentTable)} ${sql.raw(docAlias)} ON ${sql.raw(alias)}.${sql.raw(def.documentIdColumn)} = ${sql.raw(docAlias)}.id
            WHERE ${sql.raw(jWhere)}
              AND ${sql.raw(alias)}.${sql.raw(def.column)} IS NOT NULL
              AND (CASE WHEN ${sql.raw(alias)}.${sql.raw(def.column)} THEN 'true' ELSE 'false' END) = ${lowerValue}
            LIMIT 3`);
        }
      }

      const samples = (sampleResult.rows as unknown as Array<{ id: number; title: string; url?: string }>)
        .map((s) => ({ id: Number(s.id), title: s.title, url: s.url ?? undefined }));

      domainCounts.push({ domain: def.domain, count: cnt, samples });
    }

    // Related tags: find other tags on the same documents
    const relatedTags: TagValue[] = [];

    // Get similar tags for free-text fields
    const similarTags = FREE_TEXT_FIELDS.has(field)
      ? await this.getSimilarTags(jurisdiction, field, value)
      : [];

    // Context count (if a specific document was provided)
    let contextCount: number | undefined;
    if (contextDocumentId != null) {
      const def = matchingDefs[0];
      if (def) {
        const alias = def.table === 'barrier_issues' ? 'ji' : 't';
        const fromClause = def.jurisdictionJoin
          ? `${def.table} ${alias} ${def.jurisdictionJoin}`
          : `${def.table} ${alias}`;

        const docCol = def.table === def.documentTable ? `${alias}.id` : `${alias}.${def.documentIdColumn}`;

        let ctxResult;
        if (def.kind === 'scalar') {
          ctxResult = await this.db.execute(sql`SELECT COUNT(*)::int AS cnt
            FROM ${sql.raw(fromClause)}
            WHERE ${sql.raw(docCol)} = ${contextDocumentId}
              AND LOWER(TRIM(${sql.raw(alias)}.${sql.raw(def.column)}::text)) = ${lowerValue}`);
        } else if (def.kind === 'array') {
          ctxResult = await this.db.execute(sql`SELECT COUNT(*)::int AS cnt
            FROM ${sql.raw(fromClause)},
                 LATERAL unnest(${sql.raw(alias)}.${sql.raw(def.column)}) AS kw
            WHERE ${sql.raw(docCol)} = ${contextDocumentId}
              AND LOWER(TRIM(kw)) = ${lowerValue}`);
        } else {
          ctxResult = await this.db.execute(sql`SELECT COUNT(*)::int AS cnt
            FROM ${sql.raw(fromClause)}
            WHERE ${sql.raw(docCol)} = ${contextDocumentId}
              AND ${sql.raw(alias)}.${sql.raw(def.column)} IS NOT NULL
              AND (CASE WHEN ${sql.raw(alias)}.${sql.raw(def.column)} THEN 'true' ELSE 'false' END) = ${lowerValue}`);
        }

        const ctxCnt = Number((ctxResult.rows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
        if (ctxCnt > 0) contextCount = ctxCnt;
      }
    }

    return {
      field,
      value,
      totalCount,
      domainCounts,
      relatedTags,
      similarTags,
      contextCount,
    };
  }

  // =========================================================================
  // 3. getSimilarTags
  // =========================================================================

  async getSimilarTags(
    jurisdiction: JurisdictionCode,
    field: string,
    value: string,
  ): Promise<SimilarTag[]> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);
    const target = value.toLowerCase().trim();

    // Find matching field definitions
    const matchingDefs = TAG_FIELDS.filter((f) => f.field === field);
    if (matchingDefs.length === 0) return [];

    // Build UNION ALL of all matching fields to get the set of distinct values
    const unionParts: string[] = [];
    for (const def of matchingDefs) {
      const alias = def.table === 'barrier_issues' ? 'ji' : 't';
      const fromClause = def.jurisdictionJoin
        ? `${def.table} ${alias} ${def.jurisdictionJoin}`
        : `${def.table} ${alias}`;
      const jWhere = jurisdictionClause(def, alias, jurisdictionUpper);

      if (def.kind === 'array') {
        unionParts.push(`
          SELECT LOWER(TRIM(kw)) AS normalized_value
          FROM ${fromClause},
               LATERAL unnest(${alias}.${def.column}) AS kw
          WHERE ${jWhere}
            AND array_length(${alias}.${def.column}, 1) > 0
        `);
      } else if (def.kind === 'scalar') {
        unionParts.push(`
          SELECT LOWER(TRIM(${alias}.${def.column}::text)) AS normalized_value
          FROM ${fromClause}
          WHERE ${jWhere}
            AND ${alias}.${def.column} IS NOT NULL
        `);
      }
      // booleans don't need fuzzy matching
    }

    if (unionParts.length === 0) return [];

    const unionQuery = unionParts.join('\nUNION ALL\n');

    // Use pg_trgm similarity function. pg_trgm extension must be enabled.
    // Build with parameterized `target` to prevent SQL injection.
    try {
      const results = await this.db.execute(sql`
        WITH vals AS (
          ${sql.raw(unionQuery)}
        ),
        grouped AS (
          SELECT normalized_value, COUNT(*)::int AS cnt
          FROM vals
          GROUP BY normalized_value
        )
        SELECT
          normalized_value AS value,
          cnt AS count,
          similarity(normalized_value, ${target}) AS similarity
        FROM grouped
        WHERE normalized_value != ${target}
          AND similarity(normalized_value, ${target}) > 0.3
        ORDER BY similarity DESC
        LIMIT 10
      `);
      return (results.rows as unknown as Array<{ value: string; count: number; similarity: number }>)
        .map((r) => ({
          value: r.value,
          count: Number(r.count),
          similarity: Number(r.similarity),
        }));
    } catch {
      // pg_trgm may not be available; return empty
      return [];
    }
  }

  // =========================================================================
  // 4. getTagCooccurrence
  // =========================================================================

  async getTagCooccurrence(
    jurisdiction: JurisdictionCode,
    fieldA: string,
    fieldB: string,
  ): Promise<TagCooccurrenceResult> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    const defA = findField(fieldA);
    const defB = findField(fieldB);

    if (!defA || !defB) {
      return { fieldA, fieldB, matrix: [], valuesA: [], valuesB: [] };
    }

    // Build the value extraction for each field
    const buildValueExpr = (
      def: TagFieldDef,
      alias: string,
    ): { selectExpr: string; fromExtra: string; whereExtra: string } => {
      if (def.kind === 'scalar') {
        return {
          selectExpr: `LOWER(TRIM(${alias}.${def.column}::text))`,
          fromExtra: '',
          whereExtra: `${alias}.${def.column} IS NOT NULL`,
        };
      } else if (def.kind === 'array') {
        const unnestAlias = `${alias}_kw`;
        return {
          selectExpr: `LOWER(TRIM(${unnestAlias}))`,
          fromExtra: `, LATERAL unnest(${alias}.${def.column}) AS ${unnestAlias}`,
          whereExtra: `array_length(${alias}.${def.column}, 1) > 0`,
        };
      } else {
        return {
          selectExpr: `CASE WHEN ${alias}.${def.column} THEN 'true' ELSE 'false' END`,
          fromExtra: '',
          whereExtra: `${alias}.${def.column} IS NOT NULL`,
        };
      }
    };

    let queryStr: string;

    // Same table — just use one FROM
    if (defA.table === defB.table) {
      const alias = defA.table === 'barrier_issues' ? 'ji' : 't';
      const fromClause = defA.jurisdictionJoin
        ? `${defA.table} ${alias} ${defA.jurisdictionJoin}`
        : `${defA.table} ${alias}`;
      const jWhere = jurisdictionClause(defA, alias, jurisdictionUpper);

      const exprA = buildValueExpr(defA, alias);
      const exprB = buildValueExpr(defB, alias);

      queryStr = `
        SELECT
          ${exprA.selectExpr} AS value_a,
          ${exprB.selectExpr} AS value_b,
          COUNT(*)::int AS count
        FROM ${fromClause}
          ${exprA.fromExtra}
          ${exprB.fromExtra}
        WHERE ${jWhere}
          AND ${exprA.whereExtra}
          AND ${exprB.whereExtra}
        GROUP BY value_a, value_b
        ORDER BY count DESC
        LIMIT 500
      `;
    } else {
      // Cross-table: join through document_id
      const aliasA = 'a';
      const aliasB = 'b';

      const fromA = defA.jurisdictionJoin
        ? `${defA.table} ${aliasA} ${defA.jurisdictionJoin.replace(/ji\./g, `${aliasA}.`)}`
        : `${defA.table} ${aliasA}`;

      const fromB = defB.jurisdictionJoin
        ? `${defB.table} ${aliasB} ${defB.jurisdictionJoin.replace(/ji\./g, `${aliasB}.`).replace(/ rd /g, ' rd2 ').replace(/rd\./g, 'rd2.')}`
        : `${defB.table} ${aliasB}`;

      const jWhereA = jurisdictionClause(defA, aliasA, jurisdictionUpper);

      const exprA = buildValueExpr(defA, aliasA);
      const exprB = buildValueExpr(defB, aliasB);

      // Determine the join key
      const docIdA = defA.table === defA.documentTable ? `${aliasA}.id` : `${aliasA}.${defA.documentIdColumn}`;
      const docIdB = defB.table === defB.documentTable ? `${aliasB}.id` : `${aliasB}.${defB.documentIdColumn}`;

      // Only join if they share the same document table
      if (defA.documentTable === defB.documentTable) {
        queryStr = `
          SELECT
            ${exprA.selectExpr} AS value_a,
            ${exprB.selectExpr} AS value_b,
            COUNT(*)::int AS count
          FROM ${fromA}
            ${exprA.fromExtra}
          JOIN ${fromB}
            ${exprB.fromExtra}
            ON ${docIdA} = ${docIdB}
          WHERE ${jWhereA}
            AND ${exprA.whereExtra}
            AND ${exprB.whereExtra}
          GROUP BY value_a, value_b
          ORDER BY count DESC
          LIMIT 500
        `;
      } else {
        // Different document tables — no co-occurrence possible
        return { fieldA, fieldB, matrix: [], valuesA: [], valuesB: [] };
      }
    }

    const results = await this.db.execute(sql.raw(queryStr));
    const rows = results.rows as unknown as Array<{
      value_a: string;
      value_b: string;
      count: number;
    }>;

    const valuesASet = new Set<string>();
    const valuesBSet = new Set<string>();
    for (const r of rows) {
      valuesASet.add(r.value_a);
      valuesBSet.add(r.value_b);
    }

    return {
      fieldA,
      fieldB,
      matrix: rows.map((r) => ({
        valueA: r.value_a,
        valueB: r.value_b,
        count: Number(r.count),
      })),
      valuesA: Array.from(valuesASet),
      valuesB: Array.from(valuesBSet),
    };
  }

  // =========================================================================
  // 5. getTagNetwork
  // =========================================================================

  async getTagNetwork(
    jurisdiction: JurisdictionCode,
    options?: TagNetworkOptions,
  ): Promise<TagNetworkResult> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);
    const maxNodes = options?.maxNodes ?? 50;
    const minEdgeWeight = options?.minEdgeWeight ?? 2;
    const domainFilter = options?.domains;
    const fieldFilter = options?.fields;

    // Select which fields to include
    let fields = TAG_FIELDS;
    if (domainFilter && domainFilter.length > 0) {
      fields = fields.filter((f) => domainFilter.includes(f.domain));
    }
    if (fieldFilter && fieldFilter.length > 0) {
      fields = fields.filter((f) => fieldFilter.includes(f.field));
    }

    if (fields.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Step 1: Get top tag values as nodes
    const unionParts: string[] = [];
    for (const def of fields) {
      const alias = def.table === 'barrier_issues' ? 'ji' : 't';
      const fromClause = def.jurisdictionJoin
        ? `${def.table} ${alias} ${def.jurisdictionJoin}`
        : `${def.table} ${alias}`;
      const jWhere = jurisdictionClause(def, alias, jurisdictionUpper);

      if (def.kind === 'scalar') {
        unionParts.push(`
          SELECT
            '${def.domain}' AS domain,
            '${def.field}' AS field,
            LOWER(TRIM(${alias}.${def.column}::text)) AS value
          FROM ${fromClause}
          WHERE ${jWhere}
            AND ${alias}.${def.column} IS NOT NULL
        `);
      } else if (def.kind === 'array') {
        unionParts.push(`
          SELECT
            '${def.domain}' AS domain,
            '${def.field}' AS field,
            LOWER(TRIM(kw)) AS value
          FROM ${fromClause},
               LATERAL unnest(${alias}.${def.column}) AS kw
          WHERE ${jWhere}
            AND array_length(${alias}.${def.column}, 1) > 0
        `);
      } else {
        unionParts.push(`
          SELECT
            '${def.domain}' AS domain,
            '${def.field}' AS field,
            CASE WHEN ${alias}.${def.column} THEN 'true' ELSE 'false' END AS value
          FROM ${fromClause}
          WHERE ${jWhere}
            AND ${alias}.${def.column} IS NOT NULL
        `);
      }
    }

    const nodeQuery = `
      WITH all_tags AS (
        ${unionParts.join('\nUNION ALL\n')}
      )
      SELECT domain, field, value, COUNT(*)::int AS count
      FROM all_tags
      GROUP BY domain, field, value
      ORDER BY count DESC
      LIMIT ${maxNodes}
    `;

    const nodeResult = await this.db.execute(sql.raw(nodeQuery));
    const nodeRows = nodeResult.rows as unknown as Array<{
      domain: string;
      field: string;
      value: string;
      count: number;
    }>;

    const nodes: TagNode[] = nodeRows.map((r) => ({
      id: `${r.field}:${r.value}`,
      field: r.field,
      value: r.value,
      domain: r.domain,
      count: Number(r.count),
    }));

    if (nodes.length < 2) {
      return { nodes, edges: [] };
    }

    // Step 2: Build edges from co-occurrence between pairs of fields
    // For efficiency, only check edges between fields that appear in nodes
    const nodeFieldPairs = new Set(nodes.map((n) => n.field));
    const uniqueFields = Array.from(nodeFieldPairs);
    const edges: TagEdge[] = [];

    for (let i = 0; i < uniqueFields.length; i++) {
      for (let j = i; j < uniqueFields.length; j++) {
        const fA = uniqueFields[i];
        const fB = uniqueFields[j];

        // For same-field pairs within the same document, we can still find co-occurrence
        // (e.g., two keywords on the same document). Skip for now if same field.
        if (fA === fB) continue;

        try {
          const cooc = await this.getTagCooccurrence(jurisdiction, fA, fB);
          for (const cell of cooc.matrix) {
            if (cell.count < minEdgeWeight) continue;
            const sourceId = `${fA}:${cell.valueA}`;
            const targetId = `${fB}:${cell.valueB}`;
            // Only include edges between nodes that are in our set
            const sourceNode = nodes.find((n) => n.id === sourceId);
            const targetNode = nodes.find((n) => n.id === targetId);
            if (sourceNode && targetNode) {
              edges.push({ source: sourceId, target: targetId, weight: cell.count });
            }
          }
        } catch {
          // Skip pairs that can't co-occur (e.g., different document tables)
        }
      }
    }

    return { nodes, edges };
  }

  // =========================================================================
  // 6. getTagFlow
  // =========================================================================

  async getTagFlow(
    jurisdiction: JurisdictionCode,
    stages: string[],
  ): Promise<TagFlowResult> {
    if (stages.length < 2) {
      return { stages, nodes: [], links: [] };
    }

    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    // For each stage (field), build a CTE that extracts document_id + value
    const cteParts: string[] = [];
    const validStages: Array<{ field: string; cteName: string; def: TagFieldDef }> = [];

    for (let i = 0; i < stages.length; i++) {
      const field = stages[i];
      // Pick the first definition with regulatory_documents as documentTable for consistency
      const def = TAG_FIELDS.find(
        (f) => f.field === field && f.documentTable === 'regulatory_documents',
      ) ?? TAG_FIELDS.find((f) => f.field === field);

      if (!def) continue;

      const cteName = `stage_${i}`;
      const alias = def.table === 'barrier_issues' ? 'ji' : 't';
      const fromClause = def.jurisdictionJoin
        ? `${def.table} ${alias} ${def.jurisdictionJoin}`
        : `${def.table} ${alias}`;
      const jWhere = jurisdictionClause(def, alias, jurisdictionUpper);
      const docId = def.table === def.documentTable ? `${alias}.id` : `${alias}.${def.documentIdColumn}`;

      let selectExpr: string;
      let fromExtra = '';
      let whereExtra: string;

      if (def.kind === 'scalar') {
        selectExpr = `LOWER(TRIM(${alias}.${def.column}::text))`;
        whereExtra = `${alias}.${def.column} IS NOT NULL`;
      } else if (def.kind === 'array') {
        selectExpr = `LOWER(TRIM(kw))`;
        fromExtra = `, LATERAL unnest(${alias}.${def.column}) AS kw`;
        whereExtra = `array_length(${alias}.${def.column}, 1) > 0`;
      } else {
        selectExpr = `CASE WHEN ${alias}.${def.column} THEN 'true' ELSE 'false' END`;
        whereExtra = `${alias}.${def.column} IS NOT NULL`;
      }

      cteParts.push(`
        ${cteName} AS (
          SELECT ${docId} AS document_id, ${selectExpr} AS value
          FROM ${fromClause} ${fromExtra}
          WHERE ${jWhere} AND ${whereExtra}
        )
      `);

      validStages.push({ field, cteName, def });
    }

    if (validStages.length < 2) {
      return { stages, nodes: [], links: [] };
    }

    // Build link queries between consecutive stages
    const linkQueries: string[] = [];
    for (let i = 0; i < validStages.length - 1; i++) {
      const s1 = validStages[i];
      const s2 = validStages[i + 1];

      // Only join if they share the same document table
      if (s1.def.documentTable !== s2.def.documentTable) continue;

      linkQueries.push(`
        SELECT
          '${s1.field}' AS source_field,
          s1.value AS source_value,
          '${s2.field}' AS target_field,
          s2.value AS target_value,
          COUNT(*)::int AS weight
        FROM ${s1.cteName} s1
        JOIN ${s2.cteName} s2 ON s1.document_id = s2.document_id
        GROUP BY s1.value, s2.value
        HAVING COUNT(*) >= 1
      `);
    }

    if (linkQueries.length === 0) {
      return { stages, nodes: [], links: [] };
    }

    const fullQuery = `
      WITH ${cteParts.join(',\n')}
      ${linkQueries.join('\nUNION ALL\n')}
      ORDER BY weight DESC
      LIMIT 200
    `;

    const results = await this.db.execute(sql.raw(fullQuery));
    const rows = results.rows as unknown as Array<{
      source_field: string;
      source_value: string;
      target_field: string;
      target_value: string;
      weight: number;
    }>;

    const nodeSet = new Set<string>();
    const links: TagFlowLink[] = [];

    for (const r of rows) {
      const sourceNode = `${r.source_field}:${r.source_value}`;
      const targetNode = `${r.target_field}:${r.target_value}`;
      nodeSet.add(sourceNode);
      nodeSet.add(targetNode);
      links.push({ source: sourceNode, target: targetNode, value: Number(r.weight) });
    }

    return {
      stages,
      nodes: Array.from(nodeSet),
      links,
    };
  }

  // =========================================================================
  // 7. getTagReadabilityCrosscuts
  // =========================================================================

  async getTagReadabilityCrosscuts(
    jurisdiction: JurisdictionCode,
    field: string,
  ): Promise<TagReadabilityCrosscuts> {
    const jurisdictionUpper = normalizeJurisdiction(jurisdiction);

    // Only guidance_documents has readability metrics
    const def = TAG_FIELDS.find((f) => f.field === field && f.domain === 'guidance');
    if (!def) {
      return { field, rows: [] };
    }

    if (!guidanceJurisdictionMatches(jurisdictionUpper)) {
      return { field, rows: [] };
    }

    const alias = 't';
    let valueExpr: string;
    let fromExtra = '';
    let whereExtra: string;

    if (def.kind === 'scalar') {
      valueExpr = `LOWER(TRIM(${alias}.${def.column}::text))`;
      whereExtra = `${alias}.${def.column} IS NOT NULL`;
    } else if (def.kind === 'array') {
      valueExpr = `LOWER(TRIM(kw))`;
      fromExtra = `, LATERAL unnest(${alias}.${def.column}) AS kw`;
      whereExtra = `array_length(${alias}.${def.column}, 1) > 0`;
    } else {
      valueExpr = `CASE WHEN ${alias}.${def.column} THEN 'true' ELSE 'false' END`;
      whereExtra = `${alias}.${def.column} IS NOT NULL`;
    }

    const queryStr = `
      SELECT
        ${valueExpr} AS value,
        COUNT(*)::int AS count,
        COALESCE(AVG(${alias}.flesch_reading_ease), 0)::real AS avg_flesch_ease,
        COALESCE(AVG(${alias}.flesch_kincaid_grade), 0)::real AS avg_grade_level,
        COALESCE(AVG(${alias}.word_count), 0)::real AS avg_word_count,
        COALESCE(AVG(${alias}.sentence_count), 0)::real AS avg_sentence_count
      FROM guidance_documents ${alias} ${fromExtra}
      WHERE ${whereExtra}
        AND ${alias}.flesch_reading_ease IS NOT NULL
      GROUP BY ${valueExpr}
      ORDER BY count DESC
    `;

    const results = await this.db.execute(sql.raw(queryStr));
    const rows = (results.rows as unknown as Array<{
      value: string;
      count: number;
      avg_flesch_ease: number;
      avg_grade_level: number;
      avg_word_count: number;
      avg_sentence_count: number;
    }>).map((r): TagReadabilityRow => ({
      value: r.value,
      count: Number(r.count),
      avgFleschEase: Number(r.avg_flesch_ease),
      avgGradeLevel: Number(r.avg_grade_level),
      avgWordCount: Number(r.avg_word_count),
      avgSentenceCount: Number(r.avg_sentence_count),
    }));

    return { field, rows };
  }
}
