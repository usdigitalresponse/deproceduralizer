/**
 * Seed the local e2e database with deterministic synthetic fixtures.
 *
 *   E2E_DATABASE_URL_DIRECT=postgres://postgres:postgres@localhost:5432/deproceduralizer_e2e \
 *     pnpm --filter @deproceduralizer/database seed:e2e
 *
 * Connects directly with node-postgres (the app itself goes through the Neon
 * proxy). Refuses to run against anything that is not a local host.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../src/schema';
import { buildFixtures } from './fixtures';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'db.localtest.me']);

/** Tables seeded with explicit ids; order matters for foreign keys. */
const SEEDED_TABLES = [
  'agencies', 'regulatory_documents', 'guidance_documents', 'definitions',
  'compliance_issue_analyses', 'compliance_issues', 'barrier_analyses', 'barrier_issues',
  'fines_fees_penalties', 'cross_references',
] as const;

function resolveUrl(): string {
  const url = process.env.E2E_DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Set E2E_DATABASE_URL_DIRECT (or DATABASE_URL) to a local Postgres URL');
  }
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to seed non-local host "${host}". The seed wipes tables.`);
  }
  return url;
}

async function main(): Promise<void> {
  const started = Date.now();
  const fixtures = buildFixtures();
  const pool = new Pool({ connectionString: resolveUrl() });
  const db = drizzle(pool, { schema });

  const tableList = SEEDED_TABLES.map((t) => `"${t}"`).join(', ');
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));

    const insert = async <T extends PgTable>(name: string, table: T, rows: T['$inferInsert'][], chunk = 300) => {
      for (let i = 0; i < rows.length; i += chunk) {
        await tx.insert(table).values(rows.slice(i, i + chunk));
      }
      console.log(`  ${name.padEnd(28)} ${String(rows.length).padStart(6)} rows`);
    };

    await insert('agencies', schema.agencies, fixtures.agencies);
    await insert('regulatory_documents', schema.regulatoryDocuments, fixtures.regulatoryDocuments);
    await insert('guidance_documents', schema.guidanceDocuments, fixtures.guidanceDocuments);
    await insert('definitions', schema.definitions, fixtures.definitions);
    await insert('compliance_issue_analyses', schema.complianceIssueAnalyses, fixtures.complianceIssueAnalyses);
    await insert('compliance_issues', schema.complianceIssues, fixtures.complianceIssues);
    await insert('barrier_analyses', schema.barrierAnalyses, fixtures.barrierAnalyses);
    await insert('barrier_issues', schema.barrierIssues, fixtures.barrierIssues);
    await insert('fines_fees_penalties', schema.finesFeesPenalties, fixtures.finesFeesPenalties);
    await insert('cross_references', schema.crossReferences, fixtures.crossReferences);

    // Explicit ids bypass the sequences; move them past the seeded max.
    for (const table of SEEDED_TABLES) {
      await tx.execute(sql.raw(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
      ));
    }
  });

  await pool.end();
  console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
