"""Tier 3 routing and escalation logic.

Centralizes the rules for when a processing unit should be escalated
to Tier 3 (web search validation).

V5: Tier 3 is the web search tier (merged from old Tier 4).
Units are escalated to Tier 3 when they meet one of the canonical
trigger conditions that require external verification.

V5.1: Data-driven routing improvements based on NJ Title 13 analysis:
- High-risk + justified items escalate regardless of severity (54-63% valuable)
- Low confidence (<0.85) with severity >= 6 escalates (44% valuable)
- High confidence + burdensome + high severity skipped (only 17% valuable)
- 10% random sampling for quality assurance and ongoing analysis
"""

import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .state_machine import TrackedUnit


# Random sampling rate for items that don't meet other criteria
RANDOM_SAMPLE_RATE = 0.10  # 10%

# Confidence threshold - items below this are more likely to benefit from Tier 3
LOW_CONFIDENCE_THRESHOLD = 0.85


# =============================================================================
# High-Risk Issue Types
# =============================================================================

# Issue types that escalate to Tier 3 when severity >= 6.
# These are high-impact or frequently challenged requirements that benefit
# from external verification via web search when sufficiently severe.
HIGH_RISK_ISSUE_TYPES = frozenset({
    "newspaper",        # Public notice requirements
    "notarization",     # Notarization requirements
    "wet_signature",    # Physical signature requirements
    "witness",          # Witness requirements
    "mandated_reports", # Mandated reporting requirements
})

# Prefixes for issue types that are high-risk (e.g., in_person_*)
# Matches: in_person_submission, in_person_appearance, in_person_pickup, etc.
HIGH_RISK_ISSUE_PREFIXES = ("in_person",)


# =============================================================================
# Severity Thresholds
# =============================================================================

# Minimum severity to trigger Tier 3 for high-risk issue types
HIGH_RISK_SEVERITY_THRESHOLD = 6

# Minimum severity to trigger Tier 3 for burdensome classifications
BURDENSOME_SEVERITY_THRESHOLD = 8

# Minimum severity to trigger Tier 3 when "claims no alternative" flag is set
NO_ALTERNATIVE_SEVERITY_THRESHOLD = 7


# =============================================================================
# Routing Functions
# =============================================================================


def is_high_risk_issue_type(issue_type: str) -> bool:
    """Check if an issue type is considered high-risk.

    High-risk issue types escalate to Tier 3 when severity >= 6.

    Args:
        issue_type: The compliance issue type (e.g., "notarization", "in_person_submission")

    Returns:
        True if the issue type is high-risk
    """
    if issue_type in HIGH_RISK_ISSUE_TYPES:
        return True
    return any(issue_type.startswith(prefix) for prefix in HIGH_RISK_ISSUE_PREFIXES)


def should_escalate_to_tier3(unit: "TrackedUnit") -> bool:
    """Determine if a unit should be escalated to Tier 3.

    A unit escalates to Tier 3 (web search verification) if any of the
    following canonical triggers are met:

    V5.1 Updated triggers (data-driven from NJ Title 13 analysis):

    1. High-risk issue type:
       a. All justified items (54-63% valuable regardless of severity)
       b. Burdensome with severity >= 6 (53% valuable)
    2. Cites a federal statute that should be verified
    3. Claims no alternative exists with high severity (>= 7)
    4. Low confidence (<0.85) with severity >= 6 (44% valuable)
    5. Controversial justified classification
    6. Federal mandate is suspected but unverified
    7. Random 10% sample for quality assurance

    SKIP (low value): Burdensome + high confidence + high severity (only 17% valuable)

    Args:
        unit: TrackedUnit with tier2_output populated

    Returns:
        True if the unit should escalate to Tier 3
    """
    if unit.tier2_output is None:
        return False

    output = unit.tier2_output
    classification = output.classification
    severity = output.severity
    confidence = getattr(output, 'confidence', 0.85)

    # Unrelated items never escalate
    if classification == "unrelated":
        return False

    # SKIP: Low-value combination - burdensome + high confidence + high severity
    # Data shows only 17% valuable with 0 class flips
    if classification == "burdensome" and confidence >= LOW_CONFIDENCE_THRESHOLD:
        if severity is not None and severity >= NO_ALTERNATIVE_SEVERITY_THRESHOLD:
            # Only proceed if there's a federal statute to verify
            if not getattr(output, 'cites_federal_statute', False):
                # Check random sample before skipping entirely
                if random.random() < RANDOM_SAMPLE_RATE:
                    return True  # Random sample catches this
                return False

    # 1. High-risk issue type
    if is_high_risk_issue_type(unit.issue_type):
        # 1a. All justified high-risk items (54-63% valuable)
        if classification == "justified":
            return True
        # 1b. Burdensome with severity >= 6 (53% valuable)
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            return True

    # 2. Cites federal statute
    if getattr(output, 'cites_federal_statute', False):
        return True

    # 3. Claims no alternative with high severity
    if getattr(output, 'claims_no_alternative', False):
        if severity is not None and severity >= NO_ALTERNATIVE_SEVERITY_THRESHOLD:
            return True

    # 4. Low confidence with moderate severity (NEW - 44% valuable)
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            return True

    # 5. Controversial justified items
    if classification == "justified" and getattr(output, 'potentially_controversial', False):
        return True

    # 6. Federal mandate suspected
    if getattr(output, 'federal_mandate_suspected', False):
        return True

    # 7. Random 10% sample for quality assurance
    if random.random() < RANDOM_SAMPLE_RATE:
        return True

    return False


def should_escalate_to_tier3_with_reason(unit: "TrackedUnit") -> tuple[bool, str]:
    """Determine if a unit should be escalated to Tier 3 and return the reason.

    Combines should_escalate_to_tier3() and get_tier3_trigger_reason() into a
    single call to avoid duplicate logic and correctly identify random samples.

    Args:
        unit: TrackedUnit with tier2_output populated

    Returns:
        Tuple of (should_escalate: bool, reason: str)
    """
    if unit.tier2_output is None:
        return False, "No Tier 2 output"

    output = unit.tier2_output
    classification = output.classification
    severity = output.severity
    confidence = getattr(output, 'confidence', 0.85)

    # Unrelated items never escalate
    if classification == "unrelated":
        return False, "Not escalated (unrelated)"

    # SKIP: Low-value combination - burdensome + high confidence + high severity
    if classification == "burdensome" and confidence >= LOW_CONFIDENCE_THRESHOLD:
        if severity is not None and severity >= NO_ALTERNATIVE_SEVERITY_THRESHOLD:
            if not getattr(output, 'cites_federal_statute', False):
                # Check random sample before skipping
                if random.random() < RANDOM_SAMPLE_RATE:
                    return True, "Random sample (10%) - would skip: high-conf burdensome"
                return False, "Skipped: high-confidence burdensome + high severity"

    # 1. High-risk issue type
    if is_high_risk_issue_type(unit.issue_type):
        if classification == "justified":
            return True, f"High-risk issue ({unit.issue_type}) + justified"
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            return True, f"High-risk issue ({unit.issue_type}) + severity {severity}"

    # 2. Cites federal statute
    if getattr(output, 'cites_federal_statute', False):
        citation = getattr(output, 'federal_citation', None) or "unspecified"
        return True, f"Federal statute: {citation}"

    # 3. Claims no alternative with high severity
    if getattr(output, 'claims_no_alternative', False):
        if severity is not None and severity >= NO_ALTERNATIVE_SEVERITY_THRESHOLD:
            return True, f"No alternative claimed + severity {severity}"

    # 4. Low confidence with moderate severity
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            return True, f"Low confidence ({confidence:.2f}) + severity {severity}"

    # 5. Controversial justified
    if classification == "justified" and getattr(output, 'potentially_controversial', False):
        return True, "Controversial justified"

    # 6. Federal mandate suspected
    if getattr(output, 'federal_mandate_suspected', False):
        return True, "Federal mandate suspected"

    # 7. Random 10% sample
    if random.random() < RANDOM_SAMPLE_RATE:
        return True, "Random sample (10%)"

    return False, "Not escalated"


def get_tier3_trigger_reason(unit: "TrackedUnit", is_random_sample: bool = False) -> str:
    """Return the reason for Tier 3 escalation.

    Uses the same logic as should_escalate_to_tier3() but returns a
    human-readable description of the trigger condition.

    V5.1: Updated to match new data-driven routing logic.

    Args:
        unit: TrackedUnit with tier2_output populated
        is_random_sample: True if this was selected via random 10% sampling

    Returns:
        String describing the escalation reason, or "Not escalated" if
        the unit doesn't meet escalation criteria
    """
    if unit.tier2_output is None:
        return "Unknown trigger (no Tier 2 output)"

    output = unit.tier2_output
    classification = output.classification
    severity = output.severity
    confidence = getattr(output, 'confidence', 0.85)

    # Unrelated items don't escalate
    if classification == "unrelated":
        return "Not escalated (unrelated)"

    # Check triggers in priority order (same as should_escalate_to_tier3)

    # 1. High-risk issue type
    if is_high_risk_issue_type(unit.issue_type):
        # 1a. All justified high-risk items
        if classification == "justified":
            return f"High-risk issue ({unit.issue_type}) + justified classification"
        # 1b. Burdensome with severity >= 6
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            return f"High-risk issue ({unit.issue_type}) + severity {severity}"

    # 2. Cites federal statute
    if getattr(output, 'cites_federal_statute', False):
        citation = getattr(output, 'federal_citation', None) or "unspecified"
        return f"Federal statute cited: {citation}"

    # 3. Claims no alternative with high severity
    if getattr(output, 'claims_no_alternative', False):
        if severity is not None and severity >= NO_ALTERNATIVE_SEVERITY_THRESHOLD:
            return f"Claims no alternative + severity {severity}"

    # 4. Low confidence with moderate severity
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            return f"Low confidence ({confidence:.2f}) + severity {severity}"

    # 5. Controversial justified
    if classification == "justified" and getattr(output, 'potentially_controversial', False):
        return "Controversial justified item"

    # 6. Federal mandate suspected
    if getattr(output, 'federal_mandate_suspected', False):
        return "Federal mandate suspected"

    # 7. Random sample
    if is_random_sample:
        return "Random sample (10%)"

    return "Not escalated"


def get_all_trigger_reasons(unit: "TrackedUnit") -> list[str]:
    """Return ALL reasons a unit qualifies for Tier 3 escalation.

    Unlike get_tier3_trigger_reason() which returns only the first match,
    this returns all applicable trigger conditions. Useful for debugging
    or detailed analysis.

    Args:
        unit: TrackedUnit with tier2_output populated

    Returns:
        List of all applicable trigger reasons (may be empty)
    """
    if unit.tier2_output is None:
        return []

    output = unit.tier2_output
    classification = output.classification
    severity = output.severity
    reasons = []

    # Unrelated items don't have any triggers
    if classification == "unrelated":
        return []

    # Check all triggers

    if is_high_risk_issue_type(unit.issue_type):
        if severity is not None and severity >= HIGH_RISK_SEVERITY_THRESHOLD:
            reasons.append(f"High-risk issue type ({unit.issue_type}) with severity {severity}")

    if getattr(output, 'cites_federal_statute', False):
        citation = getattr(output, 'federal_citation', None) or "unspecified"
        reasons.append(f"Federal statute cited: {citation}")

    if getattr(output, 'claims_no_alternative', False):
        if severity is not None and severity >= NO_ALTERNATIVE_SEVERITY_THRESHOLD:
            reasons.append(f"Claims no alternative with high severity ({severity})")

    if classification == "burdensome":
        if severity is not None and severity >= BURDENSOME_SEVERITY_THRESHOLD:
            reasons.append(f"High-severity burdensome classification ({severity})")

    if classification == "justified" and getattr(output, 'potentially_controversial', False):
        reasons.append("Controversial justified item requiring verification")

    if getattr(output, 'federal_mandate_suspected', False):
        reasons.append("Federal mandate suspected but unverified")

    return reasons
