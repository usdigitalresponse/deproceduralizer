/**
 * Format NJAC (New Jersey Administrative Code) citation
 * Example output: "N.J.A.C. 7:26-1.4"
 */
export function formatNjacCitation(
  njacTitle: string | null,
  njacChapter: string | null,
  njacSubchapter: string | null
): string | null {
  if (!njacTitle) return null;

  let citation = `N.J.A.C. ${njacTitle}`;
  if (njacChapter) {
    citation += `:${njacChapter}`;
  }
  if (njacSubchapter) {
    citation += `-${njacSubchapter}`;
  }
  return citation;
}
