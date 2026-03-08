---
name: cleanup
description: Track and execute cleanup tasks for test data and temporary operations. Use when tests or operations leave data that needs to be reverted.
---

# Cleanup Tasks

This skill tracks cleanup operations for test data and temporary changes.

## Quick Cleanup Commands

```bash
# E2E test data cleanup - uses SPECIFIC patterns to avoid deleting legitimate reviews
# Note: review columns are on compliance_issue_analyses (not compliance_issues) since PR 6.3
./scripts/db-query.sh "UPDATE compliance_issue_analyses SET review_status = 'unreviewed', reviewed_by = NULL, reviewed_at = NULL WHERE reviewed_by = 'E2E Test Reviewer' OR reviewed_by LIKE 'E2E Filter Test %' OR reviewed_by LIKE 'E2E All Filter Test %' RETURNING id;"

# Check for test data
./scripts/db-query.sh "SELECT id, reviewed_by FROM compliance_issue_analyses WHERE reviewed_by = 'E2E Test Reviewer' OR reviewed_by LIKE 'E2E Filter Test %' OR reviewed_by LIKE 'E2E All Filter Test %';"
```

## E2E Test Data Patterns

Tests use SPECIFIC identifiable patterns in `reviewed_by` field:
- `E2E Test Reviewer` - Review form submission tests (exact match) - **self-cleaning**
- `E2E Filter Test {timestamp}` - Filter behavior tests (starts with) - **self-cleaning**
- `E2E All Filter Test {timestamp}` - All-status filter tests (starts with) - partial cleanup (leaves reviewer name)
- `_` - Placeholder left by self-cleaning tests when clearing data (single underscore)

**IMPORTANT**: Only use these exact patterns in cleanup queries to avoid accidentally deleting legitimate reviews.

**Note**: Most tests are now self-cleaning and revert their changes. Manual cleanup should rarely be needed.

## When to Run Cleanup

1. **After E2E test failures** - Failed tests may not complete their cleanup phase
2. **After manual testing** - If you used E2E-like patterns in reviewer names
3. **Before deployments** - Ensure no test data is in production

## Self-Cleaning Tests

The filter behavior tests in `e2e/smoke.spec.ts` are self-cleaning:
- They revert status changes by navigating to the confirmed filter and changing status back to unreviewed
- Exception: The "stays visible when filter is all" test only adds reviewer/notes (no status change), so cleanup is optional

## Adding New Cleanup Tasks

When you create operations that modify data temporarily:

1. Use a recognizable pattern (e.g., `E2E Test`, `Temp Operation`)
2. Document the cleanup query in this file
3. Consider making the operation self-cleaning if possible

## Cleanup Queries Reference

### Compliance Issue Analyses
```sql
-- Reset E2E test reviews (SPECIFIC patterns only)
-- Note: review columns are on compliance_issue_analyses (not compliance_issues) since PR 6.3
UPDATE compliance_issue_analyses
SET review_status = 'unreviewed',
    reviewed_by = NULL,
    reviewed_at = NULL,
    team_notes = NULL,
    justification_notes = NULL
WHERE reviewed_by = 'E2E Test Reviewer'
   OR reviewed_by LIKE 'E2E Filter Test %'
   OR reviewed_by LIKE 'E2E All Filter Test %'
RETURNING id, reviewed_by;
```

### Definitions
```sql
-- Reset E2E definition reviews (SPECIFIC patterns only)
UPDATE definitions
SET review_status = 'unreviewed',
    reviewed_by = NULL,
    reviewed_at = NULL
WHERE reviewed_by = 'E2E Test Reviewer'
RETURNING id, reviewed_by;
```
