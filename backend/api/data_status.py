"""
Data Status API Endpoints

Provides HTTP endpoints for checking data readiness for optimization.
"""

import os
import sys
from typing import Optional
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared_utils import get_db_connection

router = APIRouter()


# =============================================================================
# Models
# =============================================================================

class PromptType(str, Enum):
    RED_FLAGS = "red_flags_analysis"
    DEFINITION = "definition_extraction"


class DataReadinessLevel(str, Enum):
    INSUFFICIENT = "insufficient"  # Below minimum
    MINIMUM = "minimum"  # Can run BootstrapFewShot
    RECOMMENDED = "recommended"  # Can run COPRO effectively
    OPTIMAL = "optimal"  # Can run MIPROv2


class ReviewStatusBreakdown(BaseModel):
    """Breakdown of reviewed items by status."""
    confirmed: int = 0
    false_positive: int = 0
    corrected: int = 0
    deferred: int = 0
    needs_context: int = 0
    total_reviewed: int = 0
    total_unreviewed: int = 0


class DataReadiness(BaseModel):
    """Data readiness status for a prompt type."""
    prompt_type: str
    reviewed_count: int
    total_count: int
    minimum_threshold: int = 10
    recommended_threshold: int = 50
    optimal_threshold: int = 200
    readiness_level: DataReadinessLevel
    percentage_to_minimum: float
    percentage_to_recommended: float
    breakdown: ReviewStatusBreakdown
    can_optimize: bool
    recommended_optimizer: str
    message: str


class AllDataReadiness(BaseModel):
    """Data readiness for all prompt types."""
    red_flags: DataReadiness
    definitions: DataReadiness


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/readiness/{prompt_type}", response_model=DataReadiness)
async def get_readiness(prompt_type: PromptType) -> DataReadiness:
    """
    Get data readiness status for a specific prompt type.

    Returns the number of reviewed examples and whether optimization can be run.
    """
    return _get_readiness_for_type(prompt_type.value)


@router.get("/readiness", response_model=AllDataReadiness)
async def get_all_readiness() -> AllDataReadiness:
    """Get data readiness status for all prompt types."""
    return AllDataReadiness(
        red_flags=_get_readiness_for_type("red_flags_analysis"),
        definitions=_get_readiness_for_type("definition_extraction")
    )


@router.get("/stats")
async def get_database_stats():
    """Get general database statistics."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        stats = {}
        with conn.cursor() as cur:
            # Red flags stats
            cur.execute("SELECT COUNT(*) FROM red_flags")
            stats["red_flags_total"] = cur.fetchone()[0]

            cur.execute("""
                SELECT review_status, COUNT(*)
                FROM red_flags
                WHERE review_status IS NOT NULL
                GROUP BY review_status
            """)
            stats["red_flags_by_status"] = dict(cur.fetchall())

            # Compliance issues stats
            cur.execute("SELECT COUNT(*) FROM compliance_issues")
            stats["compliance_issues_total"] = cur.fetchone()[0]

            cur.execute("""
                SELECT review_status, COUNT(*)
                FROM compliance_issues
                WHERE review_status IS NOT NULL
                GROUP BY review_status
            """)
            stats["compliance_issues_by_status"] = dict(cur.fetchall())

            # Definitions stats
            cur.execute("SELECT COUNT(*) FROM definitions")
            stats["definitions_total"] = cur.fetchone()[0]

            cur.execute("""
                SELECT review_status, COUNT(*)
                FROM definitions
                WHERE review_status IS NOT NULL
                GROUP BY review_status
            """)
            stats["definitions_by_status"] = dict(cur.fetchall())

            # Documents stats
            cur.execute("SELECT COUNT(*) FROM regulatory_documents")
            stats["documents_total"] = cur.fetchone()[0]

        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# =============================================================================
# Helper Functions
# =============================================================================

def _get_readiness_for_type(prompt_type: str) -> DataReadiness:
    """Internal function to get readiness for a prompt type."""
    conn = get_db_connection()

    if not conn:
        return DataReadiness(
            prompt_type=prompt_type,
            reviewed_count=0,
            total_count=0,
            readiness_level=DataReadinessLevel.INSUFFICIENT,
            percentage_to_minimum=0,
            percentage_to_recommended=0,
            breakdown=ReviewStatusBreakdown(),
            can_optimize=False,
            recommended_optimizer="none",
            message="Database connection failed"
        )

    try:
        with conn.cursor() as cur:
            # Get table and query based on prompt type
            if prompt_type == "wet_signature_detection":
                table = "compliance_issues"
                extra_where = "AND issue_type = 'wet_signature'"
            elif prompt_type == "red_flags_analysis":
                table = "red_flags"
                extra_where = ""
            elif prompt_type == "definition_extraction":
                table = "definitions"
                extra_where = ""
            else:
                raise ValueError(f"Unknown prompt type: {prompt_type}")

            # Get breakdown by review status
            cur.execute(f"""
                SELECT
                    COALESCE(review_status, 'unreviewed') as status,
                    COUNT(*) as count
                FROM {table}
                WHERE 1=1 {extra_where}
                GROUP BY review_status
            """)

            breakdown = ReviewStatusBreakdown()
            total_count = 0

            for row in cur.fetchall():
                status, count = row
                total_count += count

                if status == 'confirmed':
                    breakdown.confirmed = count
                elif status == 'false_positive':
                    breakdown.false_positive = count
                elif status == 'corrected':
                    breakdown.corrected = count
                elif status == 'deferred':
                    breakdown.deferred = count
                elif status == 'needs_context':
                    breakdown.needs_context = count
                elif status == 'unreviewed' or status is None:
                    breakdown.total_unreviewed = count

            # Calculate total reviewed (usable for training)
            reviewed_count = (
                breakdown.confirmed +
                breakdown.false_positive +
                breakdown.corrected
            )
            breakdown.total_reviewed = reviewed_count

            # Determine readiness level
            min_threshold = 10
            rec_threshold = 50
            opt_threshold = 200

            if reviewed_count >= opt_threshold:
                level = DataReadinessLevel.OPTIMAL
                optimizer = "MIPROv2"
                message = f"Optimal data! Can use MIPROv2 for best results."
            elif reviewed_count >= rec_threshold:
                level = DataReadinessLevel.RECOMMENDED
                optimizer = "COPRO"
                message = f"Good data coverage. COPRO optimization recommended."
            elif reviewed_count >= min_threshold:
                level = DataReadinessLevel.MINIMUM
                optimizer = "BootstrapFewShot"
                message = f"Minimum data available. BootstrapFewShot can run."
            else:
                level = DataReadinessLevel.INSUFFICIENT
                optimizer = "none"
                needed = min_threshold - reviewed_count
                message = f"Need {needed} more reviewed items to run optimization."

            return DataReadiness(
                prompt_type=prompt_type,
                reviewed_count=reviewed_count,
                total_count=total_count,
                minimum_threshold=min_threshold,
                recommended_threshold=rec_threshold,
                optimal_threshold=opt_threshold,
                readiness_level=level,
                percentage_to_minimum=min(100, (reviewed_count / min_threshold) * 100),
                percentage_to_recommended=min(100, (reviewed_count / rec_threshold) * 100),
                breakdown=breakdown,
                can_optimize=reviewed_count >= min_threshold,
                recommended_optimizer=optimizer,
                message=message
            )

    except Exception as e:
        return DataReadiness(
            prompt_type=prompt_type,
            reviewed_count=0,
            total_count=0,
            readiness_level=DataReadinessLevel.INSUFFICIENT,
            percentage_to_minimum=0,
            percentage_to_recommended=0,
            breakdown=ReviewStatusBreakdown(),
            can_optimize=False,
            recommended_optimizer="none",
            message=f"Error: {str(e)}"
        )
    finally:
        conn.close()
