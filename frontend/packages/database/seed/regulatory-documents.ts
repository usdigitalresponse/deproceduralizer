import type { NewRegulatoryDocument } from '../src/schema';
import type { Rng } from './rng';
import { sectionContent, summary } from './text';

/** A document with its id fixed up front so other tables can reference it. */
export interface SeedDocument extends NewRegulatoryDocument {
  id: number;
  content: string;
  url: string;
}

export interface DocumentTree {
  all: SeedDocument[];
  ny: { titles: SeedDocument[]; parts: SeedDocument[]; sections: SeedDocument[] };
  nj: { titles: SeedDocument[]; chapters: SeedDocument[]; subchapters: SeedDocument[]; sections: SeedDocument[] };
  nyc: { titles: SeedDocument[]; chapters: SeedDocument[]; sections: SeedDocument[] };
}

/** The hard-coded NJ section id that smoke.spec.ts visits directly. */
export const NJ_FIXED_SECTION_ID = 150387;
/** The NY part number the barrier queue tests filter on. */
export const NY_FIXED_PART = '418';

const SECTION_TYPES = ['requirements', 'definitions', 'procedures', 'penalties'] as const;

// Roughly one in six topics mentions "Health" so the browse title filter has hits.
const SECTION_TOPICS = [
  'Purpose and scope', 'Definitions', 'Application for license', 'Fees', 'Inspection',
  'Recordkeeping', 'Reporting of incidents', 'Notices', 'Appeals', 'Renewal',
  'Posting requirements', 'Training', 'Staffing', 'Environmental health', 'Health records',
  'Health and safety requirements', 'Fire safety and evacuation', 'Mental health services',
  'Enforcement', 'Variances', 'Severability', 'Transfer of ownership', 'Discharge planning',
  'Quality assurance', 'Patient rights', 'Food service', 'Water supply', 'Waste disposal',
  'Emergency preparedness', 'Admission criteria',
];

const NY_TITLES: Array<{ number: number; name: string; parts: Array<[string, string]> }> = [
  {
    number: 10, name: 'Health',
    parts: [
      ['405', 'Hospitals - Minimum Standards'], ['415', 'Nursing Homes - Minimum Standards'],
      [NY_FIXED_PART, 'Child Day Care Centers'], ['425', 'Adult Care Facilities'],
      ['600', 'Public Health Laboratories'], ['700', 'Health Facilities - General'],
      ['800', 'Emergency Medical Services'], ['900', 'Environmental Health Fees'],
    ],
  },
  {
    number: 18, name: 'Social Services',
    parts: [
      ['350', 'Public Assistance'], ['387', 'Food Stamps'], ['404', 'Eligibility'],
      ['421', 'Adoption'], ['430', 'Foster Care'], ['441', 'Standards for Child Care'],
      ['449', 'Facility Operations'], ['485', 'Adult Residential Care'],
    ],
  },
  {
    number: 9, name: 'Executive',
    parts: [
      ['100', 'Department of State'], ['160', 'Licensing'], ['175', 'Real Estate'],
      ['180', 'Notaries Public'], ['200', 'Cemeteries'], ['210', 'Athletic Commission'],
      ['220', 'Building Code Enforcement'], ['230', 'Fire Prevention'],
    ],
  },
];

const NJ_TITLES: Array<{ number: string; name: string; chapters: string[] }> = [
  { number: '10', name: 'Human Services', chapters: ['Administration', 'Medicaid Only', 'Community Programs', 'Developmental Disabilities'] },
  { number: '8', name: 'Health', chapters: ['Vital Statistics', 'Hospital Licensing', 'Long-Term Care', 'Food and Drugs'] },
];

const SUBCHAPTER_NAMES = ['General Provisions', 'Licensure', 'Enforcement'];

function makeContent(rng: Rng, topic: string, planted: string[]): string {
  return `${topic}.\n\n${sectionContent(rng, planted)}`;
}

export function buildRegulatoryDocuments(rng: Rng, createdAt: Date): DocumentTree {
  const all: SeedDocument[] = [];
  const base = { type: 'regulation', createdAt, regulatoryStatus: 'active', excludeFromAnalysis: false } as const;

  // ---- New York (ids from 1000) --------------------------------------------
  const ny: DocumentTree['ny'] = { titles: [], parts: [], sections: [] };
  let nyId = 1000;
  let nySource = 0;
  for (const t of NY_TITLES) {
    const title: SeedDocument = {
      ...base, id: nyId++, sourceIndex: nySource++, jurisdiction: 'NY',
      title: `Title ${t.number} - ${t.name}`, hierarchyLevel: 'title', hierarchyPath: `Title ${t.number}`,
      parentId: null, nycrrTitle: t.number, nycrrTitleName: t.name,
      citation: `${t.number} NYCRR`, levelIdentifier: String(t.number), shortTitle: t.name,
      url: `https://regulations.example.test/new-york/title-${t.number}`,
      content: `Title ${t.number} of the New York Codes, Rules and Regulations: ${t.name}.`,
    };
    ny.titles.push(title);
  }
  for (const [ti, t] of NY_TITLES.entries()) {
    for (const [partNumber, partName] of t.parts) {
      const part: SeedDocument = {
        ...base, id: nyId++, sourceIndex: nySource++, jurisdiction: 'NY',
        title: `Part ${partNumber} - ${partName}`, hierarchyLevel: 'part',
        hierarchyPath: `Title ${t.number} > Part ${partNumber}`, parentId: ny.titles[ti].id,
        nycrrTitle: t.number, nycrrTitleName: t.name, nycrrPart: partNumber, nycrrPartName: partName,
        citation: `${t.number} NYCRR Part ${partNumber}`, levelIdentifier: partNumber, shortTitle: partName,
        url: `https://regulations.example.test/new-york/title-${t.number}/part-${partNumber}`,
        content: `Part ${partNumber}: ${partName}.`,
      };
      ny.parts.push(part);
    }
  }
  for (const part of ny.parts) {
    for (let s = 1; s <= 50; s++) {
      const sectionNumber = `${part.nycrrPart}.${s}`;
      const topic = SECTION_TOPICS[(s + ny.sections.length) % SECTION_TOPICS.length];
      const planted = ny.sections.length % 10 === 0 ? ['fire safety'] : [];
      const section: SeedDocument = {
        ...base, id: nyId++, sourceIndex: nySource++, jurisdiction: 'NY',
        title: `Section ${sectionNumber} - ${topic}`, hierarchyLevel: 'section',
        hierarchyPath: `${part.hierarchyPath} > Section ${sectionNumber}`, parentId: part.id,
        nycrrTitle: part.nycrrTitle, nycrrTitleName: part.nycrrTitleName,
        nycrrPart: part.nycrrPart, nycrrPartName: part.nycrrPartName,
        nycrrSection: sectionNumber, nycrrSectionName: topic,
        citation: `${part.nycrrTitle} NYCRR ${sectionNumber}`, levelIdentifier: sectionNumber, shortTitle: topic,
        url: `https://regulations.example.test/new-york/title-${part.nycrrTitle}/part-${part.nycrrPart}/section-${sectionNumber}`,
        content: makeContent(rng, topic, planted),
        summary: summary(rng, topic),
        sectionType: SECTION_TYPES[ny.sections.length % SECTION_TYPES.length],
        keywords: [topic.toLowerCase(), 'filing', 'records'],
        appliesTo: ['licensees'],
        hasForm: rng.chance(0.2),
        hasIbr: false,
      };
      ny.sections.push(section);
    }
  }
  all.push(...ny.titles, ...ny.parts, ...ny.sections);

  // ---- New Jersey (ids from 150000; sections start at the fixed id) --------
  const nj: DocumentTree['nj'] = { titles: [], chapters: [], subchapters: [], sections: [] };
  let njId = 150000;
  let njSource = 0;
  for (const t of NJ_TITLES) {
    nj.titles.push({
      ...base, id: njId++, sourceIndex: njSource++, jurisdiction: 'NJ',
      title: `Title ${t.number} - ${t.name}`, hierarchyLevel: 'title', hierarchyPath: `Title ${t.number}`,
      parentId: null, njacTitle: t.number, njacTitleName: t.name,
      citation: `N.J.A.C. Title ${t.number}`, levelIdentifier: t.number, shortTitle: t.name,
      url: `https://regulations.example.test/new-jersey/title-${t.number}`,
      content: `Title ${t.number} of the New Jersey Administrative Code: ${t.name}.`,
    });
  }
  for (const [ti, t] of NJ_TITLES.entries()) {
    for (const [ci, chapterName] of t.chapters.entries()) {
      const chapterNumber = String(ci + 1);
      nj.chapters.push({
        ...base, id: njId++, sourceIndex: njSource++, jurisdiction: 'NJ',
        title: `Chapter ${chapterNumber} - ${chapterName}`, hierarchyLevel: 'chapter',
        hierarchyPath: `Title ${t.number} > Chapter ${chapterNumber}`, parentId: nj.titles[ti].id,
        njacTitle: t.number, njacTitleName: t.name, njacChapter: chapterNumber, njacChapterName: chapterName,
        citation: `N.J.A.C. ${t.number}:${chapterNumber}`, levelIdentifier: chapterNumber, shortTitle: chapterName,
        url: `https://regulations.example.test/new-jersey/title-${t.number}/chapter-${chapterNumber}`,
        content: `Chapter ${chapterNumber}: ${chapterName}.`,
      });
    }
  }
  for (const chapter of nj.chapters) {
    for (const [si, subName] of SUBCHAPTER_NAMES.entries()) {
      const subNumber = String(si + 1);
      nj.subchapters.push({
        ...base, id: njId++, sourceIndex: njSource++, jurisdiction: 'NJ',
        title: `Subchapter ${subNumber} - ${subName}`, hierarchyLevel: 'subchapter',
        hierarchyPath: `${chapter.hierarchyPath} > Subchapter ${subNumber}`, parentId: chapter.id,
        njacTitle: chapter.njacTitle, njacTitleName: chapter.njacTitleName,
        njacChapter: chapter.njacChapter, njacChapterName: chapter.njacChapterName,
        njacSubchapter: subNumber, njacSubchapterName: subName,
        citation: `N.J.A.C. ${chapter.njacTitle}:${chapter.njacChapter}-${subNumber}`, levelIdentifier: subNumber, shortTitle: subName,
        url: `https://regulations.example.test/new-jersey/title-${chapter.njacTitle}/chapter-${chapter.njacChapter}/subchapter-${subNumber}`,
        content: `Subchapter ${subNumber}: ${subName}.`,
      });
    }
  }
  njId = NJ_FIXED_SECTION_ID;
  for (const sub of nj.subchapters) {
    for (let s = 1; s <= 15; s++) {
      const sectionNumber = `${sub.njacTitle}:${sub.njacChapter}-${sub.njacSubchapter}.${s}`;
      const topic = nj.sections.length === 0 ? 'Purpose and scope' : SECTION_TOPICS[(s * 3 + nj.sections.length) % SECTION_TOPICS.length];
      nj.sections.push({
        ...base, id: njId++, sourceIndex: njSource++, jurisdiction: 'NJ',
        title: `N.J. Admin. Code § ${sectionNumber} ${topic}`, hierarchyLevel: 'section',
        hierarchyPath: `${sub.hierarchyPath} > ${sectionNumber}`, parentId: sub.id,
        njacTitle: sub.njacTitle, njacTitleName: sub.njacTitleName,
        njacChapter: sub.njacChapter, njacChapterName: sub.njacChapterName,
        njacSubchapter: sub.njacSubchapter, njacSubchapterName: sub.njacSubchapterName,
        njacSection: sectionNumber, njacSectionName: topic,
        citation: `N.J.A.C. ${sectionNumber}`, levelIdentifier: sectionNumber, shortTitle: topic,
        url: `https://regulations.example.test/new-jersey/title-${sub.njacTitle}/chapter-${sub.njacChapter}/${sectionNumber.replace(/[:.]/g, '-')}`,
        content: makeContent(rng, topic, []),
        summary: summary(rng, topic),
        sectionType: SECTION_TYPES[nj.sections.length % SECTION_TYPES.length],
        keywords: [topic.toLowerCase()],
        appliesTo: ['providers'],
        hasForm: rng.chance(0.2),
        hasIbr: false,
      });
    }
  }
  all.push(...nj.titles, ...nj.chapters, ...nj.subchapters, ...nj.sections);

  // ---- New York City (ids from 200000) -------------------------------------
  const nyc: DocumentTree['nyc'] = { titles: [], chapters: [], sections: [] };
  let nycId = 200000;
  let nycSource = 0;
  nyc.titles.push({
    ...base, id: nycId++, sourceIndex: nycSource++, jurisdiction: 'NYC',
    title: 'Title 24 - Department of Health and Mental Hygiene', hierarchyLevel: 'title', hierarchyPath: 'Title 24',
    parentId: null, rcnyTitle: '24', rcnyTitleName: 'Department of Health and Mental Hygiene',
    citation: '24 RCNY', levelIdentifier: '24', shortTitle: 'Department of Health and Mental Hygiene',
    url: 'https://regulations.example.test/nyc/title-24',
    content: 'Title 24 of the Rules of the City of New York.',
  });
  for (const [ci, chapterName] of ['Food Service Establishments', 'Child Care Programs'].entries()) {
    const chapterNumber = String(ci + 1);
    nyc.chapters.push({
      ...base, id: nycId++, sourceIndex: nycSource++, jurisdiction: 'NYC',
      title: `Chapter ${chapterNumber} - ${chapterName}`, hierarchyLevel: 'chapter',
      hierarchyPath: `Title 24 > Chapter ${chapterNumber}`, parentId: nyc.titles[0].id,
      rcnyTitle: '24', rcnyTitleName: nyc.titles[0].rcnyTitleName, rcnyChapter: chapterNumber, rcnyChapterName: chapterName,
      citation: `24 RCNY Chapter ${chapterNumber}`, levelIdentifier: chapterNumber, shortTitle: chapterName,
      url: `https://regulations.example.test/nyc/title-24/chapter-${chapterNumber}`,
      content: `Chapter ${chapterNumber}: ${chapterName}.`,
    });
  }
  for (const chapter of nyc.chapters) {
    for (let s = 1; s <= 15; s++) {
      const sectionNumber = `${chapter.rcnyChapter}-${String(s).padStart(2, '0')}`;
      const topic = SECTION_TOPICS[(s * 5 + nyc.sections.length) % SECTION_TOPICS.length];
      nyc.sections.push({
        ...base, id: nycId++, sourceIndex: nycSource++, jurisdiction: 'NYC',
        title: `§ ${sectionNumber} ${topic}`, hierarchyLevel: 'section',
        hierarchyPath: `${chapter.hierarchyPath} > ${sectionNumber}`, parentId: chapter.id,
        rcnyTitle: '24', rcnyTitleName: chapter.rcnyTitleName, rcnyChapter: chapter.rcnyChapter, rcnyChapterName: chapter.rcnyChapterName,
        rcnySection: sectionNumber, rcnySectionName: topic,
        citation: `24 RCNY ${sectionNumber}`, levelIdentifier: sectionNumber, shortTitle: topic,
        url: `https://regulations.example.test/nyc/title-24/chapter-${chapter.rcnyChapter}/${sectionNumber}`,
        content: makeContent(rng, topic, []),
        summary: summary(rng, topic),
        sectionType: SECTION_TYPES[nyc.sections.length % SECTION_TYPES.length],
        keywords: [topic.toLowerCase()],
        appliesTo: ['establishments'],
        hasForm: false,
        hasIbr: false,
      });
    }
  }
  all.push(...nyc.titles, ...nyc.chapters, ...nyc.sections);

  return { all, ny, nj, nyc };
}

/**
 * Fill the precomputed hierarchy counters the browse tree reads
 * (direct_child_count, descendant_count). Call after all documents exist.
 */
export function applyHierarchyCounts(docs: SeedDocument[]): void {
  const children = new Map<number, SeedDocument[]>();
  for (const doc of docs) {
    if (doc.parentId == null) continue;
    const list = children.get(doc.parentId) ?? [];
    list.push(doc);
    children.set(doc.parentId, list);
  }
  const descendants = (doc: SeedDocument): number => {
    const kids = children.get(doc.id) ?? [];
    let total = kids.length;
    for (const kid of kids) total += descendants(kid);
    return total;
  };
  for (const doc of docs) {
    doc.directChildCount = (children.get(doc.id) ?? []).length;
    doc.descendantCount = descendants(doc);
  }
}

/**
 * Roll a per-document count up into descendant_* counters on every ancestor.
 * `own` maps document id -> count for that document itself.
 */
export function applyRollup(
  docs: SeedDocument[],
  own: Map<number, number>,
  setOwn: (doc: SeedDocument, n: number) => void,
  setDescendant: (doc: SeedDocument, n: number) => void,
): void {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const descendantTotals = new Map<number, number>();
  for (const doc of docs) {
    setOwn(doc, own.get(doc.id) ?? 0);
  }
  for (const doc of docs) {
    const n = own.get(doc.id) ?? 0;
    if (!n) continue;
    let parentId = doc.parentId;
    while (parentId != null) {
      descendantTotals.set(parentId, (descendantTotals.get(parentId) ?? 0) + n);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  for (const doc of docs) {
    setDescendant(doc, descendantTotals.get(doc.id) ?? 0);
  }
}
