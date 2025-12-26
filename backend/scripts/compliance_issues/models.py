"""
Pydantic response models for compliance issue LLM analysis.

These are the only Python definitions needed - everything else comes from YAML.
"""

from typing import Optional
from pydantic import BaseModel, Field


class ComplianceIssueInstance(BaseModel):
    """
    A single compliance issue instance OR explanation of why there's no issue.

    - has_issue=True: this is a real compliance issue (severity required)
    - has_issue=False: explains why there's NO issue (quote shows permissive language)
    """
    has_issue: bool = Field(
        description="True if this is a real compliance issue, False if explaining why there's NO issue"
    )
    requirement_quote: str = Field(
        description="The specific text - either creating the requirement (if issue) or showing why there's no issue (e.g., 'electronic signatures permitted')"
    )
    from_statute: Optional[bool] = Field(
        default=None,
        description="True if statute mandates this, False if agency added it, null if unknown or no issue"
    )
    severity: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="How problematic (1-10). Required if has_issue=True, null if has_issue=False."
    )
    notes: str = Field(
        description="Explanation - why this IS problematic, or why there's NO issue"
    )


class BaseComplianceAnalysis(BaseModel):
    """
    Response for compliance issue analysis.

    Returns a list of issues found. If no issues found, returns empty list.
    The LLM should identify ALL separate instances of the issue type in the document.
    """
    issues: list[ComplianceIssueInstance] = Field(
        default_factory=list,
        description="List of compliance issues found. Empty list means no issues. Each distinct requirement should be a separate item."
    )

    # Keep has_issue as computed property for backward compatibility
    @property
    def has_issue(self) -> bool:
        return len(self.issues) > 0


# =============================================================================
# Specialized Issue Instance classes (for issue types with extra fields)
# =============================================================================

class MailOnlyIssueInstance(ComplianceIssueInstance):
    """A mail-only submission issue with alternative methods info."""
    alternative_methods: Optional[str] = Field(
        default=None,
        description="Other submission methods mentioned (if any)"
    )


class CertifiedMailIssueInstance(ComplianceIssueInstance):
    """A certified mail issue with legal rationale info."""
    legal_rationale: Optional[str] = Field(
        default=None,
        description="Legal purpose if one is apparent (e.g., establishing deadline, legal notice)"
    )


class FaxIssueInstance(ComplianceIssueInstance):
    """A fax requirement issue with alternative methods info."""
    alternative_methods: Optional[str] = Field(
        default=None,
        description="Other submission methods mentioned (if any)"
    )


class ObsoleteTechIssueInstance(ComplianceIssueInstance):
    """An obsolete technology issue with technology type info."""
    technology_type: Optional[str] = Field(
        default=None,
        description="The obsolete technology referenced (telegram, telex, pager, etc.)"
    )


# =============================================================================
# Analysis Response classes (what the LLM returns)
# =============================================================================

class WetSignatureAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for wet signature requirements.

    Only flag issues where the regulation EXPLICITLY requires wet, ink, handwritten,
    original, or physical signature. Generic phrases like 'shall be signed' do NOT count.
    """
    pass  # Uses base ComplianceIssueInstance


class MailOnlyAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for mail-only submission requirements.

    Flag if mail is the ONLY permitted submission method.
    Do NOT flag if electronic/online submission is also offered as an alternative.
    """
    issues: list[MailOnlyIssueInstance] = Field(
        default_factory=list,
        description="List of mail-only requirements found. Empty if electronic alternatives exist."
    )


class CertifiedMailAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for certified/registered mail requirements.

    Flag if certified/registered mail is required and appears unnecessary for routine correspondence.
    Do NOT flag if there's a clear legal rationale.
    """
    issues: list[CertifiedMailIssueInstance] = Field(
        default_factory=list,
        description="List of certified mail requirements found."
    )


class FaxAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for fax requirements.

    Flag if fax is required or is the only alternative to physical mail.
    Do NOT flag if modern digital alternatives are equally available.
    """
    issues: list[FaxIssueInstance] = Field(
        default_factory=list,
        description="List of fax requirements found."
    )


class ObsoleteTechAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for obsolete technology requirements.

    Flag if the reference is to an active requirement or permitted method for current processes.
    Do NOT flag if it's historical, definitional, or an exemption.
    """
    issues: list[ObsoleteTechIssueInstance] = Field(
        default_factory=list,
        description="List of obsolete technology requirements found."
    )


class InPersonAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for in-person requirements.

    Flag if physical presence is required.
    Do NOT flag if remote/electronic alternatives are available.
    """
    pass  # Uses base ComplianceIssueInstance


class PaymentAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for payment method restrictions.

    Flag if specific payment method is required with no modern alternatives.
    """
    pass  # Uses base ComplianceIssueInstance


class DocumentFormatAnalysis(BaseComplianceAnalysis):
    """
    LLM analysis for document format requirements.

    Flag if specific physical format is required.
    """
    pass  # Uses base ComplianceIssueInstance


# Map model names (from YAML) to actual classes
RESPONSE_MODELS = {
    "BaseComplianceAnalysis": BaseComplianceAnalysis,
    "WetSignatureAnalysis": WetSignatureAnalysis,
    "MailOnlyAnalysis": MailOnlyAnalysis,
    "CertifiedMailAnalysis": CertifiedMailAnalysis,
    "FaxAnalysis": FaxAnalysis,
    "ObsoleteTechAnalysis": ObsoleteTechAnalysis,
    "InPersonAnalysis": InPersonAnalysis,
    "PaymentAnalysis": PaymentAnalysis,
    "DocumentFormatAnalysis": DocumentFormatAnalysis,
}
