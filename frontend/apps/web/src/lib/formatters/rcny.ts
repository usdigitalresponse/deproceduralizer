/**
 * Format RCNY (Rules of the City of New York) citation
 * Example output: "RCNY § 3-01" or "RCNY Title 1 § 3-01"
 */
export function formatRcnyCitation(
  rcnyTitle: string | null,
  rcnySection: string | null
): string | null {
  if (!rcnyTitle && !rcnySection) return null;

  if (rcnySection) {
    return `RCNY § ${rcnySection}`;
  }

  return `RCNY Title ${rcnyTitle}`;
}
