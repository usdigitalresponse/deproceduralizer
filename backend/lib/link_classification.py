"""Shared link-type classification for statute linking scripts.

Used by link_ny_statutes.py and link_nyc_statutes.py to classify the
relationship between a regulation and a cited statute based on the
surrounding context text.
"""

import re


LINK_TYPE_PATTERNS = {
    'enabling_authority': [
        re.compile(r'(?:pursuant|according)\s+to', re.IGNORECASE),
        re.compile(r'established\s+(?:by|pursuant\s+to)', re.IGNORECASE),
        re.compile(r'authorized\s+(?:by|under|pursuant\s+to)', re.IGNORECASE),
        re.compile(r'authority\s+(?:of|under|granted\s+by)', re.IGNORECASE),
        re.compile(r'(?:enacted|promulgated)\s+(?:under|pursuant)', re.IGNORECASE),
        re.compile(r'CHAPTER\s+AUTHORITY', re.IGNORECASE),
        re.compile(r'STATUTORY\s+AUTHORITY', re.IGNORECASE),
    ],
    'definition': [
        re.compile(r'as\s+defined\s+(?:by|in|pursuant\s+to|under)', re.IGNORECASE),
        re.compile(r'(?:means|shall\s+mean)', re.IGNORECASE),
        re.compile(r'definition', re.IGNORECASE),
        re.compile(r'the\s+meaning\s+(?:given|set\s+forth|provided)', re.IGNORECASE),
    ],
    'requirement': [
        re.compile(r'as\s+required\s+(?:by|under|pursuant\s+to)', re.IGNORECASE),
        re.compile(r'in\s+accordance\s+with', re.IGNORECASE),
        re.compile(r'in\s+compliance\s+with', re.IGNORECASE),
        re.compile(r'subject\s+to\s+(?:the\s+)?(?:provisions\s+of\s+)?', re.IGNORECASE),
        re.compile(r'shall\s+comply\s+with', re.IGNORECASE),
    ],
}


def classify_link_type(context: str) -> str:
    """Classify the link type based on surrounding context text."""
    for link_type, patterns in LINK_TYPE_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(context):
                return link_type
    return 'reference'
