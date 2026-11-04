import 'server-only';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Local development and CI run Postgres behind a local Neon proxy
// (see docker-compose.e2e.yml). The HTTP driver normally posts to
// https://<host>/sql; point it at the proxy instead when the env var is set.
// Leave NEON_LOCAL_PROXY_URL unset in production.
const localProxy = process.env.NEON_LOCAL_PROXY_URL;
if (localProxy) {
  const base = localProxy.replace(/\/$/, '');
  neonConfig.fetchEndpoint = () => `${base}/sql`;
  // Only used if a Pool/Client is ever created; kept consistent for completeness.
  neonConfig.useSecureWebSocket = base.startsWith('https');
  neonConfig.wsProxy = () => `${base.replace(/^https?:\/\//, '')}/v1`;
}

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema });
export type Database = typeof db;
