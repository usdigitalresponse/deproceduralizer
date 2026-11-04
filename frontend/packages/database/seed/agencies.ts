import type { NewAgency } from '../src/schema';

export interface SeedAgency extends NewAgency {
  id: number;
  abbreviation: string;
}

const AGENCY_LIST: Array<[string, string, string]> = [
  ['NY', 'Department of Health', 'DOH'],
  ['NY', 'Office of Children and Family Services', 'OCFS'],
  ['NY', 'Department of Labor', 'DOL'],
  ['NY', 'Department of Environmental Conservation', 'DEC'],
  ['NY', 'Department of State', 'DOS'],
  ['NJ', 'Department of Human Services', 'DHS'],
  ['NJ', 'Department of Health', 'NJDOH'],
  ['NJ', 'Department of Environmental Protection', 'NJDEP'],
  ['NYC', 'Department of Health and Mental Hygiene', 'DOHMH'],
  ['NYC', 'Department of Buildings', 'DOB'],
];

export function buildAgencies(createdAt: Date): SeedAgency[] {
  return AGENCY_LIST.map(([jurisdiction, canonicalName, abbreviation], i) => ({
    id: i + 1,
    jurisdiction,
    canonicalName,
    abbreviation,
    level: jurisdiction === 'NYC' ? 'city' : 'state',
    createdAt,
  }));
}

export function agenciesFor(agencies: SeedAgency[], jurisdiction: string): SeedAgency[] {
  return agencies.filter((a) => a.jurisdiction === jurisdiction);
}
