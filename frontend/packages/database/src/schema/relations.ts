import { relations } from 'drizzle-orm';
import { regulatoryDocuments } from './regulatory-documents';
import { statuteReferences } from './statute-references';
import { statutes } from './statutes';
import { regulationStatuteLinks } from './regulation-statute-links';
import { documentNotes } from './document-notes';
import { definitions } from './definitions';
import { definitionDocumentOccurrences } from './definition-document-occurrences';
import { crossReferences } from './cross-references';
import { complianceIssueAnalyses } from './compliance-issue-analyses';
import { jenaiAnalyses } from './jenai-analyses';
import { jenaiIssues } from './jenai-issues';
import { documentTags } from './document-tags';

export const regulatoryDocumentsRelations = relations(regulatoryDocuments, ({ one, many }) => ({
  parent: one(regulatoryDocuments, {
    fields: [regulatoryDocuments.parentId],
    references: [regulatoryDocuments.id],
    relationName: 'parentChild',
  }),
  children: many(regulatoryDocuments, { relationName: 'parentChild' }),
  statuteReferences: many(statuteReferences),
  statuteLinks: many(regulationStatuteLinks),
  notes: many(documentNotes),
  definitions: many(definitions),
  // Cross-references: citations FROM this document to other documents
  crossReferencesFrom: many(crossReferences, { relationName: 'sourceDoc' }),
  // Cross-references: citations TO this document from other documents
  crossReferencesTo: many(crossReferences, { relationName: 'targetDoc' }),
  tags: many(documentTags),
}));

export const documentNotesRelations = relations(documentNotes, ({ one }) => ({
  document: one(regulatoryDocuments, {
    fields: [documentNotes.documentId],
    references: [regulatoryDocuments.id],
  }),
}));

export const statuteReferencesRelations = relations(statuteReferences, ({ one }) => ({
  document: one(regulatoryDocuments, {
    fields: [statuteReferences.documentId],
    references: [regulatoryDocuments.id],
  }),
}));

export const definitionsRelations = relations(definitions, ({ one, many }) => ({
  document: one(regulatoryDocuments, {
    fields: [definitions.documentId],
    references: [regulatoryDocuments.id],
    relationName: 'definitionSource',
  }),
  scopeDocument: one(regulatoryDocuments, {
    fields: [definitions.scopeDocumentId],
    references: [regulatoryDocuments.id],
    relationName: 'definitionScope',
  }),
  // Documents where this definition's term actually appears in the text
  occurrences: many(definitionDocumentOccurrences),
}));

export const definitionDocumentOccurrencesRelations = relations(
  definitionDocumentOccurrences,
  ({ one }) => ({
    definition: one(definitions, {
      fields: [definitionDocumentOccurrences.definitionId],
      references: [definitions.id],
    }),
    document: one(regulatoryDocuments, {
      fields: [definitionDocumentOccurrences.documentId],
      references: [regulatoryDocuments.id],
    }),
  })
);

// Statutes table relations (self-referencing hierarchy + links to regulations)
export const statutesRelations = relations(statutes, ({ one, many }) => ({
  parent: one(statutes, {
    fields: [statutes.parentId],
    references: [statutes.id],
    relationName: 'statuteParentChild',
  }),
  children: many(statutes, { relationName: 'statuteParentChild' }),
  regulationLinks: many(regulationStatuteLinks),
}));

// Regulation-statute links crosswalk table relations
export const regulationStatuteLinksRelations = relations(regulationStatuteLinks, ({ one }) => ({
  regulation: one(regulatoryDocuments, {
    fields: [regulationStatuteLinks.regulationId],
    references: [regulatoryDocuments.id],
  }),
  statute: one(statutes, {
    fields: [regulationStatuteLinks.statuteId],
    references: [statutes.id],
  }),
}));

// Cross-references table relations
export const crossReferencesRelations = relations(crossReferences, ({ one }) => ({
  sourceDocument: one(regulatoryDocuments, {
    fields: [crossReferences.sourceDocumentId],
    references: [regulatoryDocuments.id],
    relationName: 'sourceDoc',
  }),
  targetDocument: one(regulatoryDocuments, {
    fields: [crossReferences.targetDocumentId],
    references: [regulatoryDocuments.id],
    relationName: 'targetDoc',
  }),
}));

// Compliance issue analyses table relations (4-tier research pipeline)
export const complianceIssueAnalysesRelations = relations(complianceIssueAnalyses, ({ one }) => ({
  document: one(regulatoryDocuments, {
    fields: [complianceIssueAnalyses.documentId],
    references: [regulatoryDocuments.id],
  }),
}));

// JenAI analyses table relations (2-tier implementation analysis)
export const jenaiAnalysesRelations = relations(jenaiAnalyses, ({ one, many }) => ({
  document: one(regulatoryDocuments, {
    fields: [jenaiAnalyses.documentId],
    references: [regulatoryDocuments.id],
  }),
  issues: many(jenaiIssues),
}));

export const jenaiIssuesRelations = relations(jenaiIssues, ({ one }) => ({
  analysis: one(jenaiAnalyses, {
    fields: [jenaiIssues.analysisId],
    references: [jenaiAnalyses.id],
  }),
  document: one(regulatoryDocuments, {
    fields: [jenaiIssues.documentId],
    references: [regulatoryDocuments.id],
  }),
}));


// Document tags relations
export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(regulatoryDocuments, {
    fields: [documentTags.documentId],
    references: [regulatoryDocuments.id],
  }),
}));
