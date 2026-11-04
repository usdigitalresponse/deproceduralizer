#!/usr/bin/env bash
# Check for accidental reintroduction of 'state' as a DB column reference
# in SQL strings. Run locally or in CI to prevent drift after the
# state → jurisdiction migration (migration 0054).
#
# Usage: bash backend/scripts/check_jurisdiction_drift.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$REPO_ROOT/backend"
DRIFT_FOUND=0

echo "Checking for jurisdiction drift in backend Python files..."

# Pattern: table_alias.state = or table_alias.state, (SQL column reference)
# Excludes: _legacy/, refine_patterns.py (local DuckDB), state_has_discretion,
#           state_discretion, ProcessingState, state_config, .state_code
HITS=$(grep -rn -E '\b(rd|cia|s|c|t|p|section|d|r)\.state[[:space:]]*[=,]' \
    --include='*.py' \
    --exclude-dir='_legacy' \
    --exclude='refine_patterns.py' \
    "$BACKEND/scripts/" "$BACKEND/tests/" "$BACKEND/lib/" \
    | grep -v 'state_has_discretion' \
    | grep -v 'state_discretion' \
    | grep -v 'state_config' \
    | grep -v '\.state_code' \
    | grep -v 'ProcessingState' \
    || true)

if [ -n "$HITS" ]; then
    echo "DRIFT DETECTED: SQL-context '.state =' references found:"
    echo "$HITS"
    DRIFT_FOUND=1
fi

# Pattern: WHERE state = (unqualified column reference in SQL)
HITS2=$(grep -rn -E 'WHERE[[:space:]]+state[[:space:]]*=' \
    --include='*.py' \
    --exclude-dir='_legacy' \
    --exclude='refine_patterns.py' \
    "$BACKEND/scripts/" "$BACKEND/tests/" "$BACKEND/lib/" \
    || true)

if [ -n "$HITS2" ]; then
    echo "DRIFT DETECTED: Unqualified 'WHERE state =' references found:"
    echo "$HITS2"
    DRIFT_FOUND=1
fi

# Pattern: dict keys "state" or 'state' holding jurisdiction values in pipeline query builders
HITS3=$(grep -rn -E "[\"']state[\"'][[:space:]]*:" \
    "$BACKEND/scripts/research_pipeline/db/document_queries.py" \
    "$BACKEND/scripts/research_pipeline/maintenance/recovery.py" \
    2>/dev/null || true)

if [ -n "$HITS3" ]; then
    echo "DRIFT DETECTED: Dict key 'state' in pipeline query builders:"
    echo "$HITS3"
    DRIFT_FOUND=1
fi

# Pattern 4: Dict key access ['state'] in pipeline runners (should be ['jurisdiction'])
HITS4=$(grep -rn -E "\['state'\]" \
    "$BACKEND/scripts/barrier_pipeline/pipeline_runner.py" \
    "$BACKEND/scripts/research_pipeline/db/document_queries.py" \
    "$BACKEND/scripts/research_pipeline/maintenance/recovery.py" \
    2>/dev/null || true)

if [ -n "$HITS4" ]; then
    echo "DRIFT DETECTED: Dict key access ['state'] in pipeline runners:"
    echo "$HITS4"
    DRIFT_FOUND=1
fi

if [ "$DRIFT_FOUND" -eq 1 ]; then
    echo ""
    echo "FAIL: Jurisdiction drift detected. Fix the above references."
    echo "If a reference is intentional, add it to the exclusion list in this script."
    exit 1
else
    echo "PASS: No jurisdiction drift detected."
    exit 0
fi
