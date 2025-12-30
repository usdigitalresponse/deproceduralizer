#!/bin/bash
# Monitor batch and process when complete

BATCH_ID="$1"
if [ -z "$BATCH_ID" ]; then
    echo "Usage: $0 <batch_id>"
    exit 1
fi

echo "Monitoring batch: $BATCH_ID"
echo "Checking every 60 seconds..."
echo ""

while true; do
    echo "=== $(date '+%H:%M:%S') ==="

    # Get status
    STATUS=$(python3 backend/scripts/batch_definitions.py status --batch-id "$BATCH_ID" 2>&1)

    # Extract key metrics
    SUCCEEDED=$(echo "$STATUS" | grep "Succeeded:" | awk '{print $2}')
    ERRORED=$(echo "$STATUS" | grep "Errored:" | awk '{print $2}')
    PROCESSING=$(echo "$STATUS" | grep "Processing:" | awk '{print $2}')

    echo "  Succeeded: $SUCCEEDED | Errored: $ERRORED | Processing: $PROCESSING"

    # Check if complete (nothing left processing)
    if [ "$PROCESSING" = "0" ]; then
        echo ""
        echo "=========================================="
        echo "BATCH COMPLETE!"
        echo "=========================================="
        echo "Succeeded: $SUCCEEDED"
        echo "Errored: $ERRORED"
        echo ""
        exit 0
    fi

    sleep 60
done
