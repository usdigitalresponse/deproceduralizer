import { describe, it, expect } from 'vitest';
import { buildFixtures } from './fixtures';
import { NJ_FIXED_SECTION_ID, NY_FIXED_PART } from './regulatory-documents';
import {
  coalescedClassification, HIGH_RISK_TYPES, NJ_LOW_SEVERITY_UNREVIEWED_MIN, NJ_HIGH_RISK_MIN,
  NJ_TIER3_ALL_FALSE_MIN, NY_REGULATION_BURDENSOME_MIN, NY_GUIDANCE_BURDENSOME_MIN,
} from './compliance';
import { BARRIER_HIGH_COMPLEXITY_MIN, NY_BARRIER_PART_MIN } from './barriers';

/**
 * These invariants are what the Playwright suite depends on. If a repository
 * query or a spec changes its data assumptions, update both the seed and this test.
 */
const f = buildFixtures();
const nyDocs = f.regulatoryDocuments.filter((d) => d.jurisdiction === 'NY');
const njDocs = f.regulatoryDocuments.filter((d) => d.jurisdiction === 'NJ');

describe('seed fixtures', () => {
  it('is deterministic', () => {
    const again = buildFixtures();
    expect(again.complianceIssueAnalyses.map((a) => a.severity)).toEqual(f.complianceIssueAnalyses.map((a) => a.severity));
  });

  it('has enough documents for comma-formatted dashboard totals', () => {
    expect(f.regulatoryDocuments.length).toBeGreaterThanOrEqual(1000);
    expect(nyDocs.length).toBeGreaterThanOrEqual(1200);
    const ids = new Set(f.regulatoryDocuments.map((d) => d.id));
    expect(ids.size).toBe(f.regulatoryDocuments.length);
  });

  it('builds a browsable hierarchy with precomputed counts', () => {
    const titles = f.regulatoryDocuments.filter((d) => d.hierarchyLevel === 'title' && d.parentId == null);
    expect(titles.filter((t) => t.jurisdiction === 'NY').length).toBeGreaterThan(0);
    expect(titles.filter((t) => t.jurisdiction === 'NJ').length).toBeGreaterThan(0);
    expect(titles.filter((t) => t.jurisdiction === 'NYC').length).toBeGreaterThan(0);
    for (const t of titles) {
      expect(t.directChildCount).toBeGreaterThan(0);
      expect(t.descendantCount).toBeGreaterThan(t.directChildCount!);
    }
    const njTitles = titles.filter((t) => t.jurisdiction === 'NJ');
    expect(njTitles.some((t) => (t.descendantComplianceIssueCount ?? 0) > 0)).toBe(true);
    expect(nyDocs.filter((d) => d.hierarchyLevel === 'section' && /health/i.test(d.title)).length).toBeGreaterThan(20);
    for (const d of f.regulatoryDocuments) {
      if (d.parentId != null) expect(d.hierarchyPath).toContain(' > ');
    }
  });

  it('includes the section ids and parts the specs hard-code', () => {
    const fixed = f.regulatoryDocuments.find((d) => d.id === NJ_FIXED_SECTION_ID);
    expect(fixed?.title).toMatch(/N\.J\. Admin\. Code/);
    expect(f.complianceIssueAnalyses.some((a) => a.documentId === NJ_FIXED_SECTION_ID && a.requirementFound === false)).toBe(true);
    const partSections = nyDocs.filter((d) => d.nycrrPart === NY_FIXED_PART);
    expect(partSections.length).toBeGreaterThan(0);
    const barrierDocIds = new Set(f.barrierAnalyses.map((a) => a.documentId));
    expect(partSections.filter((d) => barrierDocIds.has(d.id)).length).toBeGreaterThanOrEqual(NY_BARRIER_PART_MIN);
  });

  it('supports the composer document search', () => {
    const leaves = nyDocs.filter((d) => d.hierarchyLevel === 'section' && d.directChildCount === 0);
    expect(leaves.filter((d) => d.citation?.includes('10 NYCRR')).length).toBeGreaterThan(0);
    expect(leaves.filter((d) => d.content.includes('fire safety')).length).toBeGreaterThanOrEqual(10);
  });

  it('keys definitions by jurisdiction URL pattern', () => {
    const ny = f.definitions.filter((d) => d.url?.includes('new-york'));
    const nj = f.definitions.filter((d) => d.url?.includes('new-jersey'));
    expect(ny.length).toBeGreaterThan(40);
    expect(nj.length).toBeGreaterThan(0);
    expect(ny.every((d) => d.documentId != null)).toBe(true);
    expect(ny.filter((d) => d.reviewStatus === 'unreviewed').length).toBeGreaterThan(0);
    expect(ny.filter((d) => d.term.includes('person')).length).toBeGreaterThanOrEqual(5);
    const docUrls = new Map(f.regulatoryDocuments.map((d) => [d.id, d.url]));
    expect(f.definitions.every((d) => docUrls.get(d.documentId!) === d.url)).toBe(true);
  });

  it('covers every NJ compliance review bucket', () => {
    const nj = f.complianceIssueAnalyses.filter((a) => a.jurisdiction === 'NJ' && a.documentId != null);
    const confirmed = nj.filter((a) => a.requirementFound);
    const unreviewed = confirmed.filter((a) => a.reviewStatus === 'unreviewed');
    expect(unreviewed.filter((a) => (a.finalSeverity ?? 0) < 4).length).toBeGreaterThanOrEqual(NJ_LOW_SEVERITY_UNREVIEWED_MIN);
    expect(confirmed.filter((a) => a.reviewStatus === 'confirmed').length).toBeGreaterThanOrEqual(3);
    expect(unreviewed.filter((a) => a.issueType === 'wet_signature').length).toBeGreaterThanOrEqual(3);
    expect(nj.filter((a) => a.requirementFound === false).length).toBeGreaterThan(0);
    const types = new Set(nj.map((a) => a.issueType));
    for (const t of ['wet_signature', 'mail_only', 'certified_mail', 'fax_required', 'notarization', 'newspaper', 'microfiche']) {
      expect(types.has(t)).toBe(true);
    }
    const highRisk = nj.filter((a) =>
      HIGH_RISK_TYPES.includes(a.issueType as (typeof HIGH_RISK_TYPES)[number]) && (a.severity ?? 0) >= 7);
    expect(highRisk.length).toBeGreaterThanOrEqual(NJ_HIGH_RISK_MIN);
    const tier3AllFalse = nj.filter((a) => {
      const flags = a.tier3Flags as Record<string, { value: boolean }> | null | undefined;
      return a.tier3Classification != null && flags
        && flags.federal_mandate_confirmed?.value === false
        && flags.state_discretion_found?.value === false
        && flags.modernized_alternative_found?.value === false;
    });
    expect(tier3AllFalse.length).toBeGreaterThanOrEqual(NJ_TIER3_ALL_FALSE_MIN);
    for (const a of nj) {
      if (a.tier3Classification != null) expect(a.highestTierCompleted).toBe(3);
    }
  });

  it('gives NY analytics burdensome rows from both regulations and guidance', () => {
    const ny = f.complianceIssueAnalyses.filter((a) => a.jurisdiction === 'NY' && a.requirementFound);
    const reg = ny.filter((a) => a.documentId != null && coalescedClassification(a) === 'burdensome');
    const guid = ny.filter((a) => a.guidanceDocumentId != null && coalescedClassification(a) === 'burdensome');
    expect(reg.length).toBeGreaterThanOrEqual(NY_REGULATION_BURDENSOME_MIN);
    expect(guid.length).toBeGreaterThanOrEqual(NY_GUIDANCE_BURDENSOME_MIN);
  });

  it('respects one-source and uniqueness constraints', () => {
    for (const a of f.complianceIssueAnalyses) {
      expect((a.documentId != null ? 1 : 0) + (a.guidanceDocumentId != null ? 1 : 0)).toBe(1);
    }
    const regKeys = f.complianceIssueAnalyses.filter((a) => a.documentId != null).map((a) => `${a.documentId}:${a.issueType}`);
    expect(new Set(regKeys).size).toBe(regKeys.length);
    const guidKeys = f.complianceIssueAnalyses.filter((a) => a.guidanceDocumentId != null).map((a) => `${a.guidanceDocumentId}:${a.issueType}`);
    expect(new Set(guidKeys).size).toBe(guidKeys.length);
    const issueKeys = f.complianceIssues.filter((i) => i.documentId != null).map((i) => `${i.documentId}:${i.issueType}:${i.occurrenceNumber}`);
    expect(new Set(issueKeys).size).toBe(issueKeys.length);
    expect(f.complianceIssues.every((i) => i.analysisId != null && i.regexMatchContext.length > 0)).toBe(true);
    const barrierKeys = f.barrierIssues.map((i) => `${i.analysisId}:${i.category}`);
    expect(new Set(barrierKeys).size).toBe(barrierKeys.length);
    const xrefKeys = f.crossReferences.map((r) => `${r.sourceDocumentId}:${r.rawText}:${r.startOffset}`);
    expect(new Set(xrefKeys).size).toBe(xrefKeys.length);
    const sourceKeys = f.regulatoryDocuments.map((d) => `${d.jurisdiction}:${d.sourceIndex}:${d.type}`);
    expect(new Set(sourceKeys).size).toBe(sourceKeys.length);
  });

  it('covers the barrier queue filters', () => {
    const ny = f.barrierAnalyses.filter((a) => a.jurisdiction === 'NY');
    expect(ny.filter((a) => a.documentId != null).length).toBeGreaterThan(0);
    expect(ny.filter((a) => a.guidanceDocumentId != null).length).toBeGreaterThan(0);
    expect(f.barrierIssues.filter((i) => i.complexity === 'HIGH').length).toBeGreaterThanOrEqual(BARRIER_HIGH_COMPLEXITY_MIN);
    expect(f.barrierIssues.filter((i) => i.explanation.includes('child care')).length).toBeGreaterThanOrEqual(10);
    expect(f.barrierIssues.some((i) => i.isVerbatim) && f.barrierIssues.some((i) => !i.isVerbatim)).toBe(true);
  });

  it('seeds fines, guidance and cross-references for NY', () => {
    expect(f.finesFeesPenalties.filter((x) => x.jurisdiction === 'NY' && x.llmConfirmed).length).toBeGreaterThan(0);
    expect(f.guidanceDocuments.filter((g) => g.jurisdiction === 'NY').length).toBeGreaterThan(0);
    const nyRefs = f.crossReferences.filter((r) => r.jurisdiction === 'NY');
    expect(nyRefs.length).toBeGreaterThanOrEqual(1000);
    expect(nyRefs.some((r) => r.isResolved) && nyRefs.some((r) => !r.isResolved)).toBe(true);
    expect(njDocs.length).toBeGreaterThan(0);
  });
});
