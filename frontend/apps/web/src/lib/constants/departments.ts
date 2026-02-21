/**
 * NYCRR Title Number → Department Name mapping.
 * Source: NY Secretary of State's official NYCRR title list.
 * Falls back to "Title N" if unknown.
 */
export const NYCRR_TITLE_DEPARTMENTS: Record<number, string> = {
  1: 'Dept. of Agriculture and Markets',
  2: 'Dept. of Audit and Control',
  3: 'Banking Dept.',
  4: 'Dept. of Civil Service',
  5: 'Dept. of Correctional Services',
  6: 'Dept. of Economic Development',
  7: 'Dept. of Education',
  8: 'Education Dept. (Professions)',
  9: 'Executive Dept.',
  10: 'Dept. of Financial Services',
  11: 'Dept. of Health',
  12: 'Dept. of Labor',
  13: 'Dept. of Law',
  14: 'Dept. of Mental Hygiene',
  15: 'Dept. of Motor Vehicles',
  16: 'Dept. of Public Service',
  17: 'Dept. of Social Services',
  18: 'Dept. of State',
  19: 'Dept. of Taxation and Finance',
  20: 'Dept. of Transportation',
  21: 'Miscellaneous',
  22: 'Uniform Rules of Court',
  23: 'Division of Homeland Security and Emergency Services',
};

/**
 * NJAC Title Number → Department Name mapping.
 * Source: NJ Office of Administrative Law.
 * Falls back to "Title N" if unknown.
 */
export const NJAC_TITLE_DEPARTMENTS: Record<string, string> = {
  '1': 'Governor / Legislature',
  '2': 'Dept. of Agriculture',
  '3': 'Dept. of Banking and Insurance',
  '4A': 'Dept. of Personnel',
  '5': 'Dept. of Community Affairs',
  '6': 'Dept. of Corrections',
  '6A': 'Dept. of Education',
  '7': 'Dept. of Environmental Protection',
  '8': 'Dept. of Health',
  '9': 'Dept. of Human Services',
  '9A': 'NJ Racing Commission',
  '10': 'Dept. of Human Services (Welfare)',
  '11': 'Dept. of Insurance',
  '12': 'Dept. of Labor and Workforce Development',
  '13': 'Dept. of Law and Public Safety',
  '14': 'Dept. of Children and Families',
  '14A': 'Dept. of Military and Veterans Affairs',
  '15': 'Dept. of State',
  '16': 'Dept. of Transportation',
  '17': 'Dept. of the Treasury',
  '18': 'Dept. of Taxation',
  '19': 'Other Agencies',
};

export function getDepartmentName(nycrrTitle: number | null, njacTitle: string | null): string {
  if (nycrrTitle !== null) {
    return NYCRR_TITLE_DEPARTMENTS[nycrrTitle] ?? `Title ${nycrrTitle}`;
  }
  if (njacTitle !== null) {
    return NJAC_TITLE_DEPARTMENTS[njacTitle] ?? `Title ${njacTitle}`;
  }
  return '';
}
