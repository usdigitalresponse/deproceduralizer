import { relations } from 'drizzle-orm';
import { regulatoryDocuments } from './regulatory-documents';
import { analyses } from './analyses';
import { redFlags } from './red-flags';
import { statuteReferences } from './statute-references';
import { statutes } from './statutes';
import { regulationStatuteLinks } from './regulation-statute-links';
import { documentNotes } from './document-notes';
import { definitions } from './definitions';
import { definitionDocumentOccurrences } from './definition-document-occurrences';

export const regulatoryDocumentsRelations = relations(regulatoryDocuments, ({ one, many }) => ({
  parent: one(regulatoryDocuments, {
    fields: [regulatoryDocuments.parentId],
    references: [regulatoryDocuments.id],
    relationName: 'parentChild',
  }),
  children: many(regulatoryDocuments, { relationName: 'parentChild' }),
  analyses: many(analyses),
  statuteReferences: many(statuteReferences),
  statuteLinks: many(regulationStatuteLinks),
  notes: many(documentNotes),
  definitions: many(definitions),
}));

export const documentNotesRelations = relations(documentNotes, ({ one }) => ({
  document: one(regulatoryDocuments, {
    fields: [documentNotes.documentId],
    references: [regulatoryDocuments.id],
  }),
}));

export const analysesRelations = relations(analyses, ({ one, many }) => ({
  document: one(regulatoryDocuments, {
    fields: [analyses.documentId],
    references: [regulatoryDocuments.id],
  }),
  redFlags: many(redFlags),
}));

export const redFlagsRelations = relations(redFlags, ({ one }) => ({
  analysis: one(analyses, {
    fields: [redFlags.analysisId],
    references: [analyses.id],
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
