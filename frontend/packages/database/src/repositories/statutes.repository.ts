import { eq, ne, and, sql, isNull, isNotNull, ilike, or } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { statutes } from '../schema/statutes';
import { regulationStatuteLinks } from '../schema/regulation-statute-links';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { normalizeJurisdiction } from '../schema/constants';

/**
 * Statute node for hierarchy tree display
 */
export interface StatuteHierarchyNode {
  id: number;
  citation: string;
  title: string;
  jurisdiction: string;
  hierarchyLevel: string | null;
  parentId: number | null;
  childCount: number;
  linkedRegulationCount: number;
  enablingAuthorityCount: number;
  descendantLinkedRegulationCount: number;
  descendantEnablingAuthorityCount: number;
  hasContent: boolean;
}

/**
 * Statute with its linked regulations
 */
export interface StatuteWithLinks {
  id: number;
  citation: string;
  jurisdiction: string;
  title: string;
  content: string;
  hierarchyLevel: string | null;
  parentId: number | null;
  hierarchyPath: string | null;
  njsaTitle: string | null;
  njsaTitleName: string | null;
  njsaChapter: string | null;
  njsaSection: string | null;
  njsaSectionName: string | null;
  nyclsLawId: string | null;
  nyclsLawName: string | null;
  nyclsArticle: string | null;
  nyclsArticleName: string | null;
  nyclsSection: string | null;
  nyclsSectionName: string | null;
  regulationLinks: StatuteRegulationLink[];
}

/**
 * A regulation linked to a statute
 */
export interface StatuteRegulationLink {
  linkId: number;
  regulationId: number;
  citation: string;
  linkType: string;
  matchStatus: string;
  context: string | null;
  regulation: {
    id: number;
    title: string | null;
    hierarchyLevel: string | null;
    citation: string | null;
  };
}

/**
 * A statute linked from a regulation (for regulation detail page)
 */
export interface RegulationStatuteLinkWithStatute {
  linkId: number;
  statuteId: number | null;
  citation: string;
  linkType: string;
  matchStatus: string;
  context: string | null;
  originalCitation: string | null;
  statute: {
    id: number;
    title: string;
    citation: string;
    hierarchyLevel: string | null;
  } | null;
}

/**
 * Ancestor breadcrumb
 */
export interface StatuteAncestor {
  id: number;
  citation: string;
  title: string;
  hierarchyLevel: string | null;
}

/**
 * Stats for analytics tab
 */
export interface StatuteLinkStats {
  totalStatutes: number;
  linkedStatutes: number;
  totalLinks: number;
  byLinkType: Record<string, number>;
  byMatchStatus: Record<string, number>;
  regulationsWithLinks: number;
  totalRegulations: number;
}

export class StatutesRepository extends BaseRepository {
  /**
   * Get root-level statutes (parentId IS NULL) for a state, with aggregated counts
   */
  async getHierarchyRoots(jurisdiction: string): Promise<StatuteHierarchyNode[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const result = await this.db.execute<{
      id: number;
      citation: string;
      title: string;
      jurisdiction: string;
      hierarchy_level: string | null;
      parent_id: number | null;
      child_count: number;
      linked_regulation_count: number;
      enabling_authority_count: number;
      descendant_linked_regulation_count: number;
      descendant_enabling_authority_count: number;
      has_content: boolean;
    }>(sql`
      SELECT
        s.id,
        s.citation,
        s.title,
        s.jurisdiction,
        s.hierarchy_level,
        s.parent_id,
        (SELECT COUNT(*)::int FROM statutes c WHERE c.parent_id = s.id) as child_count,
        (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id) as linked_regulation_count,
        (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id AND rsl.link_type = 'enabling_authority') as enabling_authority_count,
        COALESCE(s.descendant_linked_regulation_count, 0)::int as descendant_linked_regulation_count,
        COALESCE(s.descendant_enabling_authority_count, 0)::int as descendant_enabling_authority_count,
        (s.content IS NOT NULL AND s.content != '') as has_content
      FROM statutes s
      WHERE s.jurisdiction = ${stateUpper}
        AND s.parent_id IS NULL
      ORDER BY
        natural_sort_num(COALESCE(s.njsa_title, s.nycls_law_id, s.citation)) NULLS LAST,
        natural_sort_alpha(COALESCE(s.njsa_title, s.nycls_law_id, s.citation)) NULLS LAST,
        s.title NULLS LAST
    `);

    return result.rows.map(this.mapHierarchyNode);
  }

  /**
   * Get children of a statute node, with aggregated counts
   */
  async getHierarchyChildren(parentId: number): Promise<StatuteHierarchyNode[]> {
    const result = await this.db.execute<{
      id: number;
      citation: string;
      title: string;
      jurisdiction: string;
      hierarchy_level: string | null;
      parent_id: number | null;
      child_count: number;
      linked_regulation_count: number;
      enabling_authority_count: number;
      descendant_linked_regulation_count: number;
      descendant_enabling_authority_count: number;
      has_content: boolean;
    }>(sql`
      SELECT
        s.id,
        s.citation,
        s.title,
        s.jurisdiction,
        s.hierarchy_level,
        s.parent_id,
        (SELECT COUNT(*)::int FROM statutes c WHERE c.parent_id = s.id) as child_count,
        (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id) as linked_regulation_count,
        (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id AND rsl.link_type = 'enabling_authority') as enabling_authority_count,
        COALESCE(s.descendant_linked_regulation_count, 0)::int as descendant_linked_regulation_count,
        COALESCE(s.descendant_enabling_authority_count, 0)::int as descendant_enabling_authority_count,
        (s.content IS NOT NULL AND s.content != '') as has_content
      FROM statutes s
      WHERE s.parent_id = ${parentId}
      ORDER BY
        natural_sort_num(COALESCE(s.njsa_section, s.njsa_chapter, s.nycls_section, s.nycls_article, s.citation)) NULLS LAST,
        natural_sort_alpha(COALESCE(s.njsa_section, s.njsa_chapter, s.nycls_section, s.nycls_article, s.citation)) NULLS LAST,
        s.title NULLS LAST
    `);

    return result.rows.map(this.mapHierarchyNode);
  }

  /**
   * Get a single statute by ID
   */
  async getById(id: number) {
    const result = await this.db
      .select()
      .from(statutes)
      .where(eq(statutes.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Get a statute by ID with its regulation links
   */
  async getByIdWithLinks(id: number): Promise<StatuteWithLinks | null> {
    const statute = await this.getById(id);
    if (!statute) return null;

    const links = await this.db
      .select({
        linkId: regulationStatuteLinks.id,
        regulationId: regulationStatuteLinks.regulationId,
        citation: regulationStatuteLinks.citation,
        linkType: regulationStatuteLinks.linkType,
        matchStatus: regulationStatuteLinks.matchStatus,
        context: regulationStatuteLinks.context,
        regulation: {
          id: regulatoryDocuments.id,
          title: regulatoryDocuments.title,
          hierarchyLevel: regulatoryDocuments.hierarchyLevel,
          citation: regulatoryDocuments.citation,
        },
      })
      .from(regulationStatuteLinks)
      .innerJoin(regulatoryDocuments, eq(regulationStatuteLinks.regulationId, regulatoryDocuments.id))
      .where(eq(regulationStatuteLinks.statuteId, id))
      .orderBy(regulationStatuteLinks.linkType, regulatoryDocuments.citation);

    return {
      id: statute.id,
      citation: statute.citation,
      jurisdiction: statute.jurisdiction,
      title: statute.title,
      content: statute.content,
      hierarchyLevel: statute.hierarchyLevel,
      parentId: statute.parentId,
      hierarchyPath: statute.hierarchyPath,
      njsaTitle: statute.njsaTitle,
      njsaTitleName: statute.njsaTitleName,
      njsaChapter: statute.njsaChapter,
      njsaSection: statute.njsaSection,
      njsaSectionName: statute.njsaSectionName,
      nyclsLawId: statute.nyclsLawId,
      nyclsLawName: statute.nyclsLawName,
      nyclsArticle: statute.nyclsArticle,
      nyclsArticleName: statute.nyclsArticleName,
      nyclsSection: statute.nyclsSection,
      nyclsSectionName: statute.nyclsSectionName,
      regulationLinks: links.map(l => ({
        linkId: l.linkId,
        regulationId: l.regulationId,
        citation: l.citation,
        linkType: l.linkType ?? 'reference',
        matchStatus: l.matchStatus ?? 'matched',
        context: l.context,
        regulation: l.regulation,
      })),
    };
  }

  /**
   * Get statute links for a regulation (for regulation detail page)
   */
  async getLinksForRegulation(regulationId: number): Promise<RegulationStatuteLinkWithStatute[]> {
    const result = await this.db
      .select({
        linkId: regulationStatuteLinks.id,
        statuteId: regulationStatuteLinks.statuteId,
        citation: regulationStatuteLinks.citation,
        linkType: regulationStatuteLinks.linkType,
        matchStatus: regulationStatuteLinks.matchStatus,
        context: regulationStatuteLinks.context,
        originalCitation: regulationStatuteLinks.originalCitation,
        statute: {
          id: statutes.id,
          title: statutes.title,
          citation: statutes.citation,
          hierarchyLevel: statutes.hierarchyLevel,
        },
      })
      .from(regulationStatuteLinks)
      .leftJoin(statutes, eq(regulationStatuteLinks.statuteId, statutes.id))
      .where(
        and(
          eq(regulationStatuteLinks.regulationId, regulationId),
          ne(regulationStatuteLinks.linkType, 'enabling_authority')
        )
      )
      .orderBy(regulationStatuteLinks.linkType, regulationStatuteLinks.citation);

    return result.map(r => ({
      linkId: r.linkId,
      statuteId: r.statuteId,
      citation: r.citation,
      linkType: r.linkType ?? 'reference',
      matchStatus: r.matchStatus ?? 'matched',
      context: r.context,
      originalCitation: r.originalCitation,
      statute: r.statute?.id ? {
        id: r.statute.id,
        title: r.statute.title,
        citation: r.statute.citation,
        hierarchyLevel: r.statute.hierarchyLevel,
      } : null,
    }));
  }

  /**
   * Get enabling authority links for a regulation
   */
  async getEnablingAuthority(regulationId: number): Promise<RegulationStatuteLinkWithStatute[]> {
    const result = await this.db
      .select({
        linkId: regulationStatuteLinks.id,
        statuteId: regulationStatuteLinks.statuteId,
        citation: regulationStatuteLinks.citation,
        linkType: regulationStatuteLinks.linkType,
        matchStatus: regulationStatuteLinks.matchStatus,
        context: regulationStatuteLinks.context,
        originalCitation: regulationStatuteLinks.originalCitation,
        statute: {
          id: statutes.id,
          title: statutes.title,
          citation: statutes.citation,
          hierarchyLevel: statutes.hierarchyLevel,
        },
      })
      .from(regulationStatuteLinks)
      .leftJoin(statutes, eq(regulationStatuteLinks.statuteId, statutes.id))
      .where(
        and(
          eq(regulationStatuteLinks.regulationId, regulationId),
          eq(regulationStatuteLinks.linkType, 'enabling_authority')
        )
      )
      .orderBy(regulationStatuteLinks.citation);

    return result.map(r => ({
      linkId: r.linkId,
      statuteId: r.statuteId,
      citation: r.citation,
      linkType: r.linkType ?? 'enabling_authority',
      matchStatus: r.matchStatus ?? 'matched',
      context: r.context,
      originalCitation: r.originalCitation,
      statute: r.statute?.id ? {
        id: r.statute.id,
        title: r.statute.title,
        citation: r.statute.citation,
        hierarchyLevel: r.statute.hierarchyLevel,
      } : null,
    }));
  }

  /**
   * Get aggregate stats for a state (for analytics)
   */
  async getStatsByState(jurisdiction: string): Promise<StatuteLinkStats> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    // Total statutes
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(statutes)
      .where(eq(statutes.jurisdiction, stateUpper));

    // Statutes with at least one link
    const linkedResult = await this.db.execute<{ count: number }>(sql`
      SELECT COUNT(DISTINCT rsl.statute_id)::int as count
      FROM regulation_statute_links rsl
      JOIN statutes s ON rsl.statute_id = s.id
      WHERE s.jurisdiction =${stateUpper}
        AND rsl.statute_id IS NOT NULL
    `);

    // Total links
    const totalLinksResult = await this.db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM regulation_statute_links rsl
      JOIN regulatory_documents rd ON rsl.regulation_id = rd.id
      WHERE rd.jurisdiction =${stateUpper}
    `);

    // By link type
    const byTypeResult = await this.db.execute<{ link_type: string; count: number }>(sql`
      SELECT rsl.link_type, COUNT(*)::int as count
      FROM regulation_statute_links rsl
      JOIN regulatory_documents rd ON rsl.regulation_id = rd.id
      WHERE rd.jurisdiction =${stateUpper}
      GROUP BY rsl.link_type
    `);

    // By match status
    const byStatusResult = await this.db.execute<{ match_status: string; count: number }>(sql`
      SELECT rsl.match_status, COUNT(*)::int as count
      FROM regulation_statute_links rsl
      JOIN regulatory_documents rd ON rsl.regulation_id = rd.id
      WHERE rd.jurisdiction =${stateUpper}
      GROUP BY rsl.match_status
    `);

    // Regulations with at least one link
    const regsWithLinksResult = await this.db.execute<{ count: number }>(sql`
      SELECT COUNT(DISTINCT rsl.regulation_id)::int as count
      FROM regulation_statute_links rsl
      JOIN regulatory_documents rd ON rsl.regulation_id = rd.id
      WHERE rd.jurisdiction =${stateUpper}
    `);

    // Total regulations
    const totalRegsResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.jurisdiction, stateUpper));

    const byLinkType: Record<string, number> = {};
    for (const row of byTypeResult.rows) {
      byLinkType[row.link_type ?? 'unknown'] = row.count;
    }

    const byMatchStatus: Record<string, number> = {};
    for (const row of byStatusResult.rows) {
      byMatchStatus[row.match_status ?? 'unknown'] = row.count;
    }

    return {
      totalStatutes: totalResult[0]?.count ?? 0,
      linkedStatutes: linkedResult.rows[0]?.count ?? 0,
      totalLinks: totalLinksResult.rows[0]?.count ?? 0,
      byLinkType,
      byMatchStatus,
      regulationsWithLinks: regsWithLinksResult.rows[0]?.count ?? 0,
      totalRegulations: totalRegsResult[0]?.count ?? 0,
    };
  }

  /**
   * Search statutes by citation or title
   */
  async searchStatutes(jurisdiction: string, query: string, limit = 50): Promise<StatuteHierarchyNode[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);
    const searchPattern = `%${query}%`;

    const result = await this.db.execute<{
      id: number;
      citation: string;
      title: string;
      jurisdiction: string;
      hierarchy_level: string | null;
      parent_id: number | null;
      child_count: number;
      linked_regulation_count: number;
      enabling_authority_count: number;
      descendant_linked_regulation_count: number;
      descendant_enabling_authority_count: number;
      has_content: boolean;
    }>(sql`
      SELECT
        s.id,
        s.citation,
        s.title,
        s.jurisdiction,
        s.hierarchy_level,
        s.parent_id,
        (SELECT COUNT(*)::int FROM statutes c WHERE c.parent_id = s.id) as child_count,
        (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id) as linked_regulation_count,
        (SELECT COUNT(*)::int FROM regulation_statute_links rsl WHERE rsl.statute_id = s.id AND rsl.link_type = 'enabling_authority') as enabling_authority_count,
        COALESCE(s.descendant_linked_regulation_count, 0)::int as descendant_linked_regulation_count,
        COALESCE(s.descendant_enabling_authority_count, 0)::int as descendant_enabling_authority_count,
        (s.content IS NOT NULL AND s.content != '') as has_content
      FROM statutes s
      WHERE s.jurisdiction = ${stateUpper}
        AND (s.citation ILIKE ${searchPattern} OR s.title ILIKE ${searchPattern})
      ORDER BY
        natural_sort_num(COALESCE(s.njsa_title, s.nycls_law_id, s.citation)) NULLS LAST,
        natural_sort_alpha(COALESCE(s.njsa_title, s.nycls_law_id, s.citation)) NULLS LAST,
        natural_sort_num(COALESCE(s.njsa_section, s.njsa_chapter, s.nycls_section, s.nycls_article)) NULLS LAST,
        natural_sort_alpha(COALESCE(s.njsa_section, s.njsa_chapter, s.nycls_section, s.nycls_article)) NULLS LAST
      LIMIT ${limit}
    `);

    return result.rows.map(this.mapHierarchyNode);
  }

  /**
   * Get ancestor chain for breadcrumbs (recursive CTE)
   */
  async getAncestorChain(statuteId: number): Promise<StatuteAncestor[]> {
    const result = await this.db.execute<{
      id: number;
      citation: string;
      title: string;
      hierarchy_level: string | null;
      depth: number;
    }>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, citation, title, hierarchy_level, parent_id, 0 as depth
        FROM statutes
        WHERE id = ${statuteId}

        UNION ALL

        SELECT s.id, s.citation, s.title, s.hierarchy_level, s.parent_id, a.depth + 1
        FROM statutes s
        JOIN ancestors a ON s.id = a.parent_id
      )
      SELECT id, citation, title, hierarchy_level, depth
      FROM ancestors
      WHERE id != ${statuteId}
      ORDER BY depth DESC
    `);

    return result.rows.map(row => ({
      id: row.id,
      citation: row.citation,
      title: row.title,
      hierarchyLevel: row.hierarchy_level,
    }));
  }

  private mapHierarchyNode(row: {
    id: number;
    citation: string;
    title: string;
    jurisdiction: string;
    hierarchy_level: string | null;
    parent_id: number | null;
    child_count: number;
    linked_regulation_count: number;
    enabling_authority_count: number;
    descendant_linked_regulation_count: number;
    descendant_enabling_authority_count: number;
    has_content: boolean;
  }): StatuteHierarchyNode {
    return {
      id: row.id,
      citation: row.citation,
      title: row.title,
      jurisdiction: row.jurisdiction,
      hierarchyLevel: row.hierarchy_level,
      parentId: row.parent_id,
      childCount: row.child_count,
      linkedRegulationCount: row.linked_regulation_count,
      enablingAuthorityCount: row.enabling_authority_count,
      descendantLinkedRegulationCount: row.descendant_linked_regulation_count,
      descendantEnablingAuthorityCount: row.descendant_enabling_authority_count,
      hasContent: row.has_content,
    };
  }
}
