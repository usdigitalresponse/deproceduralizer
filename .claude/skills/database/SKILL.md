---
name: database-access
description: Query and manage the Deproceduralizer Neon PostgreSQL database. Use when working with regulatory documents, analyses, red flags, definitions, or running database queries.
---

# Database Access

## Quick Commands

```bash
# Query helper script
./scripts/db-query.sh profile          # Full database profile
./scripts/db-query.sh tables           # Table row counts
./scripts/db-query.sh schema           # All table schemas
./scripts/db-query.sh stats            # Key statistics
./scripts/db-query.sh list-tables      # List all tables/views
./scripts/db-query.sh describe <table> # Describe specific table
./scripts/db-query.sh indexes <table>  # Show table indexes
./scripts/db-query.sh sample <table>   # Sample rows
./scripts/db-query.sh fkeys            # Foreign key relationships
./scripts/db-query.sh "<SQL>"          # Custom query
```

## Connection

- **Host**: `ep-REDACTED-pooler.c-3.us-east-1.aws.neon.tech`
- **Database**: `neondb`
- **Connection**: Via `DATABASE_URL` in `.env`

## Tables Overview

| Table | Purpose |
|-------|---------|
| `regulatory_documents` | Main table - regulatory docs with hierarchy (50 cols) |
| `statutes` | NJ statutes with hierarchy (title→chapter→section) |
| `analyses` | Analysis results per document |
| `red_flags` | Individual red flags (12 categories) |
| `definitions` | Extracted terms and definitions |
| `compliance_issues` | Wet signatures, in-person requirements |
| `statute_references` | Statute citations |
| `regulation_statute_links` | Regulation-to-statute links with link_type classification |
| `definition_extraction_log` | Tracks processed regulations |

**Views**: `latest_analyses`, `document_hierarchy`

## Reference Files

- **[schema.md](schema.md)** - Full table schemas, columns, constraints
- **[queries.md](queries.md)** - Common SQL patterns by domain
- **[maintenance.md](maintenance.md)** - Hierarchy recomputation, migrations, auditing
- **[bulk-operations.md](bulk-operations.md)** - Batch inserts, upserts, performance patterns

**Important**: When adding migrations or modifying schema, always update `schema.md` to reflect the changes.

## ORM Access

```typescript
import { db, RegulatoryDocumentsRepository, RedFlagsRepository } from '@deproceduralizer/database';

const docsRepo = new RegulatoryDocumentsRepository(db);
const doc = await docsRepo.getByIdWithAnalysis(123);
const stats = await docsRepo.getDashboardStats('NY');
```

## Key Files

- Schema: `frontend/packages/database/src/schema/`
- Client: `frontend/packages/database/src/client.ts`
- Repositories: `frontend/packages/database/src/repositories/`
- Server Actions: `frontend/apps/web/src/lib/actions/`
