#!/usr/bin/env bash
# Run Barrier pipeline on all childcare-related parts of Title 18 NYCRR.
#
# Core childcare parts:
#   413-419: Child day care licensing (day care centers, family homes, school-age, group family)
#   420-427: Adoption & foster care
#   428-440: Child welfare & protective services (preventive services, abuse/maltreatment, kinship)
#   441-451: Child-care agencies (institutions, foster boarding homes, group homes, SILPs)
#   476-477: Operating certificates for children's facilities
#
# Usage:
#   cd backend
#   # Dry run first (no --execute):
#   bash scripts/run_childcare_barriers.sh
#
#   # Actually run:
#   bash scripts/run_childcare_barriers.sh --execute

set -euo pipefail

cd "$(dirname "$0")/.."

EXTRA_ARGS=("$@")

# All childcare-related parts in Title 18
CHILDCARE_PARTS=(
    # Child day care definitions, licensing & enforcement
    413 414 415 416 417 418 419
    # Adoption & foster care
    420 421 422 423 424 425 426 427
    # Child welfare, protective services, case records
    428 429 430 431 432 433 434 435 436 437 439 440
    # Child-care agencies
    441 442 443 444 445 446 447 448 449 450 451
    # Operating certificates - children's facilities
    476 477
)

TOTAL=${#CHILDCARE_PARTS[@]}
echo "============================================================"
echo "  Barrier Childcare Analysis - Title 18 NYCRR"
echo "  ${TOTAL} parts to process"
echo "  Extra args: ${EXTRA_ARGS[*]:-none}"
echo "============================================================"
echo ""

COMPLETED=0
SKIPPED=0
FAILED=0

for PART in "${CHILDCARE_PARTS[@]}"; do
    COMPLETED=$((COMPLETED + 1))
    echo "--- [${COMPLETED}/${TOTAL}] Part ${PART} ---"

    if python3 -m scripts.barrier_pipeline \
        --state ny \
        --title 18 \
        --part "$PART" \
        "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"; then
        echo "  Part ${PART}: done"
    else
        EXIT_CODE=$?
        FAILED=$((FAILED + 1))
        echo "  Part ${PART}: FAILED (exit code ${EXIT_CODE})"
    fi
    echo ""
done

echo "============================================================"
echo "  Complete: ${COMPLETED}/${TOTAL} parts attempted"
echo "  Failed: ${FAILED}"
echo "============================================================"
