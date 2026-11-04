#!/bin/bash
# Validate 5 new Barrier categories (Issue #202)
# Runs ~112 curated sections through the pipeline, then scores results.
#
# Usage: cd backend && bash scripts/validate_new_categories.sh
#
# Prerequisites:
#   - Migration 0056 must be applied first:
#     psql $DATABASE_URL < ../frontend/packages/database/migrations/0056_barrier_expand_categories.sql
#   - Or just run this script — it applies the migration automatically.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"
cd "$BACKEND_DIR"

# Load DATABASE_URL from .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi
if [ -z "${DATABASE_URL:-}" ]; then
    echo "Error: DATABASE_URL not found. Make sure .env file exists with DATABASE_URL set."
    exit 1
fi

echo "============================================"
echo "Barrier New Category Validation (Issue #202)"
echo "============================================"
echo ""

# Step 1: Apply migration
echo "[1/3] Applying migration 0056 (expand category CHECK constraint)..."
if ! psql "$DATABASE_URL" -f "$PROJECT_ROOT/frontend/packages/database/migrations/0056_barrier_expand_categories.sql" 2>&1; then
    echo ""
    echo "  WARNING: Migration command returned non-zero exit code."
    echo "  This is expected if the migration was already applied."
    echo "  If you see connection or permission errors above, fix them and re-run."
    echo ""
fi
echo "  Done."
echo ""

# Step 2: Run pipeline on curated test set
# 112 sections across 5 categories:
#   - FEE_COST_BURDENS: fee schedules from DEC(6), DOH(10), DFS(11), DOL(12), OMH(14), DOT(17), DSS(18)
#   - STATE_EXCEEDS_FEDERAL: sections with explicit "in addition to federal" language
#   - DEAD_SUPERSEDED_REFERENCES: sections citing defunct agencies (DSS, Commission on Quality of Care, etc.)
#   - DUPLICATIVE_REQUIREMENTS: multi-agency reporting from DOH(10), OMH(14), DSS(18)
#   - MISSING_DIGITAL_AUTHORIZATION: procedures/forms/reporting with no electronic language

DOC_IDS="74280 78467 78776 78830 79002 79314 79842 80789 80950 81444 81965 82736 82746 82835 83137 83299 84133 84388 84412 84557 98668 99518 99593 100317 100504 100872 101548 102158 102703 103266 105270 105487 105639 108099 108273 110706 111141 111403 113765 113966 115207 115876 117085 118401 118598 119253 119457 119788 119949 125473 127522 129402 129771 130030 133022 136191 138662 138796 140234 143455 144082 144579 144754 146341 146468 147642 151123 152089 152722 152872 153567 154468 154559 155204 155910 156731 157722 158965 159759 159950 162013 163156 167093 168150 168806 168953 171076 173402 176498 180801 180835 180889 181262 181903 182365 182601 184802 185008 185639 186319 186990 187834 188283 194379 194679 196421 198171 199662 200964 374428 377069 396627"

if [ -z "${DOC_IDS:-}" ]; then
    echo "ERROR: DOC_IDS is empty. This should not happen."
    exit 1
fi

echo "[2/3] Running Barrier pipeline on 112 curated sections (realtime mode)..."
echo "  This will cost ~\$3-5 and take ~10-15 minutes."
echo ""

python3 -m scripts.barrier_pipeline.cli \
  --state ny \
  --document-id $DOC_IDS \
  --execute \
  --realtime

echo ""
echo "[3/3] Scoring results..."
echo ""

# Query results for new categories
"$PROJECT_ROOT/scripts/db-query.sh" "
-- Detection rates for new categories
WITH test_docs AS (
  SELECT unnest(ARRAY[74280,78467,78776,78830,79002,79314,79842,80789,80950,81444,81965,82736,82746,82835,83137,83299,84133,84388,84412,84557,98668,99518,99593,100317,100504,100872,101548,102158,102703,103266,105270,105487,105639,108099,108273,110706,111141,111403,113765,113966,115207,115876,117085,118401,118598,119253,119457,119788,119949,125473,127522,129402,129771,130030,133022,136191,138662,138796,140234,143455,144082,144579,144754,146341,146468,147642,151123,152089,152722,152872,153567,154468,154559,155204,155910,156731,157722,158965,159759,159950,162013,163156,167093,168150,168806,168953,171076,173402,176498,180801,180835,180889,181262,181903,182365,182601,184802,185008,185639,186319,186990,187834,188283,194379,194679,196421,198171,199662,200964,374428,377069,396627]) AS doc_id
)
SELECT
  ji.category,
  count(*) as findings,
  count(DISTINCT ji.document_id) as unique_docs,
  round(avg(ji.severity), 1) as avg_severity,
  round(avg(ji.confidence)::numeric, 2) as avg_confidence,
  min(ji.severity) as min_sev,
  max(ji.severity) as max_sev
FROM barrier_issues ji
JOIN test_docs td ON td.doc_id = ji.document_id
WHERE ji.category IN (
  'FEE_COST_BURDENS', 'STATE_EXCEEDS_FEDERAL', 'DEAD_SUPERSEDED_REFERENCES',
  'DUPLICATIVE_REQUIREMENTS', 'MISSING_DIGITAL_AUTHORIZATION'
)
GROUP BY ji.category
ORDER BY ji.category;
"

echo ""
echo "-- All categories found (for context) --"
"$PROJECT_ROOT/scripts/db-query.sh" "
SELECT ji.category, count(*) as findings
FROM barrier_issues ji
WHERE ji.document_id IN (74280,78467,78776,78830,79002,79314,79842,80789,80950,81444,81965,82736,82746,82835,83137,83299,84133,84388,84412,84557,98668,99518,99593,100317,100504,100872,101548,102158,102703,103266,105270,105487,105639,108099,108273,110706,111141,111403,113765,113966,115207,115876,117085,118401,118598,119253,119457,119788,119949,125473,127522,129402,129771,130030,133022,136191,138662,138796,140234,143455,144082,144579,144754,146341,146468,147642,151123,152089,152722,152872,153567,154468,154559,155204,155910,156731,157722,158965,159759,159950,162013,163156,167093,168150,168806,168953,171076,173402,176498,180801,180835,180889,181262,181903,182365,182601,184802,185008,185639,186319,186990,187834,188283,194379,194679,196421,198171,199662,200964,374428,377069,396627)
GROUP BY ji.category
ORDER BY count(*) DESC;
"

echo ""
echo "-- Sample findings for each new category --"
for cat in FEE_COST_BURDENS STATE_EXCEEDS_FEDERAL DEAD_SUPERSEDED_REFERENCES DUPLICATIVE_REQUIREMENTS MISSING_DIGITAL_AUTHORIZATION; do
  echo ""
  echo "=== $cat ==="
  "$PROJECT_ROOT/scripts/db-query.sh" "
    SELECT rd.citation, ji.severity, ji.confidence, left(ji.explanation, 120) as explanation
    FROM barrier_issues ji
    JOIN regulatory_documents rd ON rd.id = ji.document_id
    WHERE ji.document_id IN (74280,78467,78776,78830,79002,79314,79842,80789,80950,81444,81965,82736,82746,82835,83137,83299,84133,84388,84412,84557,98668,99518,99593,100317,100504,100872,101548,102158,102703,103266,105270,105487,105639,108099,108273,110706,111141,111403,113765,113966,115207,115876,117085,118401,118598,119253,119457,119788,119949,125473,127522,129402,129771,130030,133022,136191,138662,138796,140234,143455,144082,144579,144754,146341,146468,147642,151123,152089,152722,152872,153567,154468,154559,155204,155910,156731,157722,158965,159759,159950,162013,163156,167093,168150,168806,168953,171076,173402,176498,180801,180835,180889,181262,181903,182365,182601,184802,185008,185639,186319,186990,187834,188283,194379,194679,196421,198171,199662,200964,374428,377069,396627)
      AND ji.category = '$cat'
    ORDER BY ji.severity DESC
    LIMIT 3;
  "
done

echo ""
echo "============================================"
echo "Validation complete!"
echo "============================================"
