import { Rng } from './rng';
import { buildAgencies, type SeedAgency } from './agencies';
import {
  buildRegulatoryDocuments, applyHierarchyCounts, applyRollup,
  type DocumentTree, type SeedDocument,
} from './regulatory-documents';
import { buildGuidanceDocuments, type SeedGuidanceDocument } from './guidance-documents';
import { buildDefinitions, type SeedDefinition } from './definitions';
import { buildCompliance, type SeedAnalysis, type SeedComplianceIssue } from './compliance';
import { buildBarriers, type SeedBarrierAnalysis, type SeedBarrierIssue } from './barriers';
import { buildFines, type SeedFine } from './fines';
import { buildCrossReferences, type SeedCrossReference } from './cross-references';

export interface Fixtures {
  tree: DocumentTree;
  agencies: SeedAgency[];
  regulatoryDocuments: SeedDocument[];
  guidanceDocuments: SeedGuidanceDocument[];
  definitions: SeedDefinition[];
  complianceIssueAnalyses: SeedAnalysis[];
  complianceIssues: SeedComplianceIssue[];
  barrierAnalyses: SeedBarrierAnalysis[];
  barrierIssues: SeedBarrierIssue[];
  finesFeesPenalties: SeedFine[];
  crossReferences: SeedCrossReference[];
}

export const DEFAULT_SEED = 20260515;
export const FIXTURE_TIMESTAMP = new Date('2026-01-15T12:00:00Z');

/**
 * Build the complete, deterministic fixture set in memory.
 * Pure: no database access. The seed runner inserts the result in FK order.
 */
export function buildFixtures(seed: number = DEFAULT_SEED): Fixtures {
  const rng = new Rng(seed);
  const at = FIXTURE_TIMESTAMP;

  const agencies = buildAgencies(at);
  const tree = buildRegulatoryDocuments(rng, at);
  const guidanceDocuments = buildGuidanceDocuments(rng, agencies, at);
  const definitions = buildDefinitions(rng, tree, at);
  const compliance = buildCompliance(rng, tree, guidanceDocuments, at);
  const barriers = buildBarriers(rng, tree, guidanceDocuments, at);
  const finesFeesPenalties = buildFines(rng, tree, guidanceDocuments, agencies, at);
  const crossReferences = buildCrossReferences(rng, tree, at);

  // Precomputed counters the browse tree and composer rely on.
  applyHierarchyCounts(tree.all);
  const confirmedPerDoc = new Map<number, number>();
  for (const a of compliance.analyses) {
    if (a.requirementFound && a.documentId != null) {
      confirmedPerDoc.set(a.documentId, (confirmedPerDoc.get(a.documentId) ?? 0) + 1);
    }
  }
  applyRollup(
    tree.all, confirmedPerDoc,
    (doc, n) => { doc.complianceIssueCount = n; },
    (doc, n) => { doc.descendantComplianceIssueCount = n; },
  );
  const refsPerDoc = new Map<number, number>();
  for (const r of crossReferences) {
    refsPerDoc.set(r.sourceDocumentId, (refsPerDoc.get(r.sourceDocumentId) ?? 0) + 1);
  }
  for (const doc of tree.all) doc.crossReferenceCount = refsPerDoc.get(doc.id) ?? 0;

  return {
    tree,
    agencies,
    regulatoryDocuments: tree.all,
    guidanceDocuments,
    definitions,
    complianceIssueAnalyses: compliance.analyses,
    complianceIssues: compliance.issues,
    barrierAnalyses: barriers.analyses,
    barrierIssues: barriers.issues,
    finesFeesPenalties,
    crossReferences,
  };
}
