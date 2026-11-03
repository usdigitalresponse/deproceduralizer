# Database Schema

This folder holds the schema from our most recent database snapshot, with no data. Use it to create an empty database with every table, index, and constraint the app expects.

```bash
psql "$DATABASE_URL" -f data/db_backup/2026-05-15T20-22-11Z/schema.sql
```

**Note:** the full snapshots, with data, stay in our private `deproceduralizer-backup` archive. They include scraped regulation text and reviewer notes that we don't publish.

- **`schema.sql` ---** a `pg_dump --schema-only` of the `public` schema, taken 2026-05-15.
- **`sensitive/*.schema.sql` ---** schema-only dumps of the five tables that hold user data. `schema.sql` already creates them; these copies make them easy to inspect on their own.

To fill the database, see [Getting Data](../../README.md#getting-data) in the main README.
