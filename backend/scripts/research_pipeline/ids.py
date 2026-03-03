"""Shared ID generation for the research pipeline.

Centralizes custom_id generation to avoid format inconsistencies across modules.

For regulation sources:
  Format: {issue_type}_{document_id}
  Example: "notarization_12345"

For guidance sources:
  Format: g_{issue_type}_{document_id}
  Example: "g_notarization_12345"

This is used by:
- state_machine.py (TrackedUnit.custom_id property)
- cli.py (fetch_tier3_pending_documents)
- pipeline_runner.py (run_tier3_only)
"""


def make_custom_id(document_id: int, issue_type: str, source_type: str = "regulation") -> str:
    """Generate a custom_id for batch API requests.

    Format (regulation): {issue_type}_{document_id}
    Format (guidance):   g_{issue_type}_{document_id}

    Args:
        document_id: The document ID (regulatory_documents or guidance_documents)
        issue_type: The compliance issue type (e.g., "notarization", "wet_signature")
        source_type: "regulation" or "guidance"

    Returns:
        A string like "notarization_12345" or "g_notarization_12345"
    """
    if source_type == "guidance":
        return f"g_{issue_type}_{document_id}"
    return f"{issue_type}_{document_id}"


def parse_custom_id(custom_id: str) -> tuple[str, int, str]:
    """Parse a custom_id back into its components.

    Note: Uses rsplit to handle issue_types that contain underscores
    (e.g., "in_person_submission_12345" -> ("in_person_submission", 12345, "regulation"))

    Args:
        custom_id: A string like "notarization_12345" or "g_notarization_12345"

    Returns:
        Tuple of (issue_type, document_id, source_type)

    Raises:
        ValueError: If custom_id format is invalid
    """
    # Check for guidance prefix
    source_type = "regulation"
    id_str = custom_id
    if custom_id.startswith("g_"):
        source_type = "guidance"
        id_str = custom_id[2:]  # Strip "g_" prefix

    parts = id_str.rsplit("_", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid custom_id format: {custom_id}")
    try:
        return parts[0], int(parts[1]), source_type
    except ValueError:
        raise ValueError(f"Invalid document_id in custom_id: {custom_id}")
