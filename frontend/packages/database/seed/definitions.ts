import type { NewDefinition } from '../src/schema';
import type { Rng } from './rng';
import type { DocumentTree, SeedDocument } from './regulatory-documents';

export interface SeedDefinition extends NewDefinition {
  id: number;
}

/** Several terms contain "person" so the glossary filter test finds matches. */
const TERMS = [
  'person', 'responsible person', 'personal representative', 'personnel', 'authorized person',
  'health care facility', 'licensee', 'applicant', 'department', 'commissioner', 'facility',
  'operator', 'child day care center', 'certified copy', 'business day', 'written notice',
  'electronic signature', 'original document', 'record', 'permit', 'inspection', 'agency',
  'authorized representative', 'provider', 'program', 'enrollee', 'resident', 'caregiver',
  'supervisor', 'employee', 'employer', 'premises', 'site', 'hazardous material', 'waste',
  'discharge', 'permit holder', 'violation', 'notice of violation', 'hearing', 'appeal', 'fee',
  'fine', 'penalty', 'surcharge', 'fiscal year', 'calendar year', 'quarter', 'report',
  'annual report', 'plan of correction', 'deficiency', 'survey', 'audit', 'certificate',
  'license', 'registration', 'renewal', 'reinstatement', 'revocation',
];

export const NY_DEFINITION_COUNT = 120;
export const NJ_DEFINITION_COUNT = 60;

function makeDefinition(
  rng: Rng,
  id: number,
  section: SeedDocument,
  scopeParent: SeedDocument,
  scope: string,
  scopeLevel: string,
  index: number,
  extractedAt: Date,
): SeedDefinition {
  const term = TERMS[index % TERMS.length];
  const reviewed = index % 6 === 5;
  return {
    id,
    documentId: section.id,
    url: section.url,
    term,
    verbatimText: `"${term.charAt(0).toUpperCase()}${term.slice(1)}" means any ${term} as that term is used ${scope}, including any successor designation.`,
    isVerbatimTextComplete: true,
    scope,
    definitionOverlap: rng.float(0.35, 1, 2),
    sourceLocation: `subdivision (${String.fromCharCode(97 + (index % 6))})`,
    modelVersion: 'e2e-seed',
    extractedAt,
    scopeLevel,
    scopeDocumentId: scopeParent.id,
    definitionType: index % 10 === 9 ? 'abbreviation' : 'formal',
    isCrossReference: false,
    reviewStatus: reviewed ? 'confirmed' : 'unreviewed',
    reviewedAt: reviewed ? extractedAt : null,
    reviewerName: reviewed ? 'Seed Reviewer' : null,
    developerStatus: 'unresolved',
  };
}

export function buildDefinitions(rng: Rng, tree: DocumentTree, extractedAt: Date): SeedDefinition[] {
  const out: SeedDefinition[] = [];
  const partById = new Map(tree.ny.parts.map((p) => [p.id, p]));
  const subById = new Map(tree.nj.subchapters.map((s) => [s.id, s]));
  let id = 1;
  for (let i = 0; i < NY_DEFINITION_COUNT; i++) {
    const section = tree.ny.sections[(i * 11) % tree.ny.sections.length];
    const part = partById.get(section.parentId!)!;
    out.push(makeDefinition(rng, id++, section, part, 'in this Part', 'part', i, extractedAt));
  }
  for (let i = 0; i < NJ_DEFINITION_COUNT; i++) {
    const section = tree.nj.sections[(i * 7) % tree.nj.sections.length];
    const sub = subById.get(section.parentId!)!;
    out.push(makeDefinition(rng, id++, section, sub, 'in this subchapter', 'subchapter', i, extractedAt));
  }
  return out;
}
