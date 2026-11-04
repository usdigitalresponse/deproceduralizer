import type { NewCrossReference } from '../src/schema';
import type { Rng } from './rng';
import type { DocumentTree } from './regulatory-documents';

export interface SeedCrossReference extends NewCrossReference {
  id: number;
}

export const NY_CROSS_REFERENCE_COUNT = 1200;
export const NJ_CROSS_REFERENCE_COUNT = 100;

export function buildCrossReferences(rng: Rng, tree: DocumentTree, createdAt: Date): SeedCrossReference[] {
  const out: SeedCrossReference[] = [];
  let id = 1;
  const nySections = tree.ny.sections;
  for (let i = 0; i < NY_CROSS_REFERENCE_COUNT; i++) {
    const source = nySections[i % nySections.length];
    const target = nySections[(i * 31 + 7) % nySections.length];
    const roll = rng.next();
    const refType = roll < 0.6 ? 'nycrr' : roll < 0.85 ? 'ny_short_form' : 'same_section';
    const resolved = rng.chance(0.75);
    let rawText: string;
    let normalized: string;
    let components: NewCrossReference['components'];
    if (refType === 'nycrr') {
      rawText = `${target.nycrrTitle} NYCRR ${target.nycrrSection}`;
      normalized = rawText;
      components = { title: String(target.nycrrTitle), section: target.nycrrSection!, state: 'NY' };
    } else if (refType === 'ny_short_form') {
      rawText = `section ${target.nycrrSection} of this Part`;
      normalized = `${source.nycrrTitle} NYCRR ${target.nycrrSection}`;
      components = { section: target.nycrrSection!, scope: 'part', requires_context: true, state: 'NY' };
    } else {
      rawText = `paragraph (${String.fromCharCode(97 + (i % 5))}) of this section`;
      normalized = `${source.nycrrTitle} NYCRR ${source.nycrrSection}(${String.fromCharCode(97 + (i % 5))})`;
      components = { subsection_ref: `(${String.fromCharCode(97 + (i % 5))})`, is_relative: true, state: 'NY' };
    }
    const targetId = refType === 'same_section' ? source.id : target.id;
    out.push({
      id: id++,
      sourceDocumentId: source.id,
      refType,
      rawText,
      normalizedCitation: normalized,
      startOffset: i * 7,
      endOffset: i * 7 + rawText.length,
      contextBefore: 'as provided in ',
      contextAfter: ', the operator shall',
      components,
      targetDocumentId: resolved ? targetId : null,
      isResolved: resolved,
      resolutionNotes: resolved ? null : 'No matching section found.',
      jurisdiction: 'NY',
      sourceJurisdiction: 'NY',
      targetJurisdiction: 'NY',
      createdAt,
    });
  }
  const njSections = tree.nj.sections;
  for (let i = 0; i < NJ_CROSS_REFERENCE_COUNT; i++) {
    const source = njSections[(i * 3) % njSections.length];
    const target = njSections[(i * 17 + 11) % njSections.length];
    const resolved = rng.chance(0.75);
    const rawText = `N.J.A.C. ${target.njacSection}`;
    out.push({
      id: id++,
      sourceDocumentId: source.id,
      refType: 'njac',
      rawText,
      normalizedCitation: rawText,
      startOffset: i * 7,
      endOffset: i * 7 + rawText.length,
      contextBefore: 'pursuant to ',
      contextAfter: ', the provider shall',
      components: { title: target.njacTitle!, chapter: target.njacChapter!, section: target.njacSection!, state: 'NJ' },
      targetDocumentId: resolved ? target.id : null,
      isResolved: resolved,
      jurisdiction: 'NJ',
      sourceJurisdiction: 'NJ',
      targetJurisdiction: 'NJ',
      createdAt,
    });
  }
  return out;
}
