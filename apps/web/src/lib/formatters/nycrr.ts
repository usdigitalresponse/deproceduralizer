/**
 * Format NYCRR (New York Codes, Rules and Regulations) citation
 * Example output: "18 NYCRR 505.14"
 */
export function formatNycrrCitation(
  nycrrTitle: number | null,
  nycrrPart: string | null,
  nycrrSection: string | null
): string | null {
  if (!nycrrTitle) return null;

  return `${nycrrTitle} NYCRR ${nycrrPart || ''}${nycrrSection ? '.' + nycrrSection : ''}`;
}
