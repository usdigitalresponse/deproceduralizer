"""
Pydantic response models for compliance issue LLM analysis.

Field names match database columns exactly for clarity.
"""

import json
from typing import Literal, Optional
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


# =============================================================================
# Fines, Fees & Penalties - uses separate table with different columns
# =============================================================================

class FineFeePenaltyItem(BaseModel):
    """A single fine, fee, or penalty extracted from a document."""
    llm_confirmed: bool = Field(
        description="True if this is a confirmed fine, fee, or penalty"
    )
    penalty_type: Literal['fine', 'fee', 'penalty', 'surcharge', 'forfeiture', 'other'] = Field(
        description="Type: 'fine', 'fee', 'penalty', 'surcharge', 'forfeiture', or 'other'"
    )
    amount: Optional[str] = Field(
        default=None,
        description="Dollar amount as stated (e.g., '$500', 'up to $10,000', '$100-$500')"
    )
    amount_min: Optional[float] = Field(
        default=None,
        description="Minimum numeric amount if parseable"
    )
    amount_max: Optional[float] = Field(
        default=None,
        description="Maximum numeric amount if parseable"
    )
    per_unit: Optional[str] = Field(
        default=None,
        description="What the amount is per (e.g., 'per violation', 'per day')"
    )
    who_pays: Optional[str] = Field(
        default=None,
        description="Who is subject to this charge (e.g., 'licensee', 'applicant')"
    )
    responsible_agency: Optional[str] = Field(
        default=None,
        description="Agency that administers or collects this charge"
    )
    agency_level: Optional[Literal[
        'federal', 'state', 'county', 'city', 'village', 'town',
        'authority', 'judiciary', 'generic'
    ]] = Field(
        default=None,
        description="Government level of the responsible agency"
    )
    violation_description: Optional[str] = Field(
        default=None,
        description="What triggers this fine/fee"
    )
    requirement_quote: Optional[str] = Field(
        default=None,
        description="Exact quote from text establishing this charge"
    )
    jurisdiction_level: Optional[Literal['federal', 'state', 'county', 'local', 'other']] = Field(
        default=None,
        description="Level of government imposing this charge: 'federal', 'state', 'county', 'local', or 'other'"
    )
    jurisdiction_level_other: Optional[str] = Field(
        default=None,
        description="Free-text description if jurisdiction_level is 'other'"
    )
    issuing_entity_confidence: Optional[float] = Field(
        default=None,
        description="Confidence (0.0-1.0) in responsible_agency attribution"
    )

    @model_validator(mode='after')
    def validate_amount_range(self) -> 'FineFeePenaltyItem':
        """Swap amount_min and amount_max if inverted."""
        if self.amount_min is not None and self.amount_max is not None:
            if self.amount_min > self.amount_max:
                self.amount_min, self.amount_max = self.amount_max, self.amount_min
        return self


class FinesFeePenaltyAnalysis(BaseModel):
    """
    LLM analysis for fines, fees, and penalties.

    Returns a list of items — one document may contain multiple distinct charges.
    Field names match fines_fees_penalties table columns.
    Note: This uses a DIFFERENT table than compliance_issues.
    """
    items: list[FineFeePenaltyItem] = Field(
        default_factory=list,
        description="List of fines, fees, and penalties found in the document"
    )

    @field_validator('items', mode='before')
    @classmethod
    def parse_stringified_json(cls, v):
        """Handle LLM sometimes returning items as a JSON string."""
        if isinstance(v, str):
            return json.loads(v)
        return v


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
    "FinesFeePenaltyAnalysis": FinesFeePenaltyAnalysis,
}
