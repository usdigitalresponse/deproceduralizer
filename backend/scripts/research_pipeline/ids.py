"""Shared ID generation for the research pipeline.

Centralizes custom_id generation to avoid format inconsistencies across modules.
The format is: {issue_type}_{document_id}

Example: "notarization_12345"

This is used by:
- state_machine.py (TrackedUnit.custom_id property)
- cli.py (fetch_tier3_pending_documents)
- pipeline_runner.py (run_tier3_only)
"""


def make_custom_id(document_id: int, issue_type: str) -> str:
    """Generate a custom_id for batch API requests.

    Format: {issue_type}_{document_id}
    Example: "notarization_12345"

    Args:
        document_id: The regulatory document ID
        issue_type: The compliance issue type (e.g., "notarization", "wet_signature")

    Returns:
        A string like "notarization_12345"
    """
    return f"{issue_type}_{document_id}"


def parse_custom_id(custom_id: str) -> tuple[str, int]:
    """Parse a custom_id back into its components.

    Note: Uses rsplit to handle issue_types that contain underscores
    (e.g., "in_person_submission_12345" -> ("in_person_submission", 12345))

    Args:
        custom_id: A string like "notarization_12345"

    Returns:
        Tuple of (issue_type, document_id)

    Raises:
        ValueError: If custom_id format is invalid
    """
    parts = custom_id.rsplit("_", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid custom_id format: {custom_id}")
    try:
        return parts[0], int(parts[1])
    except ValueError:
        raise ValueError(f"Invalid document_id in custom_id: {custom_id}")
