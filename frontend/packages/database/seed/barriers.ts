import type { NewBarrierAnalysis, NewBarrierIssue } from '../src/schema';
import { BARRIER_CATEGORIES } from '../src/schema';
import type { Rng } from './rng';
import type { DocumentTree, SeedDocument } from './regulatory-documents';
import { NY_FIXED_PART } from './regulatory-documents';
import type { SeedGuidanceDocument } from './guidance-documents';

export interface SeedBarrierAnalysis extends NewBarrierAnalysis {
  id: number;
}
export interface SeedBarrierIssue extends NewBarrierIssue {
  id: number;
}

export const NY_BARRIER_REGULATION_COUNT = 60;
export const NY_BARRIER_PART_MIN = 6;
export const NY_BARRIER_GUIDANCE_COUNT = 10;
export const NJ_BARRIER_COUNT = 10;
export const BARRIER_HIGH_COMPLEXITY_MIN = 24;
export const BARRIER_CHILD_CARE_MIN = 12;

const COMPLEXITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

interface Source {
  documentId?: number;
  guidanceDocumentId?: number;
  jurisdiction: string;
  content: string;
}

export interface BarrierFixtures {
  analyses: SeedBarrierAnalysis[];
  issues: SeedBarrierIssue[];
}

export function buildBarriers(
  rng: Rng,
  tree: DocumentTree,
  guidance: SeedGuidanceDocument[],
  completedAt: Date,
): BarrierFixtures {
  const sources: Source[] = [];
  const partSections = tree.ny.sections.filter((s) => s.nycrrPart === NY_FIXED_PART && s.nycrrTitle === 10);
  const chosen = new Set<number>();
  const pushDoc = (doc: SeedDocument) => {
    if (chosen.has(doc.id)) return;
    chosen.add(doc.id);
    sources.push({ documentId: doc.id, jurisdiction: doc.jurisdiction!, content: doc.content });
  };
  partSections.slice(0, NY_BARRIER_PART_MIN).forEach(pushDoc);
  for (let k = 0; sources.length < NY_BARRIER_REGULATION_COUNT; k++) {
    pushDoc(tree.ny.sections[(150 + k * 17) % tree.ny.sections.length]);
  }
  guidance.filter((g) => g.jurisdiction === 'NY').slice(0, NY_BARRIER_GUIDANCE_COUNT)
    .forEach((g) => sources.push({ guidanceDocumentId: g.id, jurisdiction: 'NY', content: g.content }));
  for (let k = 0; k < NJ_BARRIER_COUNT; k++) {
    pushDoc(tree.nj.sections[(300 + k * 3) % tree.nj.sections.length]);
  }

  const analyses: SeedBarrierAnalysis[] = [];
  const issues: SeedBarrierIssue[] = [];
  let issueId = 1;
  let highLeft = BARRIER_HIGH_COMPLEXITY_MIN;
  let childCareLeft = BARRIER_CHILD_CARE_MIN;
  sources.forEach((source, i) => {
    const categories = rng.sample(BARRIER_CATEGORIES, rng.int(1, 3));
    const analysisId = i + 1;
    const issueRows: SeedBarrierIssue[] = categories.map((category) => {
      const complexity = highLeft-- > 0 ? 'HIGH' : rng.pick(COMPLEXITIES);
      const mentionsChildCare = childCareLeft-- > 0;
      return {
        id: issueId++,
        analysisId,
        documentId: source.documentId ?? null,
        guidanceDocumentId: source.guidanceDocumentId ?? null,
        category,
        explanation: mentionsChildCare
          ? `Providers of child care must follow a fixed sequence of steps that does not describe the outcome the agency wants.`
          : `The section prescribes detailed steps instead of the outcome it is meant to achieve (${category.toLowerCase().replace(/_/g, ' ')}).`,
        severity: rng.int(1, 10),
        complexity,
        confidence: rng.float(0.5, 1, 2),
        matchedPhrases: ['shall submit', 'in a form acceptable'],
        implementationApproach: 'Replace the prescribed steps with an outcome standard and accept electronic submissions.',
        effortEstimate: 'medium',
        textExamples: [source.content.slice(0, 120)],
        tags: ['filing', 'records', mentionsChildCare ? 'child care' : 'licensing'],
        isVerbatim: issueId % 2 === 0,
        reviewStatus: rng.chance(0.85) ? 'unreviewed' : 'confirmed',
        developerStatus: 'unresolved',
        createdAt: completedAt,
        updatedAt: completedAt,
      };
    });
    analyses.push({
      id: analysisId,
      documentId: source.documentId ?? null,
      guidanceDocumentId: source.guidanceDocumentId ?? null,
      jurisdiction: source.jurisdiction,
      runId: 'seed-barrier-0001',
      batchId: 'seed-batch',
      completedAt,
      classification: 'has_issues',
      confidence: rng.float(0.6, 0.98),
      categories,
      hasImplementationIssues: true,
      overallComplexity: issueRows.some((r) => r.complexity === 'HIGH') ? 'HIGH' : rng.pick(COMPLEXITIES),
      summary: 'The section mandates procedural steps rather than outcomes and lacks a feedback mechanism.',
      maxSeverity: Math.max(...issueRows.map((r) => r.severity)),
      numCategoriesFound: issueRows.length,
      pipelineVersion: 'barrier-v1',
      modelVersion: 'e2e-seed',
      responsibleAgency: 'Department of Health',
      createdAt: completedAt,
      updatedAt: completedAt,
    });
    issues.push(...issueRows);
  });
  return { analyses, issues };
}
