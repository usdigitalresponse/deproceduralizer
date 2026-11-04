'use server';

import 'server-only';
import { readFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { type ActionResult, runAction } from './types';
import { getRegulationById } from './regulations';
import { getAncestorChain, getSiblingDocumentsForPrompt } from './hierarchy';
import { getApplicableDefinitionsForDocumentSplit } from './definitions';
import { getCrossReferencesForDocument } from './cross-references';
import { db, sql } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@deproceduralizer/database';
import { estimateTokens, extractPlaceholders } from '@/lib/utils/prompt-helpers';
import type {
  BarrierComposedPrompt,
  BarrierPromptLayer,
  BarrierContextMetadata,
  SectionSearchResult,
} from '@/components/prompts/BarrierPipelineComposer/types';

// =============================================================================
// YAML Types
// =============================================================================

interface RawBarrierPrompt {
  updated_at?: string;
  description?: string;
  system?: string;
  batch_context?: string;
  template?: string;
}

// =============================================================================
// Formatting Functions (ported from Python formatting.py)
// =============================================================================

interface AncestorNode {
  hierarchyLevel: string | null;
  citation: string | null;
  title: string;
  summary?: string | null;
}

interface SiblingNode {
  citation: string | null;
  title: string;
  summary: string | null;
}

interface DefinitionEntry {
  term: string;
  verbatimText?: string | null;
  rephrasedDefinition?: string | null;
}

interface CrossRefEntry {
  targetDocument: {
    citation: string | null;
    title: string | null;
    shortTitle: string | null;
    summary: string | null;
  } | null;
}

function formatAncestorChain(ancestors: AncestorNode[]): string {
  if (!ancestors.length) return 'No ancestor hierarchy available.';
  return ancestors
    .map((a) => `  ${a.hierarchyLevel || 'unknown'}: ${a.citation || ''} ${a.title}`)
    .join('\n');
}

function formatSiblingCatalog(siblings: SiblingNode[]): string {
  if (!siblings.length) return 'No sibling sections available.';
  return siblings
    .map((s) => {
      const summaryPart = s.summary ? ` — ${s.summary}` : '';
      return `  - ${s.citation || '(no citation)'}: ${s.title}${summaryPart}`;
    })
    .join('\n');
}

function formatDefinitionsWithText(definitions: DefinitionEntry[]): string {
  if (!definitions.length) return 'No definitions available.';
  return definitions
    .map((d) => {
      const text = d.verbatimText || d.rephrasedDefinition || '';
      if (text) {
        return `  - ${d.term}: ${text.slice(0, 500)}`;
      }
      return `  - ${d.term}`;
    })
    .join('\n');
}

function formatCrossRefs(crossRefs: CrossRefEntry[]): string {
  if (!crossRefs.length) return 'No cross-references found.';
  return crossRefs
    .map((x) => {
      if (!x.targetDocument) return '  - (unresolved reference)';
      const displayTitle = x.targetDocument.shortTitle || x.targetDocument.title;
      const titlePart = displayTitle ? `: ${displayTitle}` : '';
      const summaryPart = x.targetDocument.summary ? ` — ${x.targetDocument.summary}` : '';
      return `  - ${x.targetDocument.citation || '(no citation)'}${titlePart}${summaryPart}`;
    })
    .join('\n');
}


function formatRichContextBlock(
  ancestors: AncestorNode[],
  siblings: SiblingNode[],
  definitions: DefinitionEntry[],
): string {
  const sections: string[] = [];

  sections.push('REGULATORY HIERARCHY:');
  sections.push(formatAncestorChain(ancestors));

  // Single merged sibling section (no duplicate sibling summaries below)
  sections.push('\nSIBLING SECTIONS IN THIS SUBCHAPTER:');
  sections.push(formatSiblingCatalog(siblings));

  sections.push('\nDEFINITIONS (WITH FULL TEXT):');
  sections.push(formatDefinitionsWithText(definitions));

  // Ancestor summaries only (siblings merged above, cross-refs are in Layer 3)
  const proactiveParts: string[] = [];
  const ancestorsWithSummaries = ancestors.filter((a) => a.summary);
  if (ancestorsWithSummaries.length) {
    proactiveParts.push('ANCESTOR CONTEXT:');
    for (const anc of ancestorsWithSummaries) {
      proactiveParts.push(`  - ${anc.citation || ''} (${anc.hierarchyLevel || 'unknown'}): ${anc.summary}`);
    }
  }
  if (proactiveParts.length) {
    sections.push(`\nRICH CONTEXT:\n${proactiveParts.join('\n')}`);
  }

  return sections.join('\n');
}

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Lightweight search for regulatory sections (typeahead).
 * Queries only regulatory_documents with ts_rank — no UNION ALL across
 * statutes/guidance, no count query, no commentary sidebar.
 */
export async function searchSectionsForComposer(
  query: string,
  jurisdiction: JurisdictionCode,
): Promise<ActionResult<SectionSearchResult[]>> {
  return runAction('searchSectionsForComposer', async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const results = await db.execute(sql`
      SELECT id, title, citation, hierarchy_path AS "hierarchyPath"
      FROM regulatory_documents
      WHERE jurisdiction = ${jurisdiction.toUpperCase()}
        AND hierarchy_level IN ('section', 'subpart')
        AND direct_child_count = 0
        AND (
          search_vector @@ websearch_to_tsquery('english', ${trimmed})
          OR citation ILIKE '%' || ${trimmed} || '%'
        )
      ORDER BY
        CASE WHEN citation ILIKE '%' || ${trimmed} || '%' THEN 0 ELSE 1 END,
        ts_rank(search_vector, websearch_to_tsquery('english', ${trimmed}), 32) DESC
      LIMIT 10
    `);

    return (results.rows as Array<{ id: number; title: string; citation: string | null; hierarchyPath: string | null }>).map((row) => ({
      id: row.id,
      title: row.title,
      citation: row.citation,
      hierarchyPath: row.hierarchyPath,
      jurisdiction,
    }));
  });
}

/**
 * Compose the full Barrier prompt for a given document.
 * Reads the YAML template, fetches all context from the DB,
 * and assembles the 3-layer prompt with filled placeholders.
 */
export async function composeBarrierPrompt(
  documentId: number,
): Promise<ActionResult<BarrierComposedPrompt>> {
  return runAction('composeBarrierPrompt', async () => {
    // Load YAML template
    const filePath = join(process.cwd(), 'src/data/barriers.yaml');
    const fileContent = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(fileContent) as Record<string, RawBarrierPrompt>;
    const analysis = parsed.analysis;

    if (!analysis) {
      throw new Error('No "analysis" prompt found in barriers.yaml');
    }

    const systemTemplate = analysis.system?.trim() || '';
    const batchContextTemplate = analysis.batch_context?.trim() || '';
    const documentTemplate = analysis.template?.trim() || '';

    // Fetch all context in parallel
    const [docResult, ancestorResult, siblingResult, defsResult, crossRefResult] = await Promise.all([
      getRegulationById(documentId),
      getAncestorChain(documentId),
      getSiblingDocumentsForPrompt(documentId),
      getApplicableDefinitionsForDocumentSplit(documentId),
      getCrossReferencesForDocument(documentId),
    ]);

    if (!docResult.success || !docResult.data) {
      throw new Error(`Document ${documentId} not found`);
    }
    if (!ancestorResult.success) throw new Error(ancestorResult.error);
    if (!siblingResult.success) throw new Error(siblingResult.error);
    if (!defsResult.success) throw new Error(defsResult.error);
    if (!crossRefResult.success) throw new Error(crossRefResult.error);

    const doc = docResult.data;
    const ancestors = ancestorResult.data;
    const siblings = siblingResult.data;
    const allDefs = [...defsResult.data.currentDocument, ...defsResult.data.ancestors];
    const crossRefs = crossRefResult.data;

    // Format context
    const ancestorNodes: AncestorNode[] = ancestors.map((a) => ({
      hierarchyLevel: a.hierarchyLevel,
      citation: a.citation,
      title: a.title,
      summary: a.summary,
    }));

    const siblingNodes: SiblingNode[] = siblings.map((s) => ({
      citation: s.citation,
      title: s.title,
      summary: s.summary,
    }));

    const definitionEntries: DefinitionEntry[] = allDefs.map((d) => ({
      term: d.term,
      verbatimText: d.verbatimText,
      rephrasedDefinition: d.rephrasedDefinition,
    }));

    const crossRefEntries: CrossRefEntry[] = crossRefs.map((x) => ({
      targetDocument: x.targetDocument
        ? { citation: x.targetDocument.citation, title: x.targetDocument.title, shortTitle: x.targetDocument.shortTitle, summary: x.targetDocument.summary }
        : null,
    }));

    // Build the rich context block for batch_context layer
    const richContextBlock = formatRichContextBlock(
      ancestorNodes,
      siblingNodes,
      definitionEntries,
    );

    // Fill batch_context placeholders
    const batchContextContent = batchContextTemplate.replace(
      '{rich_context_block}',
      richContextBlock,
    );

    // Fill template placeholders
    const templateContent = documentTemplate
      .replace('{citation}', doc.citation || '(no citation)')
      .replace('{title}', doc.title || '(no title)')
      .replace('{summary}', doc.summary || '(no summary)')
      .replace('{cross_references}', formatCrossRefs(crossRefEntries))
      .replace('{section_text}', doc.content || '(no content available)');

    // Extract placeholder info
    const batchContextPlaceholders = extractPlaceholders(batchContextTemplate);
    const templatePlaceholders = extractPlaceholders(documentTemplate);
    const filledTemplatePlaceholders = ['citation', 'title', 'summary', 'cross_references', 'section_text'];

    // Build layers
    const systemLayer: BarrierPromptLayer = {
      content: systemTemplate,
      tokenEstimate: estimateTokens(systemTemplate),
      cacheStatus: 'global',
    };

    const batchContextLayer: BarrierPromptLayer = {
      content: batchContextContent,
      tokenEstimate: estimateTokens(batchContextContent),
      cacheStatus: 'per-subchapter',
      placeholdersReplaced: batchContextPlaceholders,
    };

    const templateLayer: BarrierPromptLayer = {
      content: templateContent,
      tokenEstimate: estimateTokens(templateContent),
      cacheStatus: 'never-cached',
      placeholdersReplaced: filledTemplatePlaceholders,
      placeholdersRemaining: templatePlaceholders.filter(
        (p) => !filledTemplatePlaceholders.includes(p),
      ),
    };

    // Build context metadata
    const context: BarrierContextMetadata = {
      ancestorChain: ancestors.map((a) => ({
        level: a.hierarchyLevel || 'unknown',
        citation: a.citation || '',
        title: a.title,
      })),
      siblingCount: siblings.length,
      definitionCount: allDefs.length,
      crossRefCount: crossRefs.length,
      documentTitle: doc.title || '',
      documentCitation: doc.citation || '',
      documentHierarchyLevel: doc.hierarchyLevel || '',
      jurisdiction: doc.jurisdiction || '',
    };

    return {
      layers: {
        system: systemLayer,
        batch_context: batchContextLayer,
        template: templateLayer,
      },
      totalTokenEstimate:
        systemLayer.tokenEstimate +
        batchContextLayer.tokenEstimate +
        templateLayer.tokenEstimate,
      context,
    };
  });
}
