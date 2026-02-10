"""
Compliance issue detection module.

Provides a generic framework for detecting various compliance issues
(wet signatures, mail-only submissions, fax requirements, etc.) across
different states (NJ, NY).

Usage:
    from compliance_issues import ComplianceIssueSearcher, STATES, ISSUE_TYPES

    searcher = ComplianceIssueSearcher(
        state_config=STATES['nj'],
        issue_config=ISSUE_TYPES['wet_signature'],
        with_statutes=True,
    )
    matches = searcher.search()
    results = await searcher.analyze(matches)
"""

from .config import StateConfig, IssueTypeConfig, STATES, ISSUE_TYPES


def __getattr__(name):
    """Lazy imports to avoid circular dependency with scripts.shared.base_searcher."""
    if name == 'ComplianceIssueSearcher':
        from .searcher import ComplianceIssueSearcher
        return ComplianceIssueSearcher
    if name == 'StatuteChecker':
        from .statute_checker import StatuteChecker
        return StatuteChecker
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    'StateConfig',
    'IssueTypeConfig',
    'STATES',
    'ISSUE_TYPES',
    'ComplianceIssueSearcher',
    'StatuteChecker',
]
