import type { NewGuidanceDocument } from '../src/schema';
import { POLICY_CATEGORIES } from '../src/schema';
import type { Rng } from './rng';
import { paragraph } from './text';
import type { SeedAgency } from './agencies';
import { agenciesFor } from './agencies';

export interface SeedGuidanceDocument extends NewGuidanceDocument {
  id: number;
  content: string;
  url: string;
}

const DOC_TYPES = ['ADM', 'INF', 'GIS', 'LCM'] as const;
const TOPICS = [
  'Provider enrollment procedures', 'Annual reporting reminders', 'Fee schedule update',
  'Health and safety inspections', 'Child care subsidy eligibility', 'Record retention guidance',
  'Incident reporting clarification', 'Licensing renewal timelines', 'Background check requirements',
  'Electronic submission pilot',
];

export function buildGuidanceDocuments(
  rng: Rng,
  agencies: SeedAgency[],
  createdAt: Date,
): SeedGuidanceDocument[] {
  const counts: Array<[string, number]> = [['NY', 40], ['NJ', 10], ['NYC', 5]];
  const docs: SeedGuidanceDocument[] = [];
  let id = 1;
  for (const [jurisdiction, count] of counts) {
    const pool = agenciesFor(agencies, jurisdiction);
    for (let i = 0; i < count; i++) {
      const agency = pool[i % pool.length];
      const year = 2015 + (i % 10);
      const docType = DOC_TYPES[i % DOC_TYPES.length];
      const topic = TOPICS[i % TOPICS.length];
      const ref = `${String(year).slice(2)}-${agency.abbreviation}-${docType}-${String(i + 1).padStart(2, '0')}`;
      const body = paragraph(rng, rng.int(6, 10));
      docs.push({
        id,
        canonicalRef: ref,
        catalogId: `cat-${jurisdiction.toLowerCase()}-${id}`,
        title: `${ref}: ${topic}`,
        agency: agency.canonicalName,
        agencyDivision: 'Division of Program Operations',
        docType,
        domain: 'health_and_human_services',
        policyCategory: POLICY_CATEGORIES[i % POLICY_CATEGORIES.length],
        isAttachment: false,
        datePublished: `${year}-${String((i % 12) + 1).padStart(2, '0')}-15`,
        year,
        content: `${topic}.\n\n${body}`,
        url: `https://guidance.example.test/${jurisdiction.toLowerCase()}/${ref}`,
        fileFormat: 'pdf',
        status: 'active',
        senderName: 'Director of Program Operations',
        distributionTo: ['Licensed providers'],
        programs: ['Licensing'],
        sourceProject: 'e2e-seed',
        jurisdiction,
        targetAudience: ['providers'],
        isApplication: false,
        summary: `Explains ${topic.toLowerCase()} for licensed providers.`,
        sectionType: 'procedures',
        keywords: [topic.toLowerCase()],
        appliesTo: ['providers'],
        hasForm: i % 4 === 0,
        hasIbr: false,
        audienceDirection: 'external',
        audienceExpertise: 'practitioner',
        fleschKincaidGrade: rng.float(9, 15, 1),
        fleschReadingEase: rng.float(25, 65, 1),
        gunningFog: rng.float(10, 18, 1),
        automatedReadabilityIndex: rng.float(9, 15, 1),
        colemanLiauIndex: rng.float(9, 15, 1),
        smogIndex: rng.float(10, 16, 1),
        daleChallReadabilityScore: rng.float(7, 11, 1),
        linsearWriteFormula: rng.float(9, 15, 1),
        readingGradeLevel: '12th and 13th grade',
        difficultWordCount: rng.int(40, 120),
        wordCount: body.split(/\s+/).length,
        sentenceCount: body.split('. ').length,
        createdAt,
        updatedAt: createdAt,
      });
      id++;
    }
  }
  return docs;
}
