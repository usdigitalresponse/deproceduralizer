"""Rule-based classification of guidance documents.

Three-pass approach (pure SQL, no LLM):
  Pass 1: Flag attachments by title pattern
  Pass 2: Assign policy_category by doc_type mapping
  Pass 3: Title/agency-based fallback for remaining 'unclassified' (doc_type='other')
"""

from lib.db import get_db_connection

# doc_type -> policy_category mapping
DOC_TYPE_CATEGORY: dict[str, str] = {
    # policy_directive — binding or directive guidance from agencies
    "ADM": "policy_directive",
    "LCM": "policy_directive",
    "DAL": "policy_directive",
    "Directive": "policy_directive",
    "Policy Directive": "policy_directive",
    "Policy Memorandum": "policy_directive",
    "Advisory": "policy_directive",
    "Subject Number Bulletin": "policy_directive",
    "Building Code Guidance": "policy_directive",
    "Memorandum": "policy_directive",
    "Guidance": "policy_directive",
    "guidance": "policy_directive",
    "Bulletin": "policy_directive",
    "Advisory Opinion": "policy_directive",
    "Policy Statement": "policy_directive",
    "Divisional Order": "policy_directive",
    "Delegation": "policy_directive",
    "policy": "policy_directive",
    "Operational Bulletin": "policy_directive",
    "Renewal Advisory Letter": "policy_directive",
    # legal_interpretation — legal analysis and regulatory text
    "Formal Opinion": "legal_interpretation",
    "Informal Opinion": "legal_interpretation",
    "Regulatory Document": "legal_interpretation",
    "Legal Memorandum": "legal_interpretation",
    "Code Interpretation": "legal_interpretation",
    "Regulation": "legal_interpretation",
    "Proposed Regulation": "legal_interpretation",
    "regulation_text": "legal_interpretation",
    # tax_guidance
    "TSB-M": "tax_guidance",
    # informational
    "INF": "informational",
    "GIS": "informational",
    "Fact Sheet": "informational",
    "Code Outreach": "informational",
    "Technical Bulletin": "informational",
    "DBIC Bulletin": "informational",
    "MDO Bulletin": "informational",
    "WCIC Bulletin": "informational",
    "TA": "informational",
    "notice": "informational",
    "Circular Letter": "informational",
    "compliance_guide": "informational",
    # reference_material
    "CPS-Manual": "reference_material",
    "publication": "reference_material",
    "Publication": "reference_material",
    "Planning Guide": "reference_material",
    "Local Government Guide": "reference_material",
    "Building Code Guide": "reference_material",
    "Code": "reference_material",
    # non_policy — forms, correspondence, procurement, presentations
    "presentation": "non_policy",
    "letter": "non_policy",
    "form": "non_policy",
    "Form": "non_policy",
    "newsletter": "non_policy",
    "Contract Letter": "non_policy",
    "Procurement Guidance": "non_policy",
    "Requirement Letter": "non_policy",
    "Plan": "non_policy",
}

# Attachment pattern (case-insensitive SQL regex)
ATTACHMENT_PATTERN = r"(attachment|att\s*\d|att\.|appendix|enclosure)"

# Title-based OVERRIDE rules — applied to ALL docs (any doc_type/category).
# These catch docs whose doc_type maps to policy_directive but whose content
# is clearly not policy (environmental plans, clinical reports, data dumps, etc.).
TITLE_OVERRIDE_RULES: list[tuple[str, str, str]] = [
    # Environmental planning docs — not guidance (NYSDEC mostly)
    ("title ~* 'environmental impact|\\mEIS\\M|\\mPEIS\\M|master plan|unit management plan'", "reference_material", "environmental planning"),
    ("title ~* '\\mstudy\\M.*\\m(for|of)\\M|fire tower study|workload study'", "reference_material", "studies/reports"),
    # NYSDOH clinical reports and consumer guides
    ("title ~* 'quick reference guide|consumer resource guide'", "reference_material", "reference guides"),
    ("title ~* 'report of the recommendations'", "reference_material", "clinical reports"),
    # Scenic/recreational trail plans (NYSDEC)
    ("title ~* 'trail|hut.to.hut|scenic|corridor.*plan'", "reference_material", "trail/recreation plans"),
]

# Title-based fallback rules for doc_type='other' (unclassified after Pass 2).
# Applied in order; first match wins. Each is (sql_condition, category, label).
TITLE_FALLBACK_RULES: list[tuple[str, str, str]] = [
    # SLA monthly license/permit lists — massive data dumps, not policy
    ("title ~* 'permit|retailer|wholesaler|manufacturer|solicitor'", "data_dump", "SLA license/permit lists"),
    # OCFS grant recipient lists
    ("title ~* 'grant recipient|stabilization grant|workforce.*grant|desert grant'", "data_dump", "grant recipient lists"),
    # Federal plans (CCDF etc.)
    ("title ~* 'CCDF|FFY.*plan'", "reference_material", "federal plans"),
    # Field guidance, policy memos, standards
    ("title ~* 'field guidance|field memo'", "policy_directive", "field guidance"),
    ("title ~* 'policies and procedures|policy|standards for certified'", "policy_directive", "policies/standards"),
    ("title ~* 'guideline|classification guideline|overview.*prevailing'", "policy_directive", "guidelines"),
    # Informational letters that got typed as 'other'
    ("title ~* 'informational letter|informational:'", "informational", "informational letters"),
    ("title ~* 'fact.?sheet|flyer|poster|testimonial'", "informational", "fact sheets/flyers"),
    # Method-of-operation decisions (SLA)
    ("title ~* 'method of operation|beer dispensing'", "policy_directive", "SLA method-of-operation"),
    ("title ~* 'fee.*(chart|schedule)'", "reference_material", "fee schedules"),
    # Billing manuals, ePaces, eMedny
    ("title ~* 'manual|billing|ePaces|eMedny'", "reference_material", "billing manuals"),
    # Contract and Medicaid docs
    ("title ~* 'contract|medicaid'", "reference_material", "contracts/Medicaid"),
    # OCFS forms (ocfs-NNNN pattern)
    ("title ~* 'ocfs.\\d{4}|form|application'", "non_policy", "forms/applications"),
    # Guides and how-to docs
    ("title ~* 'guide|how to|handbook|tutorial|introduction to'", "reference_material", "guides/handbooks"),
    # Topic landing pages (OPWDD single-word titles like "Employment", "Safety")
    ("LENGTH(title) < 25 AND title !~* '\\d'", "non_policy", "topic landing pages"),
    # SLA docket-style references (YYYY-NNNNN pattern)
    ("title ~ '^\\d{4}-\\d{4,5}'", "non_policy", "SLA docket entries"),
    # Regulation section references in title (NNN space pattern from OCFS)
    ("title ~ '^\\d{3}\\s'", "reference_material", "regulation section refs"),
]


def _build_case_expr(
    mapping: dict[str, str],
) -> tuple[str, list[str]]:
    """Build a SQL CASE expression from the doc_type -> category mapping."""
    when_clauses = []
    params: list[str] = []
    for doc_type, category in mapping.items():
        when_clauses.append("WHEN doc_type = %s THEN %s")
        params.extend([doc_type, category])
    return " ".join(when_clauses), params


def _build_full_case_expr(
    doc_type_mapping: dict[str, str],
    title_rules: list[tuple[str, str, str]],
) -> tuple[str, list[str]]:
    """Build a single flat CASE: doc_type WHENs first, then title fallback WHENs."""
    # doc_type rules first (these are more specific)
    when_clauses = []
    params: list[str] = []
    for doc_type, category in doc_type_mapping.items():
        when_clauses.append("WHEN doc_type = %s THEN %s")
        params.extend([doc_type, category])

    # Then title-based fallbacks (only match when doc_type didn't)
    for condition, category, _label in title_rules:
        when_clauses.append(f"WHEN {condition} THEN %s")
        params.append(category)

    return " ".join(when_clauses), params


def classify(dry_run: bool = True) -> None:
    """Run rule-based classification on guidance_documents."""
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    try:
        cur = conn.cursor()
        case_expr, case_params = _build_case_expr(DOC_TYPE_CATEGORY)

        # Pass 1: Flag attachments
        if dry_run:
            cur.execute(
                "SELECT COUNT(*) FROM guidance_documents WHERE title ~* %s",
                (ATTACHMENT_PATTERN,),
            )
            attachment_count = cur.fetchone()[0]
            print(f"[DRY RUN] Pass 1: Would flag {attachment_count} docs as attachments")
        else:
            cur.execute(
                "UPDATE guidance_documents SET is_attachment = (title ~* %s)",
                (ATTACHMENT_PATTERN,),
            )
            attachment_count = cur.rowcount
            print(f"Pass 1: Updated is_attachment on {attachment_count} rows")

        # Pass 2: Assign policy_category by doc_type
        if dry_run:
            print(f"\n[DRY RUN] Pass 2: Would assign policy_category by doc_type")
        else:
            sql = f"""
                UPDATE guidance_documents
                SET policy_category = CASE {case_expr} ELSE 'unclassified' END
            """
            cur.execute(sql, case_params)
            print(f"Pass 2: Set policy_category on {cur.rowcount} rows")
            conn.commit()

        # Pass 3: Title-based override for known non-policy docs (any doc_type)
        _run_title_overrides(cur, dry_run=dry_run)
        if not dry_run:
            conn.commit()

        # Pass 4: Title-based fallback for remaining unclassified
        _run_title_fallbacks(cur, dry_run=dry_run)
        if not dry_run:
            conn.commit()

        # Pass 5: Flag raw PDF blobs (text extraction failed)
        _flag_raw_pdfs(cur, dry_run=dry_run)
        if not dry_run:
            conn.commit()

        # Print detailed report using the full nested CASE in dry-run
        full_expr, full_params = _build_full_case_expr(DOC_TYPE_CATEGORY, TITLE_FALLBACK_RULES)
        print_detailed_report(cur, full_expr, full_params, dry_run=dry_run)

    finally:
        conn.close()


def _run_title_overrides(cur, dry_run: bool = True) -> None:
    """Pass 3: Reclassify docs with known non-policy titles (any doc_type)."""
    prefix = "[DRY RUN] " if dry_run else ""
    print(f"\n{prefix}Pass 3: Title-based overrides (all doc_types)")

    total = 0
    for condition, category, label in TITLE_OVERRIDE_RULES:
        if dry_run:
            sql = f"""
                SELECT COUNT(*) FROM guidance_documents
                WHERE policy_category IN ('policy_directive', 'informational')
                AND {condition}
            """
            cur.execute(sql)
        else:
            sql = f"""
                UPDATE guidance_documents
                SET policy_category = %s
                WHERE policy_category IN ('policy_directive', 'informational')
                AND {condition}
            """
            cur.execute(sql, (category,))

        count = cur.fetchone()[0] if dry_run else cur.rowcount
        if count > 0:
            print(f"  {label:35} -> {category:20} {count:>5}")
            total += count

    print(f"  {'TOTAL overridden':35}    {' ':20} {total:>5}")


def _run_title_fallbacks(cur, dry_run: bool = True) -> None:
    """Pass 3: Reclassify 'unclassified' docs using title/agency patterns."""
    prefix = "[DRY RUN] " if dry_run else ""
    print(f"\n{prefix}Pass 3: Title-based fallback rules for doc_type='other'")

    total_reclassified = 0
    for condition, category, label in TITLE_FALLBACK_RULES:
        if dry_run:
            # In dry-run, we don't have policy_category column, so check doc_type='other'
            # and that no earlier rule already matched (approximate via counting)
            sql = f"""
                SELECT COUNT(*) FROM guidance_documents
                WHERE doc_type = 'other' AND {condition}
            """
            cur.execute(sql)
        else:
            sql = f"""
                UPDATE guidance_documents
                SET policy_category = %s
                WHERE policy_category = 'unclassified' AND {condition}
            """
            cur.execute(sql, (category,))

        count = cur.fetchone()[0] if dry_run else cur.rowcount
        if count > 0:
            print(f"  {label:35} -> {category:20} {count:>5}")
            total_reclassified += count

    print(f"  {'TOTAL reclassified':35}    {' ':20} {total_reclassified:>5}")


def _flag_raw_pdfs(cur, dry_run: bool = True) -> None:
    """Pass 5: Reclassify docs whose content is raw PDF binary (text extraction failed)."""
    prefix = "[DRY RUN] " if dry_run else ""
    if dry_run:
        cur.execute(
            "SELECT COUNT(*) FROM guidance_documents WHERE content LIKE '%PDF-%'"
        )
        count = cur.fetchone()[0]
    else:
        cur.execute(
            "UPDATE guidance_documents SET policy_category = 'data_dump' "
            "WHERE content LIKE '%PDF-%'"
        )
        count = cur.rowcount

    print(f"\n{prefix}Pass 4: {count} docs with raw PDF content -> data_dump")


def print_detailed_report(
    cur,
    case_expr: str | None = None,
    case_params: list[str] | None = None,
    dry_run: bool = False,
) -> None:
    """Print rich classification report with metadata per category.

    In dry-run mode, uses a computed CASE expression.
    In post-execute mode, reads the persisted policy_category column.
    """
    # Decide how to get the category value
    if dry_run and case_expr:
        cat_col = f"CASE {case_expr} ELSE 'unclassified' END"
        att_col = f"(title ~* '{ATTACHMENT_PATTERN}')"
        base_params = list(case_params)
    else:
        cat_col = "COALESCE(policy_category, 'unclassified')"
        att_col = "COALESCE(is_attachment, false)"
        base_params = []

    # ── Summary table ──
    summary_sql = f"""
        SELECT
            {cat_col} AS category,
            COUNT(*) AS total,
            SUM(CASE WHEN {att_col} THEN 1 ELSE 0 END) AS attachments,
            SUM(CASE WHEN NOT {att_col} THEN 1 ELSE 0 END) AS non_attachment,
            SUM(CASE WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 1 ELSE 0 END) AS has_content,
            ROUND(AVG(LENGTH(content))) AS avg_chars,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(LENGTH(content), 0))) AS median_chars,
            MIN(year) AS min_year,
            MAX(year) AS max_year
        FROM guidance_documents
        GROUP BY 1
        ORDER BY total DESC
    """
    cur.execute(summary_sql, base_params)
    summary_rows = cur.fetchall()

    if not summary_rows:
        print("\nNo guidance documents found.")
        return

    print(f"\n{'='*110}")
    print("CLASSIFICATION SUMMARY")
    print(f"{'='*110}")
    print(
        f"{'category':25} | {'total':>6} | {'attach':>6} | {'avail':>6} | "
        f"{'w/text':>6} | {'avg_len':>8} | {'med_len':>8} | {'years':>11}"
    )
    print("-" * 110)
    totals = [0, 0, 0, 0]
    for cat, total, att, non_att, has_content, avg_chars, med_chars, min_yr, max_yr in summary_rows:
        avail = non_att  # non-attachment = available for analysis
        yr_range = f"{min_yr or '?'}-{max_yr or '?'}"
        print(
            f"{cat:25} | {total:>6} | {att:>6} | {avail:>6} | "
            f"{has_content:>6} | {avg_chars or 0:>8.0f} | {med_chars or 0:>8.0f} | {yr_range:>11}"
        )
        totals[0] += total
        totals[1] += att
        totals[2] += non_att
        totals[3] += has_content
    print("-" * 110)
    print(
        f"{'TOTAL':25} | {totals[0]:>6} | {totals[1]:>6} | {totals[2]:>6} | "
        f"{totals[3]:>6} |          |          |"
    )

    # ── Per-category detail: doc_types, agencies, domains ──
    detail_sql = f"""
        SELECT
            {cat_col} AS category,
            doc_type,
            COUNT(*) AS cnt,
            STRING_AGG(DISTINCT agency, ', ' ORDER BY agency) AS agencies,
            STRING_AGG(DISTINCT SUBSTRING(url FROM '://([^/]+)'), ', '
                       ORDER BY SUBSTRING(url FROM '://([^/]+)')) AS domains,
            ROUND(AVG(LENGTH(content))) AS avg_chars,
            SUM(CASE WHEN {att_col} THEN 1 ELSE 0 END) AS attachments
        FROM guidance_documents
        GROUP BY 1, 2
        ORDER BY 1, 3 DESC
    """
    cur.execute(detail_sql, base_params)
    detail_rows = cur.fetchall()

    print(f"\n{'='*110}")
    print("DETAIL BY DOC_TYPE")
    print(f"{'='*110}")

    current_cat = None
    for cat, dt, cnt, agencies, domains, avg_ch, n_att in detail_rows:
        if cat != current_cat:
            print(f"\n── {cat} ──")
            print(
                f"  {'doc_type':30} {'count':>6} {'attach':>6} "
                f"{'avg_len':>8}  {'agencies':30} {'domains'}"
            )
            current_cat = cat
        ag = agencies or ""
        if len(ag) > 30:
            ag = ag[:27] + "..."
        dm = domains or ""
        if len(dm) > 40:
            dm = dm[:37] + "..."
        print(
            f"  {(dt or '(null)'):30} {cnt:>6} {n_att:>6} "
            f"{avg_ch or 0:>8.0f}  {ag:30} {dm}"
        )

    # ── Source project breakdown ──
    src_sql = f"""
        SELECT
            {cat_col} AS category,
            source_project,
            COUNT(*) AS cnt
        FROM guidance_documents
        GROUP BY 1, 2
        ORDER BY 1, 3 DESC
    """
    cur.execute(src_sql, base_params)
    src_rows = cur.fetchall()

    print(f"\n{'='*110}")
    print("SOURCE PROJECT BREAKDOWN")
    print(f"{'='*110}")
    current_cat = None
    for cat, src, cnt in src_rows:
        if cat != current_cat:
            print(f"\n── {cat} ──")
            current_cat = cat
        print(f"  {(src or '(unknown)'):30} {cnt:>6}")
