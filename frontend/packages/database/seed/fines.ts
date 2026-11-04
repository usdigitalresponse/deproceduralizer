import type { NewFineFeePenalty } from '../src/schema';
import { PENALTY_TYPES } from '../src/schema';
import type { Rng } from './rng';
import type { DocumentTree } from './regulatory-documents';
import type { SeedGuidanceDocument } from './guidance-documents';
import type { SeedAgency } from './agencies';
import { agenciesFor } from './agencies';

export interface SeedFine extends NewFineFeePenalty {
  id: number;
}

export const NY_FINES_REGULATION_COUNT = 60;
export const NY_FINES_GUIDANCE_COUNT = 20;
export const NJ_FINES_COUNT = 20;

const WHO_PAYS = [
  'licensed_or_permitted', 'applicant', 'individual_or_household', 'business_or_corporation',
  'healthcare_or_care_facility', 'violator_or_respondent', 'property_owner', 'employer_or_employee',
] as const;
const PER_UNIT = ['per violation', 'per day', 'per application', 'per facility'] as const;

export function buildFines(
  rng: Rng,
  tree: DocumentTree,
  guidance: SeedGuidanceDocument[],
  agencies: SeedAgency[],
  createdAt: Date,
): SeedFine[] {
  const out: SeedFine[] = [];
  let id = 1;
  const make = (
    jurisdiction: string,
    source: { documentId?: number; guidanceDocumentId?: number; url: string; content: string },
    i: number,
  ): SeedFine => {
    const agency = agenciesFor(agencies, jurisdiction)[i % agenciesFor(agencies, jurisdiction).length];
    const min = 100 * (1 + (i % 9));
    const max = min * 2;
    const penaltyType = PENALTY_TYPES[i % PENALTY_TYPES.length];
    return {
      id: id++,
      documentId: source.documentId ?? null,
      guidanceDocumentId: source.guidanceDocumentId ?? null,
      penaltyType,
      amount: `$${min.toLocaleString('en-US')} to $${max.toLocaleString('en-US')}`,
      amountMin: `${min}.00`,
      amountMax: `${max}.00`,
      perUnit: PER_UNIT[i % PER_UNIT.length],
      whoPays: 'The licensee or applicant',
      responsibleAgency: agency.canonicalName,
      agencyId: agency.id,
      violationDescription: `Failure to file the required report on time (${penaltyType}).`,
      requirementQuote: `A ${penaltyType} of not less than $${min} shall be imposed for each violation.`,
      context: source.content.slice(0, 400),
      termMatched: penaltyType,
      llmConfirmed: true,
      jurisdictionLevel: jurisdiction === 'NYC' ? 'local' : 'state',
      issuingEntityConfidence: '0.90',
      whoPaysNormalized: WHO_PAYS[i % WHO_PAYS.length],
      activityCategory: 'licensing',
      estimatedAnnualPayers: 'hundreds',
      justification: 'Deters late filing and funds program administration.',
      justificationQuote: 'to ensure timely compliance',
      jurisdiction,
      url: source.url,
      reviewStatus: 'unreviewed',
      developerStatus: 'unresolved',
      createdAt,
    };
  };
  for (let i = 0; i < NY_FINES_REGULATION_COUNT; i++) {
    const doc = tree.ny.sections[(i * 19) % tree.ny.sections.length];
    out.push(make('NY', { documentId: doc.id, url: doc.url, content: doc.content }, i));
  }
  const nyGuidance = guidance.filter((g) => g.jurisdiction === 'NY');
  for (let i = 0; i < NY_FINES_GUIDANCE_COUNT; i++) {
    const doc = nyGuidance[(i + 20) % nyGuidance.length];
    out.push(make('NY', { guidanceDocumentId: doc.id, url: doc.url, content: doc.content }, i));
  }
  for (let i = 0; i < NJ_FINES_COUNT; i++) {
    const doc = tree.nj.sections[(i * 13 + 5) % tree.nj.sections.length];
    out.push(make('NJ', { documentId: doc.id, url: doc.url, content: doc.content }, i));
  }
  return out;
}
