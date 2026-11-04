import type { Rng } from './rng';

/**
 * Templated regulatory-sounding prose. None of this is real regulation text;
 * it only has to look plausible and contain the phrases the e2e suite searches for.
 */

const SUBJECTS = [
  'The operator', 'Each licensee', 'The facility', 'An applicant', 'The provider',
  'The commissioner', 'Every employer', 'The permittee', 'A registrant', 'The department',
];

const VERBS = [
  'shall maintain', 'must submit', 'shall file', 'must retain', 'shall post',
  'must notify', 'shall document', 'must provide', 'shall establish', 'must review',
];

const OBJECTS = [
  'a written plan', 'the required records', 'an annual report', 'the application',
  'a copy of the certificate', 'the inspection log', 'a notice of change', 'the fee schedule',
  'evidence of compliance', 'the staffing roster',
];

const TAILS = [
  'within thirty days of the effective date of this section.',
  'in a form acceptable to the department.',
  'for a period of not less than six years.',
  'prior to the commencement of operations.',
  'upon request of the commissioner or an authorized representative.',
  'at each location where services are provided.',
  'no later than the first day of the following quarter.',
  'in accordance with the standards set forth in this Part.',
];

export function sentence(rng: Rng): string {
  return `${rng.pick(SUBJECTS)} ${rng.pick(VERBS)} ${rng.pick(OBJECTS)} ${rng.pick(TAILS)}`;
}

/** A paragraph of `count` sentences. */
export function paragraph(rng: Rng, count: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) parts.push(sentence(rng));
  return parts.join(' ');
}

/**
 * Section body: a few paragraphs with optional planted phrases. Planted phrases
 * are inserted as their own sentences so full-text search and ILIKE both find them.
 */
export function sectionContent(rng: Rng, planted: string[] = []): string {
  const paragraphs = [paragraph(rng, rng.int(3, 5)), paragraph(rng, rng.int(2, 4))];
  for (const phrase of planted) {
    paragraphs.splice(1, 0, `Requirements concerning ${phrase} apply as described in this section.`);
  }
  paragraphs.push(paragraph(rng, rng.int(2, 3)));
  return paragraphs.join('\n\n');
}

/** A short summary sentence. */
export function summary(rng: Rng, topic: string): string {
  return `Sets out ${topic.toLowerCase()} requirements, including filing, record retention, and notice obligations.`;
}

/** Title Case helper for generated names. */
export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}
