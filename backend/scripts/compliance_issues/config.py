"""
Configuration for compliance issue detection.

Defines state configurations and issue type configurations that can be
combined to search for specific compliance issues in specific states.
"""

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Type, Pattern

from pydantic import BaseModel, Field

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config import DATA_DIR


# =============================================================================
# PYDANTIC MODELS FOR LLM RESPONSES
# =============================================================================

class BaseComplianceAnalysis(BaseModel):
    """Base analysis response for all compliance issues."""
    has_issue: bool = Field(
        description="True if the regulation contains this compliance issue"
    )
    requirement_quote: Optional[str] = Field(
        default=None,
        description="Exact quote establishing the requirement, if found"
    )
    from_statute: Optional[bool] = Field(
        default=None,
        description="True if requirement is from statute, False if regulation adds it, null if no statute provided or no issue"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional context about the finding"
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


# =============================================================================
# STATE CONFIGURATION
# =============================================================================

@dataclass
class StateConfig:
    """
    Configuration for a state's regulations and optional statute data.

    Regulations are queried from the regulatory_documents table in the database.

    Attributes:
        state_code: Two-letter state code ('NJ' or 'NY')
        citation_prefix: Prefix for database fields ('njac' or 'nycrr')
        statute_file: Optional path to statute JSON file (local file for now)
        statute_pattern: Optional regex pattern for extracting statute citations
        statute_citation_prefix: Human-readable prefix for statute citations
    """
    state_code: str
    citation_prefix: str
    # Statute configuration (optional - decoupled from state)
    statute_file: Optional[Path] = None
    statute_pattern: Optional[Pattern] = None
    statute_citation_prefix: Optional[str] = None

    def has_statute_data(self) -> bool:
        """Check if statute data is available for this state."""
        return self.statute_file is not None and self.statute_file.exists()


# State configurations
STATES: dict[str, StateConfig] = {
    'nj': StateConfig(
        state_code='NJ',
        citation_prefix='njac',
        statute_file=DATA_DIR / 'nj_statutes_complete.json',
        statute_pattern=re.compile(
            r'N\.J\.S\.A\.\s*(\d+[A-Za-z]?):(\d+[A-Za-z]?)-(\d+(?:\.\d+)?[a-z]?)',
            re.IGNORECASE
        ),
        statute_citation_prefix='N.J.S.A.',
    ),
    'ny': StateConfig(
        state_code='NY',
        citation_prefix='nycrr',
        # NY statute data can be added later
        statute_file=None,
        statute_pattern=None,
        statute_citation_prefix=None,
    ),
}


# =============================================================================
# ISSUE TYPE CONFIGURATION
# =============================================================================

@dataclass
class IssueTypeConfig:
    """
    Configuration for a compliance issue type.

    Attributes:
        name: Issue type identifier (e.g., 'wet_signature')
        display_name: Human-readable name
        db_issue_type: Value stored in compliance_issues.issue_type column
        tiers: Dict mapping tier names to lists of regex patterns
        prompt_name: Key in prompts.yaml for this issue type
        response_model: Pydantic model class for LLM response
        description: Brief description of what this issue type detects
    """
    name: str
    display_name: str
    db_issue_type: str
    tiers: dict[str, list[str]]
    prompt_name: str
    response_model: Type[BaseComplianceAnalysis]
    description: str = ""


# =============================================================================
# REGEX PATTERNS BY ISSUE TYPE
# =============================================================================

# Wet Signature patterns (from existing script)
WET_SIGNATURE_TIERS = {
    'tier1': [  # Strong indicators
        r"wet signature",
        r"original signature",
        r"ink signature",
        r"handwritten signature",
        r"physical signature",
        r"signed in ink",
        r"manually signed",
        r"hand-signed",
        r"pen and ink",
        r"signature.{0,20}original",
        r"original.{0,20}signature",
    ],
    'tier2': [  # Likely indicators (notarization often implies wet signature)
        r"notarized signature",
        r"signature.{0,20}notari",
        r"notari.{0,20}signature",
        r"acknowledged before",
        r"sworn.{0,20}before",
        r"subscribed.{0,20}before",
        r"affidavit",
        r"under oath",
    ],
    'tier3': [  # Electronic exclusions
        r"electronic.{0,20}signature.{0,20}not",
        r"facsimile.{0,20}not.{0,20}accept",
        r"no electronic.{0,20}signature",
        r"not.{0,20}accept.{0,20}electronic",
        r"fax.{0,20}not.{0,20}accept",
    ],
    'tier4': [  # General requirements (needs LLM confirmation)
        r"must be signed",
        r"shall be signed",
        r"signature required",
        r"signed by the applicant",
        r"applicant.{0,10}signature",
        r"signature of.{0,20}applicant",
        r"personally sign",
        r"in writing.{0,30}signed",
        r"signed.{0,20}in writing",
        r"bear.{0,10}signature",
        r"signature.{0,10}required",
        r"requires?.{0,10}signature",
    ],
}

# Mail-Only Submission patterns
MAIL_ONLY_TIERS = {
    'tier1': [  # Strong indicators - mail as only option
        r"submit.{0,20}by mail",
        r"send by mail",
        r"mail.{0,10}only",
        r"mailed to.{0,30}address",
        r"via.{0,10}mail.{0,10}only",
        r"must be mailed",
        r"shall be mailed",
    ],
    'tier2': [  # Postal service references
        r"by.{0,10}u\.?s\.?\s*mail",
        r"via.{0,10}u\.?s\.?\s*mail",
        r"united states.{0,10}mail",
        r"postal.{0,10}service",
        r"usps",
        r"first.{0,10}class.{0,10}mail",
    ],
    'tier3': [  # General mail references (needs LLM confirmation)
        r"by mail",
        r"mailed to",
        r"mailing address",
        r"mail the.{0,20}to",
        r"send.{0,20}mail",
    ],
}

# Certified/Registered Mail patterns
CERTIFIED_MAIL_TIERS = {
    'tier1': [  # Strong indicators
        r"certified mail",
        r"registered mail",
        r"return receipt",
        r"delivery confirmation",
    ],
    'tier2': [  # Deadline/proof requirements
        r"postmarked by",
        r"proof of mailing",
        r"certificate of mailing",
        r"postmark.{0,20}deadline",
    ],
    'tier3': [  # General certified references
        r"certified.{0,20}letter",
        r"mail.{0,20}certified",
    ],
}

# Fax Requirements patterns
FAX_TIERS = {
    'tier1': [  # Strong indicators - fax as requirement
        r"submit.{0,20}by fax",
        r"fax.{0,10}only",
        r"via.{0,10}fax",
        r"fax.{0,10}to",
        r"by.{0,10}facsimile",
    ],
    'tier2': [  # Fax number/contact
        r"fax.{0,10}number",
        r"fax.{0,10}:",
        r"facsimile.{0,10}number",
        r"telefax",
    ],
    'tier3': [  # General fax references
        r"fax",
        r"facsimile",
        r"fax.{0,10}transmission",
    ],
}

# Obsolete Technology patterns
OBSOLETE_TECH_TIERS = {
    'tier1': [  # Clearly obsolete
        r"telegram",
        r"telegraph",
        r"telex",
        r"wire.{0,10}transfer.{0,10}message",  # Not money transfer
    ],
    'tier2': [  # Obsolete personal devices
        r"pager",
        r"beeper",
        r"paging.{0,10}device",
    ],
    'tier3': [  # Potentially obsolete references
        r"by.{0,10}wire",
        r"by.{0,10}cable",
        r"cablegram",
    ],
}


# =============================================================================
# ISSUE TYPE REGISTRY
# =============================================================================

ISSUE_TYPES: dict[str, IssueTypeConfig] = {
    'wet_signature': IssueTypeConfig(
        name='wet_signature',
        display_name='Wet Signature Requirements',
        db_issue_type='wet_signature',
        tiers=WET_SIGNATURE_TIERS,
        prompt_name='compliance_wet_signature',
        response_model=WetSignatureAnalysis,
        description='Regulations requiring physical wet/ink/handwritten signatures',
    ),
    'mail_only': IssueTypeConfig(
        name='mail_only',
        display_name='Mail-Only Submission Requirements',
        db_issue_type='mail_only',
        tiers=MAIL_ONLY_TIERS,
        prompt_name='compliance_mail_only',
        response_model=MailOnlyAnalysis,
        description='Regulations requiring mail submission with no electronic alternative',
    ),
    'certified_mail': IssueTypeConfig(
        name='certified_mail',
        display_name='Certified/Registered Mail Requirements',
        db_issue_type='certified_mail',
        tiers=CERTIFIED_MAIL_TIERS,
        prompt_name='compliance_certified_mail',
        response_model=CertifiedMailAnalysis,
        description='Regulations requiring certified or registered mail',
    ),
    'fax': IssueTypeConfig(
        name='fax',
        display_name='Fax Requirements',
        db_issue_type='fax_required',
        tiers=FAX_TIERS,
        prompt_name='compliance_fax',
        response_model=FaxAnalysis,
        description='Regulations requiring or primarily relying on fax',
    ),
    'obsolete_tech': IssueTypeConfig(
        name='obsolete_tech',
        display_name='Obsolete Technology References',
        db_issue_type='obsolete_tech',
        tiers=OBSOLETE_TECH_TIERS,
        prompt_name='compliance_obsolete_tech',
        response_model=ObsoleteTechAnalysis,
        description='Regulations referencing telegrams, telex, pagers, etc.',
    ),
}
