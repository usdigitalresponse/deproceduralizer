import { eq, asc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { agencies } from '../schema/agencies';
import { finesFeesPenalties } from '../schema/fines-fees-penalties';
import { type JurisdictionCode, normalizeJurisdiction } from '../schema/constants';

export interface AgencyOption {
  id: number;
  name: string;
}

export class AgenciesRepository extends BaseRepository {
  /** Get agencies that have at least 1 llm-confirmed fines row in the given jurisdiction */
  async getByJurisdiction(jurisdiction: JurisdictionCode): Promise<AgencyOption[]> {
    const stateUpper = normalizeJurisdiction(jurisdiction);

    const result = await this.db
      .selectDistinct({
        id: agencies.id,
        name: agencies.canonicalName,
      })
      .from(agencies)
      .innerJoin(finesFeesPenalties, eq(finesFeesPenalties.agencyId, agencies.id))
      .where(
        sql`${agencies.jurisdiction} = ${stateUpper} AND ${finesFeesPenalties.llmConfirmed} = true`
      )
      .orderBy(asc(agencies.canonicalName));

    return result;
  }
}
