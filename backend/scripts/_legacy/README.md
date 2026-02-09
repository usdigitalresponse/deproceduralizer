# Legacy Scripts

This directory contains **completed one-time scripts** that have been moved here for reference. They are no longer operationally active.

## Contents

| Script | Original Purpose | Why Moved |
|--------|-----------------|-----------|
| `backfill_is_verbatim.py` | One-time backfill of `is_verbatim` field on definitions | Backfill complete, no ongoing use |
| `verify_migrations.py` | Verified DB state after migrations 0031-0037 | Migrations long since applied |
| `backfill_legacy_analyses.py` | Migrated `compliance_issues` data to `compliance_issue_analyses` table (PR 6.3) | Migration complete |
| `local_summarization/` | Ollama-based local batch summarization (replaced by Anthropic Batch API) | Superseded by `lib.batch.BatchManager` |

## Note

These scripts may have stale imports or dependencies. They are preserved for historical reference only and should not be run without review.
