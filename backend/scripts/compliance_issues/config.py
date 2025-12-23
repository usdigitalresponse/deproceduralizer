"""
Configuration for compliance issue detection.

Defines state configurations and issue type configurations that can be
combined to search for specific compliance issues in specific states.

Updated 2025-12-23: Added all 35 issue types with refined patterns.
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
        category: Category for grouping (Communication, Payment, etc.)
    """
    name: str
    display_name: str
    db_issue_type: str
    tiers: dict[str, list[str]]
    prompt_name: str
    response_model: Type[BaseComplianceAnalysis]
    description: str = ""
    category: str = ""


# =============================================================================
# REGEX PATTERNS BY ISSUE TYPE
# All patterns use our vetted selections from pattern_variants.md analysis
# =============================================================================

# === COMMUNICATION & SUBMISSION ===

MAIL_ONLY_TIERS = {
    'tier1': [
        r"must be mailed",
        r"shall be mailed",
        r"send by mail",
        r"submit.{0,20}by mail",
        r"mail.{0,10}only",
        r"u\.?s\.?\s*mail",
        r"\busps\b",
        r"first.{0,10}class.{0,10}mail",
        r"postal.{0,10}service",
        r"postmarked by",
    ],
}

CERTIFIED_MAIL_TIERS = {
    'tier1': [
        r"certified mail",
        r"registered mail",
        r"return receipt",
        r"delivery confirmation",
        r"postmarked by",
        r"proof of mailing",
        r"certificate of mailing",
        r"by certified",
        r"via certified",
    ],
}

FAX_TIERS = {
    'tier1': [
        r"\bfax\b",
        r"facsimile",
        r"telefax",
    ],
}

OBSOLETE_COMM_TIERS = {
    'tier1': [
        r"telegram",
        r"telegraph",
        r"\btelex\b",
        r"\bpager\b",
        r"\bbeeper\b",
    ],
}

LANDLINE_TIERS = {
    'tier1': [
        r"\blandline\b",
        r"touch-tone",
        r"by telephone",
        r"telephone call",
        r"verbal authorization",
        r"oral authorization",
        r"by phone",
    ],
}

# === PAYMENT ===

CHECK_PAYMENT_TIERS = {
    'tier1': [
        r"money order",
        r"certified check",
        r"cashier.{0,3}s? check",
        r"personal check",
        r"payable to",
    ],
}

CASH_ONLY_TIERS = {
    'tier1': [
        r"cash.{0,5}only",
        r"exact change",
    ],
}

NO_CREDIT_CARDS_TIERS = {
    'tier1': [
        r"no credit cards?",
        r"credit cards? not accepted",
        r"cash or check only",
        r"no electronic payment",
    ],
}

IN_PERSON_PAYMENT_TIERS = {
    'tier1': [
        r"pay in person",
        r"payment in person",
        r"in.{0,3}person.{0,10}payment",
    ],
}

# === SIGNATURES & AUTHENTICATION ===

WET_SIGNATURE_TIERS = {
    'tier1': [
        r"wet signature",
        r"ink signature",
        r"handwritten signature",
        r"original signature",
        r"signed in ink",
        r"blue ink",
        r"black ink",
        r"manually signed",
        r"physical signature",
        r"personally sign",
        r"notarized.{0,20}signature",
        r"signature.{0,20}notari",
        r"bear.{0,10}signature",
    ],
}

NOTARIZATION_TIERS = {
    'tier1': [
        r"must be notarized",
        r"shall be notarized",
        r"duly notarized",
        r"\bnotarized\b",
        r"notary public",
        r"sworn.{0,20}before",
        r"acknowledged before",
        r"\bjurat\b",
    ],
}

WITNESS_TIERS = {
    'tier1': [
        r"two witnesses",
        r"2 witnesses",
        r"witness.{0,5}signature",
        r"witnessed by",
        r"\battested\b",
        r"attestation",
        r"in the presence of",
    ],
}

EMBOSSED_SEAL_TIERS = {
    'tier1': [
        r"embossed seal",
        r"raised seal",
        r"impressed seal",
        r"corporate seal",
        r"official seal",
        r"seal.{0,5}affixed",
    ],
}

ORIGINAL_DOCUMENT_TIERS = {
    'tier1': [
        r"no photocopies",
        r"original only",
        r"submit.{0,10}original",
        r"provide.{0,10}original",
        r"original document",
        r"original certificate",
        r"original letter",
        r"must be.{0,5}original",
        r"shall be.{0,5}original",
    ],
}

# === PHYSICAL PRESENCE ===

IN_PERSON_SUBMISSION_TIERS = {
    'tier1': [
        r"submit.{0,10}in person",
        r"appear in person",
        r"in.{0,3}person.{0,10}submission",
        r"personal appearance",
        r"hand.{0,3}deliver",
    ],
}

IN_PERSON_HEARING_TIERS = {
    'tier1': [
        r"in.{0,3}person.{0,10}hearing",
        r"appear at.{0,20}hearing",
        r"physical.{0,5}attendance",
        r"attend in person",
        r"appear before.{0,20}board",
        r"appear before.{0,20}commission",
    ],
}

IN_PERSON_PICKUP_TIERS = {
    'tier1': [
        r"pick up in person",
        r"picked up in person",
        r"available for pickup",
        r"available.{0,10}pick.{0,3}up",
    ],
}

PHYSICAL_FORMS_TIERS = {
    'tier1': [
        r"forms available at",
        r"forms.{0,10}available.{0,10}at",
        r"obtain forms from",
        r"forms may be obtained",
    ],
}

PHYSICAL_INSPECTION_TIERS = {
    'tier1': [
        r"available for public inspection",
        r"public inspection",
        r"open to inspection",
        r"maintain for inspection",
        r"available for review at",
        r"during business hours",
    ],
}

PHYSICAL_POSTING_TIERS = {
    'tier1': [
        r"conspicuously posted",
        r"conspicuously displayed",
        r"prominently displayed",
        r"prominently posted",
        r"posted on the premises",
        r"posted at all times",
        r"post a notice",
        r"display.{0,10}sign",
        r"visible to the public",
    ],
}

BULLETIN_BOARD_TIERS = {
    'tier1': [
        r"bulletin board",
        r"notice board",
        r"community board",
        r"public board",
        r"posted.{0,10}board",
    ],
}

# === TECHNOLOGY & MEDIA ===

OBSOLETE_MEDIA_TIERS = {
    'tier1': [
        r"floppy.{0,5}disk",
        r"\bdiskette\b",
        r"cd-rom",
        r"\bdvd\b",
        r"magnetic.{0,5}tape",
        r"usb drive",
        r"flash drive",
    ],
}

MICROFICHE_TIERS = {
    'tier1': [
        r"microfiche",
        r"microfilm",
        r"microform",
        r"aperture card",
    ],
}

OBSOLETE_SOFTWARE_TIERS = {
    'tier1': [
        r"wordperfect",
        r"\blotus\b",
        r"\bdos\b",
        r"\bdbase\b",
        r"ascii.{0,10}format",
    ],
}

TYPEWRITER_TIERS = {
    'tier1': [
        r"\btypewriter\b",
        r"typewritten",
        r"type.{0,3}written",
        r"must be typed",
        r"shall be typed",
    ],
}

PDF_ONLY_TIERS = {
    'tier1': [
        r"pdf format",
        r"submit as pdf",
        r"adobe pdf",
        r"\.pdf\b",
    ],
}

CARBON_COPY_TIERS = {
    'tier1': [
        r"carbon copy",
        r"carbon.{0,5}copies",
        r"duplicate copy",
        r"duplicate copies",
    ],
}

NEWSPAPER_TIERS = {
    'tier1': [
        r"newspaper of general circulation",
        r"publish.{0,20}newspaper",
        r"published.{0,20}newspaper",
        r"newspaper.{0,10}notice",
        r"newspaper.{0,10}publication",
        r"legal.{0,5}notice",
        r"local newspaper",
        r"official newspaper",
    ],
}

# === DOCUMENT FORMAT ===

MULTIPLE_COPIES_TIERS = {
    'tier1': [
        r"\bin duplicate\b",
        r"\bin triplicate\b",
        r"three copies",
        r"four copies",
        r"five copies",
        r"submit.{0,10}\d+.{0,10}copies",
        r"original and.{0,10}\d+.{0,10}cop",
        r"multiple copies",
    ],
}

PAPER_SPECS_TIERS = {
    'tier1': [
        r"8\.?5.{0,5}x.{0,5}11",
        r"letter size",
        r"8\.?5.{0,5}x.{0,5}14",
        r"legal size",
        r"bond paper",
        r"20 lb",
        r"paper stock",
        r"white paper",
        r"colored paper",
    ],
}

PHOTO_SPECS_TIERS = {
    'tier1': [
        r"passport photo",
        r"2.{0,3}x.{0,3}2",
        r"recent photograph",
        r"current photograph",
    ],
}

LETTERHEAD_TIERS = {
    'tier1': [
        r"on letterhead",
        r"official letterhead",
        r"company letterhead",
        r"agency letterhead",
    ],
}

HANDWRITING_SPECS_TIERS = {
    'tier1': [
        r"block letters",
        r"print clearly",
        r"print in ink",
        r"hand-printed",
        r"hand printed",
    ],
}

BINDING_REQUIRED_TIERS = {
    'tier1': [
        r"spiral bound",
        r"three-ring binder",
        r"ring binder",
    ],
}

# === PROCESS & TRACKING ===

PHYSICAL_LOG_TIERS = {
    'tier1': [
        r"sign-in sheet",
        r"sign in sheet",
        r"log book",
        r"\blogbook\b",
        r"visitor log",
        r"sign the register",
        r"entry log",
        r"written log",
        r"daily log",
    ],
}

ROUTING_SLIP_TIERS = {
    'tier1': [
        r"transmittal form",
        r"transmittal sheet",
    ],
}

STORAGE_LOCATION_TIERS = {
    'tier1': [
        r"stored at",
        r"maintained at",
        r"kept at the premises",
        r"kept on.{0,10}premises",
        r"on.{0,3}site.{0,10}storage",
        r"at the facility",
        r"records.{0,10}kept",
    ],
}

FIXED_WINDOW_TIERS = {
    'tier1': [
        r"filing period",
        r"application window",
        r"applications accepted",
        r"accepted between",
        r"open enrollment",
        r"submission period",
        r"only during",
    ],
}

WAITING_PERIOD_TIERS = {
    'tier1': [
        r"waiting period",
        r"must wait",
        r"cooling off",
        r"no sooner than",
        r"not sooner than",
        r"minimum of.{0,10}days before",
        r"at least.{0,10}days before",
    ],
}

# === REPORTING ===

MANDATED_REPORTS_TIERS = {
    'tier1': [
        r"annual report",
        r"quarterly report",
        r"submit a report",
        r"file a report",
        r"reporting requirements",
        r"report to the",
        r"statistical report",
        r"publish a report",
    ],
}


# =============================================================================
# ISSUE TYPE REGISTRY
# =============================================================================

ISSUE_TYPES: dict[str, IssueTypeConfig] = {
    # === COMMUNICATION ===
    'mail_only': IssueTypeConfig(
        name='mail_only',
        display_name='Mail-Only Submission',
        db_issue_type='mail_only',
        tiers=MAIL_ONLY_TIERS,
        prompt_name='compliance_mail_only',
        response_model=MailOnlyAnalysis,
        description='Mail required with no electronic alternative',
        category='Communication',
    ),
    'certified_mail': IssueTypeConfig(
        name='certified_mail',
        display_name='Certified/Registered Mail',
        db_issue_type='certified_mail',
        tiers=CERTIFIED_MAIL_TIERS,
        prompt_name='compliance_certified_mail',
        response_model=CertifiedMailAnalysis,
        description='Certified or registered mail required',
        category='Communication',
    ),
    'fax': IssueTypeConfig(
        name='fax',
        display_name='Fax Requirements',
        db_issue_type='fax_required',
        tiers=FAX_TIERS,
        prompt_name='compliance_fax',
        response_model=FaxAnalysis,
        description='Fax required or only alternative to mail',
        category='Communication',
    ),
    'obsolete_comm': IssueTypeConfig(
        name='obsolete_comm',
        display_name='Obsolete Communication',
        db_issue_type='obsolete_comm',
        tiers=OBSOLETE_COMM_TIERS,
        prompt_name='compliance_obsolete_tech',
        response_model=ObsoleteTechAnalysis,
        description='Telegram, telex, pager references',
        category='Communication',
    ),
    'landline': IssueTypeConfig(
        name='landline',
        display_name='Landline/Telephone Required',
        db_issue_type='landline',
        tiers=LANDLINE_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Telephone/landline required',
        category='Communication',
    ),

    # === PAYMENT ===
    'check_payment': IssueTypeConfig(
        name='check_payment',
        display_name='Check/Money Order Payment',
        db_issue_type='check_payment',
        tiers=CHECK_PAYMENT_TIERS,
        prompt_name='compliance_generic',
        response_model=PaymentAnalysis,
        description='Check or money order payment required',
        category='Payment',
    ),
    'cash_only': IssueTypeConfig(
        name='cash_only',
        display_name='Cash Only Payment',
        db_issue_type='cash_only',
        tiers=CASH_ONLY_TIERS,
        prompt_name='compliance_generic',
        response_model=PaymentAnalysis,
        description='Cash-only payment required',
        category='Payment',
    ),
    'no_credit_cards': IssueTypeConfig(
        name='no_credit_cards',
        display_name='No Credit Cards',
        db_issue_type='no_credit_cards',
        tiers=NO_CREDIT_CARDS_TIERS,
        prompt_name='compliance_generic',
        response_model=PaymentAnalysis,
        description='Credit cards explicitly not accepted',
        category='Payment',
    ),
    'in_person_payment': IssueTypeConfig(
        name='in_person_payment',
        display_name='In-Person Payment',
        db_issue_type='in_person_payment',
        tiers=IN_PERSON_PAYMENT_TIERS,
        prompt_name='compliance_generic',
        response_model=PaymentAnalysis,
        description='Payment must be made in person',
        category='Payment',
    ),

    # === SIGNATURES ===
    'wet_signature': IssueTypeConfig(
        name='wet_signature',
        display_name='Wet Signature',
        db_issue_type='wet_signature',
        tiers=WET_SIGNATURE_TIERS,
        prompt_name='compliance_wet_signature',
        response_model=WetSignatureAnalysis,
        description='Physical wet/ink signature required',
        category='Signatures',
    ),
    'notarization': IssueTypeConfig(
        name='notarization',
        display_name='Notarization Required',
        db_issue_type='notarization',
        tiers=NOTARIZATION_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Notarization required',
        category='Signatures',
    ),
    'witness': IssueTypeConfig(
        name='witness',
        display_name='Witness Required',
        db_issue_type='witness',
        tiers=WITNESS_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Witness signature required',
        category='Signatures',
    ),
    'embossed_seal': IssueTypeConfig(
        name='embossed_seal',
        display_name='Embossed Seal/Stamp',
        db_issue_type='embossed_seal',
        tiers=EMBOSSED_SEAL_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Embossed or official seal required',
        category='Signatures',
    ),
    'original_document': IssueTypeConfig(
        name='original_document',
        display_name='Original Document Required',
        db_issue_type='original_document',
        tiers=ORIGINAL_DOCUMENT_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Original document required (no copies)',
        category='Signatures',
    ),

    # === PHYSICAL PRESENCE ===
    'in_person_submission': IssueTypeConfig(
        name='in_person_submission',
        display_name='In-Person Submission',
        db_issue_type='in_person_submission',
        tiers=IN_PERSON_SUBMISSION_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Physical presence required for submission',
        category='Physical Presence',
    ),
    'in_person_hearing': IssueTypeConfig(
        name='in_person_hearing',
        display_name='In-Person Hearing/Meeting',
        db_issue_type='in_person_hearing',
        tiers=IN_PERSON_HEARING_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Physical attendance at hearing required',
        category='Physical Presence',
    ),
    'in_person_pickup': IssueTypeConfig(
        name='in_person_pickup',
        display_name='In-Person Pickup',
        db_issue_type='in_person_pickup',
        tiers=IN_PERSON_PICKUP_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Must pick up in person',
        category='Physical Presence',
    ),
    'physical_forms': IssueTypeConfig(
        name='physical_forms',
        display_name='Physical Form Retrieval',
        db_issue_type='physical_forms',
        tiers=PHYSICAL_FORMS_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Forms must be obtained from physical location',
        category='Physical Presence',
    ),
    'physical_inspection': IssueTypeConfig(
        name='physical_inspection',
        display_name='Physical Inspection Location',
        db_issue_type='physical_inspection',
        tiers=PHYSICAL_INSPECTION_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Documents available for inspection at location',
        category='Physical Presence',
    ),
    'physical_posting': IssueTypeConfig(
        name='physical_posting',
        display_name='Physical Posting Required',
        db_issue_type='physical_posting',
        tiers=PHYSICAL_POSTING_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Signs/notices must be physically posted',
        category='Physical Presence',
    ),
    'bulletin_board': IssueTypeConfig(
        name='bulletin_board',
        display_name='Bulletin Board',
        db_issue_type='bulletin_board',
        tiers=BULLETIN_BOARD_TIERS,
        prompt_name='compliance_generic',
        response_model=InPersonAnalysis,
        description='Bulletin board posting required',
        category='Physical Presence',
    ),

    # === TECHNOLOGY ===
    'obsolete_media': IssueTypeConfig(
        name='obsolete_media',
        display_name='Obsolete Storage Media',
        db_issue_type='obsolete_media',
        tiers=OBSOLETE_MEDIA_TIERS,
        prompt_name='compliance_obsolete_tech',
        response_model=ObsoleteTechAnalysis,
        description='Floppy disk, CD-ROM, magnetic tape',
        category='Technology',
    ),
    'microfiche': IssueTypeConfig(
        name='microfiche',
        display_name='Microfiche/Microfilm',
        db_issue_type='microfiche',
        tiers=MICROFICHE_TIERS,
        prompt_name='compliance_obsolete_tech',
        response_model=ObsoleteTechAnalysis,
        description='Microfiche or microfilm references',
        category='Technology',
    ),
    'obsolete_software': IssueTypeConfig(
        name='obsolete_software',
        display_name='Obsolete Software/Format',
        db_issue_type='obsolete_software',
        tiers=OBSOLETE_SOFTWARE_TIERS,
        prompt_name='compliance_obsolete_tech',
        response_model=ObsoleteTechAnalysis,
        description='WordPerfect, Lotus, DOS references',
        category='Technology',
    ),
    'typewriter': IssueTypeConfig(
        name='typewriter',
        display_name='Typewriter Required',
        db_issue_type='typewriter',
        tiers=TYPEWRITER_TIERS,
        prompt_name='compliance_obsolete_tech',
        response_model=ObsoleteTechAnalysis,
        description='Typewriter or typewritten document required',
        category='Technology',
    ),
    'pdf_only': IssueTypeConfig(
        name='pdf_only',
        display_name='PDF Only Format',
        db_issue_type='pdf_only',
        tiers=PDF_ONLY_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='PDF format specifically required',
        category='Technology',
    ),
    'carbon_copy': IssueTypeConfig(
        name='carbon_copy',
        display_name='Carbon/Duplicate Copy',
        db_issue_type='carbon_copy',
        tiers=CARBON_COPY_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Carbon copy or duplicate required',
        category='Technology',
    ),
    'newspaper': IssueTypeConfig(
        name='newspaper',
        display_name='Newspaper Publication',
        db_issue_type='newspaper',
        tiers=NEWSPAPER_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Newspaper publication required',
        category='Technology',
    ),

    # === DOCUMENT FORMAT ===
    'multiple_copies': IssueTypeConfig(
        name='multiple_copies',
        display_name='Multiple Copy Submission',
        db_issue_type='multiple_copies',
        tiers=MULTIPLE_COPIES_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Multiple physical copies required',
        category='Document Format',
    ),
    'paper_specs': IssueTypeConfig(
        name='paper_specs',
        display_name='Paper Specifications',
        db_issue_type='paper_specs',
        tiers=PAPER_SPECS_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Specific paper size/type required',
        category='Document Format',
    ),
    'photo_specs': IssueTypeConfig(
        name='photo_specs',
        display_name='Photo Specifications',
        db_issue_type='photo_specs',
        tiers=PHOTO_SPECS_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Specific photo size/format required',
        category='Document Format',
    ),
    'letterhead': IssueTypeConfig(
        name='letterhead',
        display_name='Letterhead Required',
        db_issue_type='letterhead',
        tiers=LETTERHEAD_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Official letterhead required',
        category='Document Format',
    ),
    'handwriting_specs': IssueTypeConfig(
        name='handwriting_specs',
        display_name='Handwriting Specifications',
        db_issue_type='handwriting_specs',
        tiers=HANDWRITING_SPECS_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Specific handwriting requirements',
        category='Document Format',
    ),
    'binding_required': IssueTypeConfig(
        name='binding_required',
        display_name='Binding Required',
        db_issue_type='binding_required',
        tiers=BINDING_REQUIRED_TIERS,
        prompt_name='compliance_generic',
        response_model=DocumentFormatAnalysis,
        description='Document binding required',
        category='Document Format',
    ),

    # === PROCESS ===
    'physical_log': IssueTypeConfig(
        name='physical_log',
        display_name='Physical Log/Sign-in',
        db_issue_type='physical_log',
        tiers=PHYSICAL_LOG_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Physical log book or sign-in sheet required',
        category='Process',
    ),
    'routing_slip': IssueTypeConfig(
        name='routing_slip',
        display_name='Routing/Transmittal Slip',
        db_issue_type='routing_slip',
        tiers=ROUTING_SLIP_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Routing or transmittal form required',
        category='Process',
    ),
    'storage_location': IssueTypeConfig(
        name='storage_location',
        display_name='Specific Storage Location',
        db_issue_type='storage_location',
        tiers=STORAGE_LOCATION_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Records must be kept at specific location',
        category='Process',
    ),
    'fixed_window': IssueTypeConfig(
        name='fixed_window',
        display_name='Fixed Processing Window',
        db_issue_type='fixed_window',
        tiers=FIXED_WINDOW_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Applications only during fixed periods',
        category='Process',
    ),
    'waiting_period': IssueTypeConfig(
        name='waiting_period',
        display_name='Mandatory Waiting Period',
        db_issue_type='waiting_period',
        tiers=WAITING_PERIOD_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Mandatory waiting period required',
        category='Process',
    ),

    # === REPORTING ===
    'mandated_reports': IssueTypeConfig(
        name='mandated_reports',
        display_name='Mandated Reports',
        db_issue_type='mandated_reports',
        tiers=MANDATED_REPORTS_TIERS,
        prompt_name='compliance_generic',
        response_model=BaseComplianceAnalysis,
        description='Mandated reporting requirements',
        category='Reporting',
    ),
}
