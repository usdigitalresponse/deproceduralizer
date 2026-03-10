'use server';

import 'server-only';
import { db, regulatoryDocuments, guidanceDocuments, eq } from '@deproceduralizer/database';
import { type ActionResult, runAction } from './types';

export async function getRegulationContent(documentId: number): Promise<ActionResult<string | null>> {
  return runAction('getRegulationContent', async () => {
    const result = await db
      .select({ content: regulatoryDocuments.content })
      .from(regulatoryDocuments)
      .where(eq(regulatoryDocuments.id, documentId))
      .limit(1);
    return result[0]?.content ?? null;
  });
}

export async function getGuidanceContent(guidanceDocId: number): Promise<ActionResult<string | null>> {
  return runAction('getGuidanceContent', async () => {
    const result = await db
      .select({ content: guidanceDocuments.content })
      .from(guidanceDocuments)
      .where(eq(guidanceDocuments.id, guidanceDocId))
      .limit(1);
    return result[0]?.content ?? null;
  });
}
