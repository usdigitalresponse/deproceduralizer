"""
Document query functions for the research pipeline.

Fetches documents from compliance_issues and builds ProcessingUnits
for pipeline processing.
"""

from collections import defaultdict
from typing import Optional
from psycopg import Connection

# Import shared utilities and models
from lib.db import get_db_connection

from ..models.matches import ProcessingUnit, MatchInfo
from ..models.llm_outputs import Tier2Output
from ..ids import make_custom_id
from .connection import retry_db_operation


def _title_col(jurisdiction: str) -> str:
    """Map jurisdiction code to the regulatory_documents title column name."""
    if jurisdiction == "NJ":
        return "njac_title"
    elif jurisdiction == "NYC":
        return "rcny_title"
    else:
        return "nycrr_title"



def _build_match_info(pattern: str, context: str, content: str, match_id: int) -> MatchInfo:
    """
    Build a MatchInfo object from pattern/context and document content.

    Handles position finding with fallback to context-based search.

    Args:
        pattern: The regex-matched text
        context: Surrounding context from the match
        content: Full document content
        match_id: ID from compliance_issues table

    Returns:
        MatchInfo object with position information
    """
    # Find position of matched pattern in content
    pos = content.lower().find(pattern.lower()) if pattern else -1
    if pos == -1:
        # Fall back to context
        pos = content.lower().find(context[:50].lower()) if context else 0
        pos = max(0, pos)

    return MatchInfo(
        match_id=match_id,
        matched_text=pattern,
        position_start=pos,
        position_end=pos + len(pattern) if pattern else pos,
        surrounding_context=context,
    )


def _build_processing_unit(
    doc_id: int,
    issue_type: str,
    meta: dict,
    matches: list[dict],
) -> ProcessingUnit:
    """
    Build a ProcessingUnit from document metadata and matches.

    Args:
        doc_id: Document ID
        issue_type: Issue type string
        meta: Dict with citation, title, content, state
        matches: List of dicts with match_id, pattern, context

    Returns:
        ProcessingUnit ready for pipeline processing
    """
    content = meta["content"]

    # Build MatchInfo list
    match_infos = [
        _build_match_info(
            pattern=m["pattern"],
            context=m["context"],
            content=content,
            match_id=m["match_id"],
        )
        for m in matches
    ]

    return ProcessingUnit(
        document_id=doc_id,
        issue_type=issue_type,
        citation=meta["citation"],
        title=meta["title"],
        matches=match_infos,
        content=content,
        jurisdiction=meta["state"],
    )


class ProcessingUnitBuilder:
    """
    Unified builder for fetching and constructing ProcessingUnits.

    Provides methods for different query patterns:
    - fetch_unanalyzed() — documents with no analysis yet
    - fetch_with_tier_continuation() — documents needing processing up to a target tier
    - fetch_tier3_pending() — documents that completed Tier 2 but not Tier 3
    - fetch_all_issues() — multi-issue-type batch fetch
    - fetch_for_rerun() — re-process documents with a specific pipeline version

    Shares common construction logic for building ProcessingUnits from query results.
    """

    def __init__(self, conn: Optional[Connection] = None):
        """
        Initialize builder with optional connection.

        Args:
            conn: Database connection. If None, a new connection is created
                  for each query and closed after.
        """
        self._conn = conn
        self._should_close = False

    def _get_conn(self) -> Connection:
        """Get connection, creating if needed."""
        if self._conn is None:
            self._conn = get_db_connection()
            if self._conn is None:
                raise RuntimeError("Failed to establish database connection")
            self._should_close = True
        return self._conn

    def _close_if_needed(self):
        """Close connection if we created it."""
        if self._should_close and self._conn is not None:
            self._conn.close()
            self._conn = None
            self._should_close = False

    def fetch_unanalyzed(
        self,
        issue_type: str,
        limit: int = 20,
        jurisdiction: Optional[str] = None,
        title: Optional[str] = None,
    ) -> list[ProcessingUnit]:
        """
        Fetch documents from compliance_issues that haven't been analyzed yet.

        This is the primary fetch method. It queries compliance_issues (populated by
        the regex searcher) and filters to documents not yet in compliance_issue_analyses.

        Args:
            issue_type: The compliance issue type to filter by
            limit: Maximum number of documents to fetch
            jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all jurisdictions)
            title: Optional NJAC/NYCRR title to filter by (e.g., '7' for Title 7)

        Returns:
            List of ProcessingUnit objects ready for pipeline processing
        """
        conn = self._get_conn()

        # Build filter clauses
        state_filter = ""
        title_filter = ""
        params = [issue_type]

        if jurisdiction:
            state_filter = "AND rd.state = %s"
            params.append(jurisdiction)
            if title:
                title_filter = f"AND rd.{_title_col(jurisdiction)} = %s"
                params.append(title)
        else:
            # No state filter (dangerously-run-all)
            if title:
                title_filter = "AND (rd.njac_title = %s OR rd.nycrr_title = %s OR rd.rcny_title = %s)"
                params.extend([title, title, title])

        params.append(limit)

        # Get compliance issues that haven't been analyzed yet
        # Excludes documents already in compliance_issue_analyses for this issue type
        query = f"""
            WITH ranked_docs AS (
                SELECT DISTINCT ON (ci.document_id)
                    ci.document_id,
                    rd.citation,
                    rd.title,
                    rd.content,
                    rd.state
                FROM compliance_issues ci
                JOIN regulatory_documents rd ON ci.document_id = rd.id
                WHERE ci.issue_type = %s
                    {state_filter}
                    {title_filter}
                    AND rd.content IS NOT NULL
                    AND LENGTH(rd.content) > 100
                    -- Exclude documents already analyzed
                    AND NOT EXISTS (
                        SELECT 1 FROM compliance_issue_analyses cia
                        WHERE cia.document_id = ci.document_id
                        AND cia.issue_type = ci.issue_type
                    )
                ORDER BY ci.document_id, RANDOM()
                LIMIT %s
            )
            SELECT
                ci.id as match_id,
                ci.document_id,
                rd.citation,
                rd.title,
                rd.content,
                rd.state,
                ci.regex_match_pattern,
                ci.regex_match_context
            FROM compliance_issues ci
            JOIN ranked_docs rd ON ci.document_id = rd.document_id
            WHERE ci.issue_type = %s
            ORDER BY ci.document_id, ci.id
        """

        # Add issue_type again for the final WHERE clause
        params.append(issue_type)

        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()

            if not rows:
                print(f"No documents found for issue_type={issue_type}, jurisdiction={jurisdiction}")
                return []

            # Group by document_id
            doc_matches: dict[int, list[dict]] = defaultdict(list)
            doc_meta: dict[int, dict] = {}

            for row in rows:
                doc_id = row[1]
                doc_matches[doc_id].append({
                    "match_id": row[0],
                    "pattern": row[6] or "",
                    "context": row[7] or "",
                })
                if doc_id not in doc_meta:
                    doc_meta[doc_id] = {
                        "citation": row[2] or "",
                        "title": row[3] or "",
                        "content": row[4] or "",
                        "state": row[5] or "",
                    }

            # Build ProcessingUnits using shared helper
            processing_units = [
                _build_processing_unit(
                    doc_id=doc_id,
                    issue_type=issue_type,
                    meta=doc_meta[doc_id],
                    matches=matches,
                )
                for doc_id, matches in doc_matches.items()
            ]

            # Check if limit was hit
            if len(processing_units) >= limit:
                print(f"  Document limit ({limit}) reached for {issue_type}")

            return processing_units
        finally:
            self._close_if_needed()

    def fetch_with_tier_continuation(
        self,
        issue_type: str,
        max_tier: int,
        jurisdiction: Optional[str] = None,
        limit: int = 20,
        title: Optional[str] = None,
    ) -> tuple[list[ProcessingUnit], dict[tuple[int, str], dict]]:
        """
        Fetch documents that need processing up to max_tier.

        Includes:
        - Documents with NO analysis yet (new)
        - Documents with highest_tier_completed < max_tier (need continuation)

        This is the preferred fetch method for pipeline runs as it automatically
        handles resume scenarios.

        Args:
            issue_type: The compliance issue type to filter by
            max_tier: Target tier (1, 2, or 3) - fetches docs that haven't reached it
            jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all jurisdictions)
            limit: Maximum number of documents to fetch
            title: Optional NJAC/NYCRR title to filter by

        Returns:
            Tuple of (processing_units, existing_analyses)
            where existing_analyses is a dict mapping (doc_id, issue_type) to analysis data
        """
        conn = self._get_conn()

        # Build filter clauses
        # IMPORTANT: Order matters! SQL expects: issue_type, state?, title?, max_tier, limit, issue_type
        state_filter = ""
        title_filter = ""
        params: list = [issue_type]  # First WHERE clause

        if jurisdiction:
            state_filter = "AND rd.state = %s"
            params.append(jurisdiction)
            if title:
                title_filter = f"AND rd.{_title_col(jurisdiction)} = %s"
                params.append(title)
        else:
            if title:
                title_filter = "AND (rd.njac_title = %s OR rd.nycrr_title = %s OR rd.rcny_title = %s)"
                params.extend([title, title, title])

        # max_tier for the continuation check and limit come after state/title filters
        params.append(max_tier)
        params.append(limit)

        # Query that includes both:
        # 1. Documents with no analysis at all
        # 2. Documents with partial progress (highest_tier_completed < max_tier)
        query = f"""
            WITH eligible_docs AS (
                SELECT DISTINCT ON (ci.document_id)
                    ci.document_id,
                    rd.citation,
                    rd.title,
                    rd.content,
                    rd.state
                FROM compliance_issues ci
                JOIN regulatory_documents rd ON ci.document_id = rd.id
                WHERE ci.issue_type = %s
                    {state_filter}
                    {title_filter}
                    AND rd.content IS NOT NULL
                    AND LENGTH(rd.content) > 100
                    AND (
                        -- Either no analysis at all
                        NOT EXISTS (
                            SELECT 1 FROM compliance_issue_analyses cia
                            WHERE cia.document_id = ci.document_id
                            AND cia.issue_type = ci.issue_type
                        )
                        -- OR has partial progress (below target tier)
                        OR EXISTS (
                            SELECT 1 FROM compliance_issue_analyses cia
                            WHERE cia.document_id = ci.document_id
                            AND cia.issue_type = ci.issue_type
                            AND COALESCE(cia.highest_tier_completed, 0) < %s
                        )
                    )
                ORDER BY ci.document_id, RANDOM()
                LIMIT %s
            )
            SELECT
                ci.id as match_id,
                ci.document_id,
                rd.citation,
                rd.title,
                rd.content,
                rd.state,
                ci.regex_match_pattern,
                ci.regex_match_context
            FROM compliance_issues ci
            JOIN eligible_docs rd ON ci.document_id = rd.document_id
            WHERE ci.issue_type = %s
            ORDER BY ci.document_id, ci.id
        """

        # Add issue_type again for the final WHERE clause
        params.append(issue_type)

        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()

            if not rows:
                print(f"No documents found for issue_type={issue_type}, jurisdiction={jurisdiction}, max_tier={max_tier}")
                return [], {}

            # Group by document_id
            doc_matches: dict[int, list[dict]] = defaultdict(list)
            doc_meta: dict[int, dict] = {}

            for row in rows:
                doc_id = row[1]
                doc_matches[doc_id].append({
                    "match_id": row[0],
                    "pattern": row[6] or "",
                    "context": row[7] or "",
                })
                if doc_id not in doc_meta:
                    doc_meta[doc_id] = {
                        "citation": row[2] or "",
                        "title": row[3] or "",
                        "content": row[4] or "",
                        "state": row[5] or "",
                    }

            # Build ProcessingUnits
            processing_units = [
                _build_processing_unit(
                    doc_id=doc_id,
                    issue_type=issue_type,
                    meta=doc_meta[doc_id],
                    matches=matches,
                )
                for doc_id, matches in doc_matches.items()
            ]

            # Fetch existing analyses for these documents
            doc_ids = list(doc_matches.keys())
            existing_analyses = self._fetch_existing_analyses(doc_ids, issue_type)

            # Log summary
            new_count = len([d for d in doc_ids if (d, issue_type) not in existing_analyses])
            resume_count = len(existing_analyses)
            print(f"Found {len(processing_units)} documents: {new_count} new, {resume_count} resuming")

            if len(processing_units) >= limit:
                print(f"  Document limit ({limit}) reached for {issue_type}")

            return processing_units, existing_analyses
        finally:
            self._close_if_needed()

    def _fetch_existing_analyses(
        self,
        doc_ids: list[int],
        issue_type: str,
    ) -> dict[tuple[int, str], dict]:
        """
        Fetch existing analyses for a list of document IDs.

        Args:
            doc_ids: List of document IDs to query
            issue_type: Issue type to filter by

        Returns:
            Dict mapping (doc_id, issue_type) to analysis data including tier outputs
        """
        if not doc_ids:
            return {}

        conn = self._get_conn()

        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    document_id, issue_type, highest_tier_completed,
                    -- Tier 1 outputs
                    tier1_classification, tier1_relevant_match_ids, tier1_dismissed_match_ids,
                    tier1_confidence, tier1_reasoning, tier1_context_requests,
                    -- Tier 2 outputs
                    tier2_classification, tier2_confidence, tier2_reasoning,
                    severity, verbatim_requirements,
                    argument_for_regulation, argument_against_regulation,
                    cites_federal_statute, federal_citation,
                    claims_no_alternative, needs_web_search, web_search_topics,
                    -- Tier 3 outputs
                    tier3_classification, tier3_confidence, tier3_reasoning,
                    tier3_severity_adjustment, tier3_severity_adjustment_reasoning
                FROM compliance_issue_analyses
                WHERE document_id = ANY(%s) AND issue_type = %s
            """, (doc_ids, issue_type))

            results = {}
            for row in cur.fetchall():
                key = (row[0], row[1])  # (document_id, issue_type)
                results[key] = {
                    "highest_tier_completed": row[2] or 0,
                    # Tier 1
                    "tier1_classification": row[3],
                    "tier1_relevant_match_ids": row[4] or [],
                    "tier1_dismissed_match_ids": row[5] or [],
                    "tier1_confidence": row[6],
                    "tier1_reasoning": row[7],
                    "tier1_context_requests": row[8] or [],
                    # Tier 2
                    "tier2_classification": row[9],
                    "tier2_confidence": row[10],
                    "tier2_reasoning": row[11],
                    "severity": row[12],
                    "verbatim_requirements": row[13] or [],
                    "argument_for_regulation": row[14],
                    "argument_against_regulation": row[15],
                    "cites_federal_statute": row[16],
                    "federal_citation": row[17],
                    "claims_no_alternative": row[18],
                    "needs_web_search": row[19],
                    "web_search_topics": row[20] or [],
                    # Tier 3
                    "tier3_classification": row[21],
                    "tier3_confidence": row[22],
                    "tier3_reasoning": row[23],
                    "tier3_severity_adjustment": row[24],
                    "tier3_severity_adjustment_reasoning": row[25],
                }

            return results

    def _fetch_existing_analyses_batch(
        self,
        doc_issue_pairs: list[tuple[int, str]],
    ) -> dict[tuple[int, str], dict]:
        """
        Fetch existing analyses for multiple (doc_id, issue_type) pairs.

        Used by fetch_all_issues() to handle multiple issue types at once.

        Args:
            doc_issue_pairs: List of (document_id, issue_type) tuples

        Returns:
            Dict mapping (doc_id, issue_type) to analysis data including tier outputs
        """
        if not doc_issue_pairs:
            return {}

        conn = self._get_conn()

        # Split tuples into separate arrays for unnest
        doc_ids = [pair[0] for pair in doc_issue_pairs]
        issue_types = [pair[1] for pair in doc_issue_pairs]

        with conn.cursor() as cur:
            # Use unnest with two arrays for efficient batch lookup
            cur.execute("""
                WITH pairs AS (
                    SELECT unnest(%s::int[]) AS doc_id, unnest(%s::text[]) AS issue_type
                )
                SELECT
                    cia.document_id, cia.issue_type, cia.highest_tier_completed,
                    -- Tier 1 outputs
                    cia.tier1_classification, cia.tier1_relevant_match_ids, cia.tier1_dismissed_match_ids,
                    cia.tier1_confidence, cia.tier1_reasoning, cia.tier1_context_requests,
                    -- Tier 2 outputs
                    cia.tier2_classification, cia.tier2_confidence, cia.tier2_reasoning,
                    cia.severity, cia.verbatim_requirements,
                    cia.argument_for_regulation, cia.argument_against_regulation,
                    cia.cites_federal_statute, cia.federal_citation,
                    cia.claims_no_alternative, cia.needs_web_search, cia.web_search_topics,
                    -- Tier 3 outputs
                    cia.tier3_classification, cia.tier3_confidence, cia.tier3_reasoning,
                    cia.tier3_severity_adjustment, cia.tier3_severity_adjustment_reasoning
                FROM compliance_issue_analyses cia
                JOIN pairs p ON cia.document_id = p.doc_id AND cia.issue_type = p.issue_type
            """, (doc_ids, issue_types))

            results = {}
            for row in cur.fetchall():
                key = (row[0], row[1])  # (document_id, issue_type)
                results[key] = {
                    "highest_tier_completed": row[2] or 0,
                    # Tier 1
                    "tier1_classification": row[3],
                    "tier1_relevant_match_ids": row[4] or [],
                    "tier1_dismissed_match_ids": row[5] or [],
                    "tier1_confidence": row[6],
                    "tier1_reasoning": row[7],
                    "tier1_context_requests": row[8] or [],
                    # Tier 2
                    "tier2_classification": row[9],
                    "tier2_confidence": row[10],
                    "tier2_reasoning": row[11],
                    "severity": row[12],
                    "verbatim_requirements": row[13] or [],
                    "argument_for_regulation": row[14],
                    "argument_against_regulation": row[15],
                    "cites_federal_statute": row[16],
                    "federal_citation": row[17],
                    "claims_no_alternative": row[18],
                    "needs_web_search": row[19],
                    "web_search_topics": row[20] or [],
                    # Tier 3
                    "tier3_classification": row[21],
                    "tier3_confidence": row[22],
                    "tier3_reasoning": row[23],
                    "tier3_severity_adjustment": row[24],
                    "tier3_severity_adjustment_reasoning": row[25],
                }

            return results

    def fetch_tier3_pending(
        self,
        issue_type: str,
        jurisdiction: str = "NJ",
        limit: int = 20,
    ) -> tuple[list[ProcessingUnit], dict[str, Tier2Output]]:
        """
        Fetch documents that completed Tier 2 but not Tier 3.

        Validates each document has valid Tier 2 output before including.
        Returns processing units AND their pre-loaded Tier 2 outputs.

        Args:
            issue_type: The compliance issue type to filter by
            jurisdiction: Jurisdiction code (NJ, NY, or NYC)
            limit: Maximum number of documents to fetch

        Returns:
            Tuple of (processing_units, tier2_outputs_by_custom_id)
            where tier2_outputs_by_custom_id maps custom_id to Tier2Output
        """
        conn = self._get_conn()

        print(f"\n{'='*70}")
        print("FETCHING TIER 3 PENDING DOCUMENTS")
        print(f"{'='*70}")
        print(f"Issue type: {issue_type}")
        print(f"Jurisdiction: {jurisdiction}")
        print(f"Limit: {limit}")
        print()

        # Query for documents where highest_tier_completed = 2
        # and tier2_classification indicates Tier 3 is needed
        query = """
            SELECT
                cia.document_id, cia.issue_type,
                cia.tier2_classification, cia.tier2_confidence, cia.tier2_reasoning,
                cia.severity, cia.verbatim_requirements,
                cia.argument_for_regulation, cia.argument_against_regulation,
                cia.cites_federal_statute, cia.federal_citation,
                cia.claims_no_alternative, cia.needs_web_search, cia.web_search_topics,
                cia.potentially_controversial, cia.federal_mandate_suspected,
                rd.citation, rd.title, rd.content, rd.state
            FROM compliance_issue_analyses cia
            JOIN regulatory_documents rd ON cia.document_id = rd.id
            WHERE cia.highest_tier_completed = 2
              AND cia.state = %s
              AND cia.issue_type = %s
              AND cia.tier2_classification IN ('burdensome', 'justified')
            ORDER BY cia.document_id
            LIMIT %s
        """

        try:
            with conn.cursor() as cur:
                cur.execute(query, (jurisdiction, issue_type, limit))
                analyses = cur.fetchall()

            print(f"Found {len(analyses)} analyses with highest_tier_completed=2")

            if not analyses:
                print("  No documents pending Tier 3.")
                return [], {}

            # OPTIMIZATION: Batch fetch all matches instead of N+1 queries
            doc_issue_pairs = [(row[0], row[1]) for row in analyses]  # (doc_id, issue_type)
            matches_query = """
                SELECT document_id, issue_type, id, regex_match_pattern, regex_match_context
                FROM compliance_issues
                WHERE (document_id, issue_type) IN %s
                ORDER BY document_id, issue_type, id
            """
            with conn.cursor() as cur:
                cur.execute(matches_query, (tuple(doc_issue_pairs),))
                all_matches = cur.fetchall()

            # Group matches by (doc_id, issue_type)
            from collections import defaultdict
            matches_by_doc: dict[tuple[int, str], list] = defaultdict(list)
            for match_row in all_matches:
                key = (match_row[0], match_row[1])  # (doc_id, issue_type)
                matches_by_doc[key].append(match_row[2:])  # (id, pattern, context)

            # Validate and build results
            processing_units = []
            tier2_outputs: dict[str, Tier2Output] = {}
            skipped = 0

            for row in analyses:
                (doc_id, issue_type_val,
                 t2_classification, t2_confidence, t2_reasoning,
                 severity, verbatim_requirements,
                 argument_for, argument_against,
                 cites_federal, federal_citation,
                 claims_no_alt, needs_web_search, web_search_topics,
                 potentially_controversial, federal_mandate_suspected,
                 citation, title, content, doc_state) = row

                # Validate required Tier 2 fields
                if not t2_classification or not t2_reasoning:
                    print(f"  Skipping doc {doc_id}: missing tier2_classification or tier2_reasoning")
                    skipped += 1
                    continue

                # Get pre-fetched matches
                matches = matches_by_doc.get((doc_id, issue_type_val), [])

                if not matches:
                    print(f"  Skipping doc {doc_id}: no matches in compliance_issues")
                    skipped += 1
                    continue

                # Build MatchInfo objects
                match_infos = [
                    _build_match_info(
                        pattern=m[1] or "",
                        context=m[2] or "",
                        content=content or "",
                        match_id=m[0],
                    )
                    for m in matches
                ]

                # Build ProcessingUnit
                pu = ProcessingUnit(
                    document_id=doc_id,
                    issue_type=issue_type_val,
                    citation=citation or f"Document {doc_id}",
                    title=title or "",
                    matches=match_infos,
                    content=content or "",
                    jurisdiction=doc_state or jurisdiction,
                )
                processing_units.append(pu)

                # Build custom_id (same format as orchestrator)
                custom_id = make_custom_id(doc_id, issue_type_val)

                # Build Tier2Output from database
                tier2_outputs[custom_id] = Tier2Output(
                    classification=t2_classification,
                    confidence=t2_confidence or 0.8,
                    reasoning=t2_reasoning or "",
                    argument_for_regulation=argument_for or "",
                    argument_against_regulation=argument_against or "",
                    severity=severity,
                    verbatim_requirements=verbatim_requirements or [],
                    cites_federal_statute=cites_federal or False,
                    federal_citation=federal_citation,
                    claims_no_alternative=claims_no_alt or False,
                    needs_web_search=needs_web_search or False,
                    web_search_topics=web_search_topics or [],
                    potentially_controversial=potentially_controversial or False,
                    federal_mandate_suspected=federal_mandate_suspected or False,
                )

                # Verbose output for each valid document
                print(f"  {citation}: {t2_classification} (severity={severity})")
                print(f"      Matches: {len(match_infos)}, needs_web_search={needs_web_search}")

            print()
            print(f"Summary: {len(processing_units)} valid, {skipped} skipped")
            print()

            return processing_units, tier2_outputs
        finally:
            self._close_if_needed()

    def fetch_all_issues(
        self,
        issue_types: list[str],
        jurisdiction: Optional[str],
        max_tier: int,
        max_docs_per_issue: int = 20,
        global_docs_limit: Optional[int] = None,
        title: Optional[str] = None,
    ) -> tuple[list[ProcessingUnit], dict[tuple[int, str], dict]]:
        """
        Fetch documents across multiple issue types with limits.

        Only fetches documents that need processing:
        - Documents with NO analysis yet (new)
        - Documents with highest_tier_completed < max_tier (need continuation)

        Groups matches by (document_id, issue_type) and creates one ProcessingUnit per pair.

        Args:
            issue_types: List of issue types to fetch
            jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all jurisdictions)
            max_tier: Target tier (1, 2, or 3) - only fetches docs that haven't reached it
            max_docs_per_issue: Maximum documents per issue type
            global_docs_limit: Maximum total documents across all issue types
            title: Optional NJAC/NYCRR title to filter by

        Returns:
            Tuple of (processing_units, existing_analyses)
            where existing_analyses maps (doc_id, issue_type) to analysis data
        """
        conn = self._get_conn()

        # Build filter clauses
        # IMPORTANT: Parameter order must match SQL placeholders
        state_filter = ""
        title_filter = ""
        params: list = []

        # Track title for later - must be added after issue_types in params
        title_value = title
        title_col = None

        if jurisdiction:
            state_filter = "rd.state = %s AND"
            params.append(jurisdiction)
            if title:
                title_filter = f"AND rd.{_title_col(jurisdiction)} = %s"
                # Don't append here - will append after issue_types
        else:
            # No state filter (dangerously-run-all)
            if title:
                title_filter = "AND (rd.njac_title = %s OR rd.nycrr_title = %s OR rd.rcny_title = %s)"
                # Don't append here - will append after issue_types

        # Query that fetches up to max_docs_per_issue per issue type using window functions
        # This ensures fair distribution across issue types before applying global limit
        # NEW: Only fetches documents that need processing (no analysis OR below max_tier)
        query = f"""
            WITH issue_docs AS (
                SELECT
                    ci.id as match_id,
                    ci.document_id,
                    ci.issue_type,
                    rd.citation,
                    rd.title,
                    rd.content,
                    rd.state,
                    ci.regex_match_pattern,
                    ci.regex_match_context,
                    ROW_NUMBER() OVER (
                        PARTITION BY ci.issue_type, ci.document_id
                        ORDER BY ci.id
                    ) as match_rank,
                    DENSE_RANK() OVER (
                        PARTITION BY ci.issue_type
                        ORDER BY ci.document_id
                    ) as doc_rank
                FROM compliance_issues ci
                JOIN regulatory_documents rd ON ci.document_id = rd.id
                WHERE {state_filter}
                    ci.issue_type = ANY(%s)
                    {title_filter}
                    AND rd.content IS NOT NULL
                    AND LENGTH(rd.content) > 100
                    -- Only fetch docs that need processing
                    AND (
                        NOT EXISTS (
                            SELECT 1 FROM compliance_issue_analyses cia
                            WHERE cia.document_id = ci.document_id
                            AND cia.issue_type = ci.issue_type
                        )
                        OR EXISTS (
                            SELECT 1 FROM compliance_issue_analyses cia
                            WHERE cia.document_id = ci.document_id
                            AND cia.issue_type = ci.issue_type
                            AND COALESCE(cia.highest_tier_completed, 0) < %s
                        )
                    )
                    -- Exclude terminal items (all_false_positives or unrelated after tier 2)
                    AND NOT EXISTS (
                        SELECT 1 FROM compliance_issue_analyses cia
                        WHERE cia.document_id = ci.document_id
                        AND cia.issue_type = ci.issue_type
                        AND (
                            cia.tier1_classification = 'all_false_positives'
                            OR (COALESCE(cia.highest_tier_completed, 0) >= 2
                                AND cia.tier2_classification = 'unrelated')
                        )
                    )
            )
            SELECT
                match_id,
                document_id,
                issue_type,
                citation,
                title,
                content,
                state,
                regex_match_pattern,
                regex_match_context
            FROM issue_docs
            WHERE doc_rank <= %s
            ORDER BY issue_type, document_id, match_id
        """

        params.append(issue_types)
        # Add title params after issue_types (to match query order)
        if title_value:
            if jurisdiction:
                params.append(title_value)
            else:
                params.extend([title_value, title_value, title_value])
        # Add max_tier for the continuation check
        params.append(max_tier)
        params.append(max_docs_per_issue)

        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()

            if not rows:
                print(f"No documents found for issue_types={issue_types}, jurisdiction={jurisdiction}, max_tier={max_tier}")
                return [], {}

            # Group by (document_id, issue_type)
            doc_issue_matches: dict[tuple[int, str], list[dict]] = defaultdict(list)
            doc_issue_meta: dict[tuple[int, str], dict] = {}

            for row in rows:
                doc_id = row[1]
                issue_type = row[2]
                key = (doc_id, issue_type)

                doc_issue_matches[key].append({
                    "match_id": row[0],
                    "pattern": row[7] or "",
                    "context": row[8] or "",
                })

                if key not in doc_issue_meta:
                    doc_issue_meta[key] = {
                        "citation": row[3] or "",
                        "title": row[4] or "",
                        "content": row[5] or "",
                        "state": row[6] or "",
                    }

            # Build ProcessingUnits using shared helper
            processing_units = [
                _build_processing_unit(
                    doc_id=doc_id,
                    issue_type=issue_type,
                    meta=doc_issue_meta[(doc_id, issue_type)],
                    matches=matches,
                )
                for (doc_id, issue_type), matches in doc_issue_matches.items()
            ]

            # Check which issue types hit the per-issue limit
            docs_per_issue: dict[str, int] = defaultdict(int)
            for pu in processing_units:
                docs_per_issue[pu.issue_type] += 1

            capped_issues = [it for it, count in docs_per_issue.items() if count >= max_docs_per_issue]
            if capped_issues:
                print(f"  Per-issue limit ({max_docs_per_issue}) hit for: {', '.join(sorted(capped_issues))}")

            # Apply global limit if specified
            if global_docs_limit and len(processing_units) > global_docs_limit:
                print(f"  Global limit hit: {len(processing_units)} documents -> capped to {global_docs_limit}")
                processing_units = processing_units[:global_docs_limit]

            # Fetch existing analyses for returned documents
            doc_issue_pairs = [(pu.document_id, pu.issue_type) for pu in processing_units]
            existing_analyses = self._fetch_existing_analyses_batch(doc_issue_pairs)

            # Log summary
            new_count = len([pu for pu in processing_units if (pu.document_id, pu.issue_type) not in existing_analyses])
            resume_count = len(processing_units) - new_count
            print(f"Found {len(processing_units)} documents: {new_count} new, {resume_count} resuming")

            return processing_units, existing_analyses
        finally:
            self._close_if_needed()

    def fetch_for_rerun(
        self,
        pipeline_version: str,
        issue_type: Optional[str] = None,
        jurisdiction: str = "NJ",
        limit: int = 20,
    ) -> list[ProcessingUnit]:
        """
        Fetch documents from existing analyses for re-processing.

        Queries compliance_issue_analyses WHERE pipeline_version = X,
        then fetches associated matches from compliance_issues.

        Args:
            pipeline_version: Pipeline version to re-run (e.g., 'v4-migrated', 'v5')
            issue_type: Optional filter by issue type
            jurisdiction: Jurisdiction code (NJ, NY, or NYC)
            limit: Maximum number of documents to fetch

        Returns:
            List of ProcessingUnit objects for re-processing
        """
        conn = self._get_conn()

        # Query existing analyses with the specified pipeline version
        params = [pipeline_version, jurisdiction]
        issue_filter = ""
        if issue_type:
            issue_filter = "AND cia.issue_type = %s"
            params.append(issue_type)
        params.append(limit)

        query = f"""
            SELECT cia.document_id, cia.issue_type, rd.citation, rd.title, rd.content, rd.state
            FROM compliance_issue_analyses cia
            JOIN regulatory_documents rd ON cia.document_id = rd.id
            WHERE cia.pipeline_version = %s
              AND cia.state = %s
              {issue_filter}
            ORDER BY cia.document_id
            LIMIT %s
        """

        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                analyses = cur.fetchall()

            if not analyses:
                print(f"No analyses found with pipeline_version={pipeline_version}, jurisdiction={jurisdiction}")
                return []

            print(f"Found {len(analyses)} analyses to re-run")

            # OPTIMIZATION: Batch fetch all matches instead of N+1 queries
            doc_issue_pairs = [(row[0], row[1]) for row in analyses]  # (doc_id, issue_type)
            matches_query = """
                SELECT document_id, issue_type, id, regex_match_pattern, regex_match_context
                FROM compliance_issues
                WHERE (document_id, issue_type) IN %s
                ORDER BY document_id, issue_type, id
            """
            with conn.cursor() as cur:
                cur.execute(matches_query, (tuple(doc_issue_pairs),))
                all_matches = cur.fetchall()

            # Group matches by (doc_id, issue_type)
            from collections import defaultdict
            matches_by_doc: dict[tuple[int, str], list] = defaultdict(list)
            for match_row in all_matches:
                key = (match_row[0], match_row[1])  # (doc_id, issue_type)
                matches_by_doc[key].append(match_row[2:])  # (id, pattern, context)

            # Build processing units
            processing_units = []
            for row in analyses:
                doc_id, issue_type_val, citation, title, content, doc_state = row

                # Get pre-fetched matches
                matches = matches_by_doc.get((doc_id, issue_type_val), [])

                if not matches:
                    print(f"  Warning: No matches in compliance_issues for doc {doc_id}/{issue_type_val}")
                    continue

                # Build MatchInfo objects
                match_infos = [
                    _build_match_info(
                        pattern=m[1] or "",
                        context=m[2] or "",
                        content=content or "",
                        match_id=m[0],
                    )
                    for m in matches
                ]

                processing_units.append(ProcessingUnit(
                    document_id=doc_id,
                    issue_type=issue_type_val,
                    citation=citation or f"Document {doc_id}",
                    title=title or "",
                    matches=match_infos,
                    content=content or "",
                    jurisdiction=doc_state or jurisdiction,
                ))

            return processing_units
        finally:
            self._close_if_needed()


def get_issue_types_for_scope(
    jurisdiction: Optional[str],
    title: Optional[str] = None,
    conn: Optional[Connection] = None,
) -> list[str]:
    """
    Get all issue types that have compliance issues in the given scope.

    Args:
        jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all jurisdictions)
        title: Optional filter by regulatory title
        conn: Optional database connection

    Returns:
        List of issue type strings
    """
    if conn is None:
        conn = get_db_connection()
        if conn is None:
            raise RuntimeError("Failed to establish database connection")
        should_close = True
    else:
        should_close = False

    try:
        # Build query conditionally
        state_filter = ""
        title_filter = ""
        params = []

        if jurisdiction:
            state_filter = "WHERE rd.state = %s"
            params.append(jurisdiction)
            if title:
                title_filter = f"AND rd.{_title_col(jurisdiction)} = %s"
                params.append(title)
        else:
            # No state filter (dangerously-run-all)
            # Title filter still works but we pick a default column
            if title:
                state_filter = "WHERE (rd.njac_title = %s OR rd.nycrr_title = %s OR rd.rcny_title = %s)"
                params.extend([title, title, title])

        query = f"""
            SELECT DISTINCT ci.issue_type
            FROM compliance_issues ci
            JOIN regulatory_documents rd ON ci.document_id = rd.id
            {state_filter} {title_filter}
            ORDER BY ci.issue_type
        """

        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

        return [row[0] for row in rows]
    finally:
        if should_close:
            conn.close()


# Module-level API functions with retry for resilience to connection failures

@retry_db_operation()
def fetch_tier3_pending_documents(
    issue_type: str,
    jurisdiction: str = "NJ",
    limit: int = 20,
) -> tuple[list[ProcessingUnit], dict[str, Tier2Output]]:
    """
    Fetch documents that completed Tier 2 but not Tier 3.

    Automatically retries on connection failures.
    """
    builder = ProcessingUnitBuilder()
    return builder.fetch_tier3_pending(
        issue_type=issue_type,
        jurisdiction=jurisdiction,
        limit=limit,
    )


@retry_db_operation()
def fetch_all_issue_documents(
    issue_types: list[str],
    jurisdiction: Optional[str],
    max_tier: int,
    max_docs_per_issue: int = 20,
    global_docs_limit: Optional[int] = None,
    title: Optional[str] = None,
) -> tuple[list[ProcessingUnit], dict[tuple[int, str], dict]]:
    """
    Fetch documents across multiple issue types with limits.

    Only fetches documents that need processing:
    - Documents with NO analysis yet (new)
    - Documents with highest_tier_completed < max_tier (need continuation)

    Also returns existing analyses pre-loaded, avoiding an extra DB query.
    Automatically retries on connection failures.

    Args:
        issue_types: List of issue types to fetch
        jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all jurisdictions)
        max_tier: Target tier (1, 2, or 3) - only fetches docs that haven't reached it
        max_docs_per_issue: Maximum documents per issue type
        global_docs_limit: Maximum total documents across all issue types
        title: Optional NJAC/NYCRR title to filter by

    Returns:
        Tuple of (processing_units, existing_analyses)
        where existing_analyses maps (doc_id, issue_type) to analysis data
    """
    builder = ProcessingUnitBuilder()
    return builder.fetch_all_issues(
        issue_types=issue_types,
        jurisdiction=jurisdiction,
        max_tier=max_tier,
        max_docs_per_issue=max_docs_per_issue,
        global_docs_limit=global_docs_limit,
        title=title,
    )


@retry_db_operation()
def fetch_documents_with_continuation(
    issue_type: str,
    max_tier: int,
    jurisdiction: Optional[str] = None,
    limit: int = 20,
    title: Optional[str] = None,
) -> tuple[list[ProcessingUnit], dict[tuple[int, str], dict]]:
    """
    Fetch documents that need processing up to max_tier.

    This is the preferred fetch function for pipeline runs as it automatically
    handles resume scenarios by including:
    - Documents with NO analysis yet (new)
    - Documents with highest_tier_completed < max_tier (need continuation)

    Also returns existing analyses pre-loaded, avoiding an extra DB query.
    Automatically retries on connection failures.

    Args:
        issue_type: The compliance issue type to filter by
        max_tier: Target tier (1, 2, or 3) - fetches docs that haven't reached it
        jurisdiction: Jurisdiction code ('NJ', 'NY', 'NYC', or None for all jurisdictions)
        limit: Maximum number of documents to fetch
        title: Optional NJAC/NYCRR title to filter by

    Returns:
        Tuple of (processing_units, existing_analyses)
        where existing_analyses maps (doc_id, issue_type) to analysis data
    """
    builder = ProcessingUnitBuilder()
    return builder.fetch_with_tier_continuation(
        issue_type=issue_type,
        max_tier=max_tier,
        jurisdiction=jurisdiction,
        limit=limit,
        title=title,
    )
