"""
Pydantic response models for compliance issue LLM analysis.

Field names match database columns exactly for clarity.
"""

import json
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class ComplianceIssueInstance(BaseModel):
    """
    A single compliance issue instance OR explanation of why there's no issue.

    - requirement_found=True: this is a real compliance issue (severity required)
    - requirement_found=False: explains why there's NO issue (quote shows permissive language)
    """
    requirement_found: bool = Field(
        description="True if this is a real compliance issue, False if explaining why there's NO issue"
    )
    verbatim_supporting_text: list[str] = Field(
        default_factory=list,
        description="Exact verbatim quotes from the regulation text that support this finding. Empty array if no issue found."
    )
    required_by_statute: Optional[bool] = Field(
        default=None,
        description="True if statute mandates this, False if agency added it, null if unknown or no issue"
    )
    severity: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="How problematic (1-10). Required if requirement_found=True, null if requirement_found=False."
    )
    decision_rationale: str = Field(
        description="Holistic explanation of the classification decision - why this IS or IS NOT a compliance issue"
    )

    @model_validator(mode='after')
    def validate_severity_required(self) -> 'ComplianceIssueInstance':
        """Ensure severity is set when requirement_found=True.

        Philosophy: Default to minimum (1) - issue must prove it's higher severity.
        Severity can be null if requirement_found=False (not a legitimate issue).
        """
        if self.requirement_found and self.severity is None:
            self.severity = 1
        return self


class BaseComplianceAnalysis(BaseModel):
    """
    Response for compliance issue analysis.

    Returns a list of issues found. If no issues found, returns one item with requirement_found=False.
    The LLM should identify ALL separate instances of the issue type in the document.
    """
    issues: list[ComplianceIssueInstance] = Field(
        default_factory=list,
        description="List of compliance issues found. Each distinct requirement should be a separate item."
    )

    @field_validator('issues', mode='before')
    @classmethod
    def parse_stringified_json(cls, v):
        """Handle LLM sometimes returning issues as a JSON string instead of a list."""
        if isinstance(v, str):
            return json.loads(v)
        return v

    @property
    def has_issue(self) -> bool:
        return any(issue.requirement_found for issue in self.issues)


# All compliance issue types use the same base model
WetSignatureAnalysis = BaseComplianceAnalysis
MailOnlyAnalysis = BaseComplianceAnalysis
CertifiedMailAnalysis = BaseComplianceAnalysis
FaxAnalysis = BaseComplianceAnalysis
ObsoleteTechAnalysis = BaseComplianceAnalysis
InPersonAnalysis = BaseComplianceAnalysis
PaymentAnalysis = BaseComplianceAnalysis
DocumentFormatAnalysis = BaseComplianceAnalysis
ReportingFrequencyAnalysis = BaseComplianceAnalysis


# =============================================================================
# Incorporation by Reference (IBR) - uses separate table with different columns
# =============================================================================

class IncorporationByReferenceAnalysis(BaseModel):
    """
    LLM analysis for incorporation by reference.

    Field names match incorporations_by_reference table columns.
    Note: This uses a DIFFERENT table than compliance_issues.
    """
    llm_confirmed: bool = Field(
        description="True if this is a confirmed incorporation by reference"
    )
    incorporated_document: Optional[str] = Field(
        default=None,
        description="Name of the document/standard being incorporated (e.g., 'International Building Code 2021')"
    )
    source_organization: Optional[str] = Field(
        default=None,
        description="Organization that publishes the document (e.g., 'ICC', 'NFPA', 'ANSI')"
    )
    version: Optional[str] = Field(
        default=None,
        description="Version or year of the incorporated document"
    )
    requirement_quote: Optional[str] = Field(
        default=None,
        description="Exact quote from regulation referencing the external standard"
    )


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
    "ReportingFrequencyAnalysis": ReportingFrequencyAnalysis,
    "IncorporationByReferenceAnalysis": IncorporationByReferenceAnalysis,
}
