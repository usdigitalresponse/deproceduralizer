'use server';

import { db, RegulatoryDocumentsRepository } from '@deproceduralizer/database';

const regulationsRepo = new RegulatoryDocumentsRepository(db);

export async function getRegulationsWithAnalysis() {
  const regulations = await regulationsRepo.getAllWithAnalysis();

  return regulations
    .filter(reg => reg.title)
    .map(reg => ({
      source_index: reg.sourceIndex ?? 0,
      title: reg.title,
      url: reg.url ?? '',
      content: reg.content,
      url_type: reg.urlType ?? '',
      hierarchy_level: reg.hierarchyLevel,
      hierarchy_path: reg.hierarchyPath,
      nycrr_title: reg.nycrrTitle,
      nycrr_part: reg.nycrrPart,
      nycrr_section: reg.nycrrSection,
      parent_source_index: reg.parentId,
      red_flags: reg.redFlags.map(flag => ({
        id: Number(flag.id),
        category: flag.category,
        explanation: flag.explanation,
        severity: flag.severity,
        complexity: flag.complexity,
        matched_phrases: flag.matchedPhrases || undefined,
        implementation_approach: flag.implementationApproach || undefined,
        effort_estimate: flag.effortEstimate || undefined,
        text_examples: flag.textExamples || undefined,
        review_status: flag.reviewStatus || undefined,
        reviewed_by: flag.reviewedBy || undefined,
        reviewed_at: flag.reviewedAt?.toISOString(),
        reviewer_notes: flag.reviewerNotes || undefined,
        priority: flag.priority || undefined,
        impact_type: flag.impactType || undefined,
      })),
      has_implementation_issues: reg.hasImplementationIssues ?? false,
      overall_complexity: reg.overallComplexity,
      summary: reg.summary,
      requires_technical_review: reg.requiresTechnicalReview ?? false,
      has_reporting_requirement: reg.hasReportingRequirement ?? false,
      max_severity: reg.maxSeverity ?? 0,
      num_flags: reg.numFlags ?? 0,
      categories: reg.redFlags.map(f => f.category).filter(Boolean).join(', '),
      explanations: reg.redFlags.map(f => f.explanation).filter(Boolean).join(' | '),
    }));
}
