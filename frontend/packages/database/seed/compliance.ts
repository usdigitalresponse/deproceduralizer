import type { NewComplianceIssue, NewComplianceIssueAnalysis } from '../src/schema';
import type { Rng } from './rng';
import type { DocumentTree, SeedDocument } from './regulatory-documents';
import { NJ_FIXED_SECTION_ID } from './regulatory-documents';
import type { SeedGuidanceDocument } from './guidance-documents';

export interface SeedAnalysis extends NewComplianceIssueAnalysis {
  id: number;
  issueType: string;
  jurisdiction: string;
  requirementFound: boolean;
}

export interface SeedComplianceIssue extends NewComplianceIssue {
  id: number;
}

/**
 * Issue types used by the seed. The review-page filter test expects labels
 * containing: wet signature, mail, certified, fax, notarization, newspaper, microfiche.
 */
export const SEED_ISSUE_TYPES = [
  'wet_signature', 'mail_only', 'certified_mail', 'fax_required', 'notarization',
  'newspaper', 'microfiche', 'in_person_submission', 'physical_forms', 'original_document',
] as const;

const PHRASES: Record<(typeof SEED_ISSUE_TYPES)[number], string> = {
  wet_signature: 'an original wet signature',
  mail_only: 'submission by mail',
  certified_mail: 'delivery by certified mail, return receipt requested',
  fax_required: 'transmission by facsimile',
  notarization: 'a notarized affidavit',
  newspaper: 'publication in a newspaper of general circulation',
  microfiche: 'retention on microfiche',
  in_person_submission: 'delivery in person at the department office',
  physical_forms: 'completion of the prescribed paper form',
  original_document: 'production of the original document',
};

/** Issue types the pipeline page's `tier3Trigger=high_risk_issue` filter looks for. */
export const HIGH_RISK_TYPES = ['wet_signature', 'notarization', 'newspaper'] as const;

// Guaranteed bucket sizes (asserted by fixtures.test.ts and relied on by e2e specs).
export const NJ_CONFIRMED_COUNT = 180;
export const NJ_REJECTED_COUNT = 25;
export const NJ_LOW_SEVERITY_UNREVIEWED_MIN = 30;
export const NJ_CONFIRMED_REVIEWED_MIN = 6;
export const NJ_HIGH_RISK_MIN = 14;
export const NJ_TIER3_ALL_FALSE_MIN = 16;
export const NY_REGULATION_COUNT = 150;
export const NY_GUIDANCE_COUNT = 40;
export const NY_REGULATION_BURDENSOME_MIN = 60;
export const NY_GUIDANCE_BURDENSOME_MIN = 15;
export const NYC_REGULATION_COUNT = 10;
export const NJ_GUIDANCE_COUNT = 10;

type Classification = 'burdensome' | 'justified' | 'unrelated';

interface AnalysisSource {
  documentId?: number;
  guidanceDocumentId?: number;
  jurisdiction: string;
  url: string;
  content: string;
}

function flag(rng: Rng, value: boolean, reason: string) {
  return { value, scope: 'reg-specific', reason, evidence: value ? [{ url: 'https://example.test/evidence', source_type: 'government', quote: reason }] : [] };
}

export function coalescedClassification(a: SeedAnalysis): string | null {
  return a.tier3Classification ?? a.tier2Classification ?? a.tier1Classification ?? null;
}

function makeAnalysis(
  rng: Rng,
  id: number,
  source: AnalysisSource,
  issueType: (typeof SEED_ISSUE_TYPES)[number],
  requirementFound: boolean,
  completedAt: Date,
): SeedAnalysis {
  const phrase = PHRASES[issueType];
  const base: SeedAnalysis = {
    id,
    documentId: source.documentId ?? null,
    guidanceDocumentId: source.guidanceDocumentId ?? null,
    issueType,
    jurisdiction: source.jurisdiction,
    groupedMatchCount: rng.int(1, 3),
    tier1RelevantMatchIds: requirementFound ? [1] : [],
    tier1DismissedMatchIds: requirementFound ? [] : [1],
    tier1Classification: requirementFound ? 'needs_research' : 'all_false_positives',
    tier1Confidence: rng.float(0.7, 0.99),
    tier1Reasoning: requirementFound
      ? `The text requires ${phrase}, which is a concrete procedural requirement worth researching.`
      : `The text only mentions ${phrase} in passing; no requirement is imposed.`,
    tier1CompletedAt: completedAt,
    requirementFound,
    isJustified: false,
    isVerbatim: requirementFound,
    highestTierCompleted: 1,
    classificationTier: 1,
    pipelineVersion: 'v5',
    responsibleAgency: 'Department of Health',
    reviewStatus: 'unreviewed',
    developerStatus: 'unresolved',
    createdAt: completedAt,
    updatedAt: completedAt,
  };
  if (!requirementFound) return base;

  const classification: Classification = rng.chance(0.55) ? 'burdensome' : rng.chance(0.67) ? 'justified' : 'unrelated';
  const severity = rng.int(1, 10);
  const analysis: SeedAnalysis = {
    ...base,
    tier2Classification: classification,
    tier2Confidence: rng.float(0.6, 0.98),
    tier2Reasoning: `Requiring ${phrase} imposes a procedural step that could be met by an electronic alternative.`,
    verbatimRequirements: [`The applicant shall provide ${phrase}.`],
    severity,
    severityBaseline: severity,
    severityCalculation: 'baseline',
    argumentForRegulation: 'The requirement supports authentication and an audit trail.',
    argumentAgainstRegulation: 'Modern electronic methods achieve the same assurance with less burden.',
    contextUsed: [{ type: 'self', identifier: source.url, relevance: 'primary text' }],
    needsWebSearch: rng.chance(0.3),
    tier2CompletedAt: completedAt,
    tier2RerunCount: 0,
    finalSeverity: severity,
    isJustified: classification === 'justified',
    highestTierCompleted: 2,
    classificationTier: 2,
    reviewSummary: `Flags ${phrase} as a ${classification} requirement with severity ${severity}.`,
    easyCleanupCandidate: false,
  };
  if (rng.chance(0.15)) {
    analysis.easyCleanupCandidate = true;
    analysis.cleanupType = rng.pick(['alternative_in_practice', 'alternative_authorized', 'peer_state_solution'] as const);
    analysis.cleanupEffort = rng.pick(['trivial', 'easy', 'medium'] as const);
    analysis.cleanupEvidence = 'Peer agencies already accept electronic submissions.';
    analysis.cleanupRecommendation = 'Accept electronic equivalents.';
  }
  if (rng.chance(0.4)) {
    applyTier3(rng, analysis, completedAt, rng.chance(0.5), rng.chance(0.5), rng.chance(0.5));
  }
  const roll = rng.next();
  if (roll < 0.2) {
    markReviewed(analysis, 'confirmed', completedAt);
  } else if (roll < 0.3) {
    markReviewed(analysis, rng.pick(['needs_context', 'deferred', 'rejected_clear_fp'] as const), completedAt);
  }
  return analysis;
}

function applyTier3(
  rng: Rng,
  a: SeedAnalysis,
  completedAt: Date,
  federal: boolean,
  discretion: boolean,
  alternative: boolean,
): void {
  const tier2 = (a.tier2Classification ?? 'burdensome') as Classification;
  a.tier3Classification = rng.chance(0.2) && tier2 === 'burdensome' ? 'justified' : tier2;
  a.tier3Confidence = rng.float(0.6, 0.98);
  a.tier3Reasoning = 'Web verification found no federal mandate requiring this exact procedure.';
  a.tier3TriggerReason = HIGH_RISK_TYPES.includes(a.issueType as (typeof HIGH_RISK_TYPES)[number]) ? 'high_risk_issue' : 'federal_mandate_suspected';
  a.tier3SeverityAdjustment = 0;
  a.tier3CompletedAt = completedAt;
  a.tier3Flags = {
    superseded_by_law: flag(rng, false, 'No superseding statute found.'),
    federal_mandate_confirmed: flag(rng, federal, federal ? 'A federal rule requires the signature.' : 'No federal mandate found.'),
    state_discretion_found: flag(rng, discretion, discretion ? 'The state may choose the method.' : 'No explicit discretion found.'),
    modernized_alternative_found: flag(rng, alternative, alternative ? 'Electronic filing is authorized elsewhere.' : 'No modernized alternative found.'),
    advocacy_for_change: flag(rng, false, 'No advocacy coverage found.'),
  };
  a.federalMandateFound = federal;
  a.stateHasDiscretion = discretion;
  a.highestTierCompleted = 3;
  a.classificationTier = 3;
  a.isJustified = a.tier3Classification === 'justified';
}

function markReviewed(a: SeedAnalysis, status: string, at: Date): void {
  a.reviewStatus = status;
  a.reviewedBy = 'Seed Reviewer';
  a.reviewedAt = at;
  a.justificationNotes = status === 'confirmed' ? 'Confirmed on review of the full section text.' : null;
}

function forceClassification(a: SeedAnalysis, classification: Classification): void {
  a.tier2Classification = classification;
  if (a.tier3Classification) a.tier3Classification = classification;
  a.isJustified = classification === 'justified';
}

/** Plant the issue phrase in the document so the regex context is real text from it. */
function plantPhrase(doc: { content: string }, issueType: (typeof SEED_ISSUE_TYPES)[number]): string {
  const sentence = `Each submission must include ${PHRASES[issueType]} before it will be accepted.`;
  if (!doc.content.includes(sentence)) {
    doc.content = `${doc.content}\n\n${sentence}`;
  }
  const idx = doc.content.indexOf(sentence);
  return doc.content.slice(Math.max(0, idx - 250), idx + sentence.length + 250);
}

export interface ComplianceFixtures {
  analyses: SeedAnalysis[];
  issues: SeedComplianceIssue[];
}

export function buildCompliance(
  rng: Rng,
  tree: DocumentTree,
  guidance: SeedGuidanceDocument[],
  completedAt: Date,
): ComplianceFixtures {
  const analyses: SeedAnalysis[] = [];
  let nextId = 1;
  const docSource = (doc: SeedDocument): AnalysisSource => ({
    documentId: doc.id, jurisdiction: doc.jurisdiction!, url: doc.url, content: doc.content,
  });
  const guidanceSource = (doc: SeedGuidanceDocument): AnalysisSource => ({
    guidanceDocumentId: doc.id, jurisdiction: doc.jurisdiction, url: doc.url, content: doc.content,
  });
  const nyGuidance = guidance.filter((g) => g.jurisdiction === 'NY');
  const njGuidance = guidance.filter((g) => g.jurisdiction === 'NJ');

  // ---- NJ: confirmed requirements on distinct sections ----------------------
  const njConfirmed: SeedAnalysis[] = [];
  for (let i = 0; i < NJ_CONFIRMED_COUNT; i++) {
    const doc = tree.nj.sections[i];
    const issueType = SEED_ISSUE_TYPES[i % SEED_ISSUE_TYPES.length];
    njConfirmed.push(makeAnalysis(rng, nextId++, docSource(doc), issueType, true, completedAt));
  }
  // Guarantees for the review-queue, mutation, pipeline-filter and sorting tests.
  const lowRows = njConfirmed.slice(0, NJ_LOW_SEVERITY_UNREVIEWED_MIN);
  for (const a of lowRows) {
    a.severity = rng.int(1, 3);
    a.finalSeverity = a.severity;
    a.severityBaseline = a.severity;
    a.reviewStatus = 'unreviewed';
    a.reviewedBy = null;
    a.reviewedAt = null;
  }
  for (const a of njConfirmed.slice(NJ_LOW_SEVERITY_UNREVIEWED_MIN, NJ_LOW_SEVERITY_UNREVIEWED_MIN + NJ_CONFIRMED_REVIEWED_MIN)) {
    markReviewed(a, 'confirmed', completedAt);
  }
  let highRisk = 0;
  for (const a of njConfirmed) {
    if (lowRows.includes(a)) continue;
    if (!HIGH_RISK_TYPES.includes(a.issueType as (typeof HIGH_RISK_TYPES)[number])) continue;
    if (highRisk >= NJ_HIGH_RISK_MIN) break;
    a.severity = rng.int(7, 10);
    a.finalSeverity = a.severity;
    a.severityBaseline = a.severity;
    highRisk++;
  }
  let tier3AllFalse = 0;
  for (const a of njConfirmed) {
    if (tier3AllFalse >= NJ_TIER3_ALL_FALSE_MIN) break;
    applyTier3(rng, a, completedAt, false, false, false);
    tier3AllFalse++;
  }
  analyses.push(...njConfirmed);

  // ---- NJ: LLM-rejected matches (requirement_found = false) -----------------
  for (let i = 0; i < NJ_REJECTED_COUNT; i++) {
    const doc = tree.nj.sections[NJ_CONFIRMED_COUNT + i];
    const issueType = SEED_ISSUE_TYPES[(i + 3) % SEED_ISSUE_TYPES.length];
    analyses.push(makeAnalysis(rng, nextId++, docSource(doc), issueType, false, completedAt));
  }
  // The section smoke.spec.ts visits directly also carries a rejected match.
  const fixedDoc = tree.nj.sections.find((d) => d.id === NJ_FIXED_SECTION_ID)!;
  const fixedTypes = new Set(analyses.filter((a) => a.documentId === fixedDoc.id).map((a) => a.issueType));
  const rejectedType = SEED_ISSUE_TYPES.find((t) => !fixedTypes.has(t))!;
  analyses.push(makeAnalysis(rng, nextId++, docSource(fixedDoc), rejectedType, false, completedAt));

  // ---- NY: regulation-sourced and guidance-sourced --------------------------
  const nyReg: SeedAnalysis[] = [];
  for (let i = 0; i < NY_REGULATION_COUNT; i++) {
    const doc = tree.ny.sections[(i * 5) % tree.ny.sections.length];
    const issueType = SEED_ISSUE_TYPES[i % SEED_ISSUE_TYPES.length];
    nyReg.push(makeAnalysis(rng, nextId++, docSource(doc), issueType, true, completedAt));
  }
  nyReg.slice(0, NY_REGULATION_BURDENSOME_MIN).forEach((a) => forceClassification(a, 'burdensome'));
  analyses.push(...nyReg);

  const nyGuid: SeedAnalysis[] = [];
  for (let i = 0; i < NY_GUIDANCE_COUNT; i++) {
    const doc = nyGuidance[i % nyGuidance.length];
    const issueType = SEED_ISSUE_TYPES[(i * 3) % SEED_ISSUE_TYPES.length];
    nyGuid.push(makeAnalysis(rng, nextId++, guidanceSource(doc), issueType, true, completedAt));
  }
  nyGuid.slice(0, NY_GUIDANCE_BURDENSOME_MIN).forEach((a) => forceClassification(a, 'burdensome'));
  analyses.push(...nyGuid);

  // ---- NYC regulations and NJ guidance --------------------------------------
  for (let i = 0; i < NYC_REGULATION_COUNT; i++) {
    const doc = tree.nyc.sections[i % tree.nyc.sections.length];
    analyses.push(makeAnalysis(rng, nextId++, docSource(doc), SEED_ISSUE_TYPES[i % SEED_ISSUE_TYPES.length], true, completedAt));
  }
  for (let i = 0; i < NJ_GUIDANCE_COUNT; i++) {
    const doc = njGuidance[i % njGuidance.length];
    analyses.push(makeAnalysis(rng, nextId++, guidanceSource(doc), SEED_ISSUE_TYPES[i % SEED_ISSUE_TYPES.length], true, completedAt));
  }

  // ---- compliance_issues: the regex matches behind each analysis ------------
  const docById = new Map(tree.all.map((d) => [d.id, d]));
  const guidanceById = new Map(guidance.map((g) => [g.id, g]));
  const issues: SeedComplianceIssue[] = [];
  let issueId = 1;
  for (const a of analyses) {
    const source = a.documentId != null ? docById.get(a.documentId)! : guidanceById.get(a.guidanceDocumentId!)!;
    const issueType = a.issueType as (typeof SEED_ISSUE_TYPES)[number];
    const context = plantPhrase(source, issueType);
    const occurrences = a.jurisdiction === 'NJ' && a.documentId != null && a.id % 5 === 0 ? 2 : 1;
    for (let n = 1; n <= occurrences; n++) {
      issues.push({
        id: issueId++,
        documentId: a.documentId ?? null,
        guidanceDocumentId: a.guidanceDocumentId ?? null,
        issueType,
        occurrenceNumber: n,
        url: source.url,
        regexMatchPattern: PHRASES[issueType].split(' ').slice(-2).join(' '),
        regexMatchContext: context,
        jurisdiction: a.jurisdiction,
        createdAt: completedAt,
        runId: 'seed-run-0001',
        analysisId: a.id,
      });
    }
  }

  return { analyses, issues };
}
