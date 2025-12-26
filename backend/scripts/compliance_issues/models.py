"""
Pydantic response models for compliance issue LLM analysis.

These are the only Python definitions needed - everything else comes from YAML.
"""

from typing import Optional
from pydantic import BaseModel, Field


class BaseComplianceAnalysis(BaseModel):
    """Base analysis response for all compliance issues."""
    has_issue: bool = Field(
        description="True if the regulation actually contains this requirement (not a false positive from regex)"
    )
    requirement_quote: Optional[str] = Field(
        default=None,
        description="The specific text from the regulation creating the requirement"
    )
    from_statute: Optional[bool] = Field(
        default=None,
        description="True if statute mandates this, False if agency added it, null if unknown"
    )
    severity: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="How problematic is this requirement (1-10 scale, 10 = most problematic)"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Explanation of why this requirement is or isn't problematic"
    )


class WetSignatureAnalysis(BaseComplianceAnalysis):
    """LLM analysis for wet signature requirements."""
    has_issue: bool = Field(
        description="True ONLY if the regulation explicitly requires a wet, ink, handwritten, original, or physical signature. Generic phrases like 'shall be signed' do NOT count."
    )


class MailOnlyAnalysis(BaseComplianceAnalysis):
    """LLM analysis for mail-only submission requirements."""
    has_issue: bool = Field(
        description="True if mail is the ONLY permitted submission method. False if electronic/online submission is also offered as an alternative."
    )
    alternative_methods: Optional[str] = Field(
        default=None,
        description="Other submission methods mentioned (if any)"
    )


class CertifiedMailAnalysis(BaseComplianceAnalysis):
    """LLM analysis for certified/registered mail requirements."""
    has_issue: bool = Field(
        description="True if certified/registered mail is required and appears unnecessary for routine correspondence. False if there's a clear legal rationale."
    )
    legal_rationale: Optional[str] = Field(
        default=None,
        description="Legal purpose if one is apparent (e.g., establishing deadline, legal notice)"
    )


class FaxAnalysis(BaseComplianceAnalysis):
    """LLM analysis for fax requirements."""
    has_issue: bool = Field(
        description="True if fax is required or is the only alternative to physical mail. False if modern digital alternatives are equally available."
    )
    alternative_methods: Optional[str] = Field(
        default=None,
        description="Other submission methods mentioned (if any)"
    )


class ObsoleteTechAnalysis(BaseComplianceAnalysis):
    """LLM analysis for obsolete technology requirements."""
    has_issue: bool = Field(
        description="True if the reference is to an active requirement or permitted method for current processes. False if it's historical, definitional, or an exemption."
    )
    technology_type: Optional[str] = Field(
        default=None,
        description="The obsolete technology referenced (telegram, telex, pager, etc.)"
    )


class InPersonAnalysis(BaseComplianceAnalysis):
    """LLM analysis for in-person requirements."""
    has_issue: bool = Field(
        description="True if physical presence is required. False if remote/electronic alternatives are available."
    )


class PaymentAnalysis(BaseComplianceAnalysis):
    """LLM analysis for payment method restrictions."""
    has_issue: bool = Field(
        description="True if specific payment method is required with no modern alternatives."
    )


class DocumentFormatAnalysis(BaseComplianceAnalysis):
    """LLM analysis for document format requirements."""
    has_issue: bool = Field(
        description="True if specific physical format is required."
    )


class IncorporationByReferenceAnalysis(BaseComplianceAnalysis):
    """LLM analysis for incorporation by reference requirements."""
    has_issue: bool = Field(
        description="True if the regulation incorporates an external standard, code, or document by reference."
    )
    incorporated_document: Optional[str] = Field(
        default=None,
        description="The name of the document/standard being incorporated (e.g., 'International Building Code 2021', 'NFPA 101')"
    )
    source_organization: Optional[str] = Field(
        default=None,
        description="The organization that publishes the incorporated document (e.g., 'ICC', 'NFPA', 'ANSI', 'CFR')"
    )
    version: Optional[str] = Field(
        default=None,
        description="The version or year of the incorporated document if specified"
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
    "IncorporationByReferenceAnalysis": IncorporationByReferenceAnalysis,
}
