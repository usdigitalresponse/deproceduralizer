"""Identify gaps in the nys-documents guidance coverage.

Compares what we have by agency/year/doc_type against expected patterns
to flag years with suspiciously low counts.
"""

import json
from collections import Counter, defaultdict

from lib.db import get_db_connection


# Agencies with known substantial guidance output
ACTIVE_AGENCIES = {
    "OCFS": {"types": ["ADM", "LCM", "INF", "GIS"], "min_annual": 15},
    "OTDA": {"types": ["ADM", "LCM", "INF", "GIS"], "min_annual": 20},
    "NYSDOH": {"types": ["ADM", "GIS"], "min_annual": 10},
    "OMH": {"types": ["ADM", "INF"], "min_annual": 5},
    "OPWDD": {"types": ["ADM"], "min_annual": 3},
    "OASAS": {"types": ["ADM"], "min_annual": 2},
    "TAX": {"types": ["TSB-M"], "min_annual": 5},
    "NYSED": {"types": ["other"], "min_annual": 2},
}


def run_gap_analysis(output_format: str = "text") -> dict:
    """Analyze guidance document coverage and identify gaps.

    Returns a gap report dict with:
    - coverage: agency -> year -> doc_type -> count
    - gaps: list of {agency, year, doc_type, have_count, expected_min}
    - summary: overall stats

    Args:
        output_format: "text" for stdout, "json" for JSON output
    """
    conn = get_db_connection()
    if not conn:
        raise ConnectionError("Could not connect to database")

    cur = conn.cursor()

    # Get counts by agency, year, doc_type
    cur.execute("""
        SELECT agency, year, doc_type, COUNT(*)
        FROM guidance_documents
        WHERE year IS NOT NULL
        GROUP BY agency, year, doc_type
        ORDER BY agency, year, doc_type
    """)

    coverage: dict[str, dict[int, dict[str, int]]] = defaultdict(lambda: defaultdict(Counter))
    for agency, year, doc_type, count in cur.fetchall():
        coverage[agency][year][doc_type] = count

    # Get total counts by agency
    cur.execute("""
        SELECT agency, COUNT(*), MIN(year), MAX(year)
        FROM guidance_documents
        WHERE year IS NOT NULL
        GROUP BY agency
        ORDER BY COUNT(*) DESC
    """)

    agency_stats = {}
    for agency, count, min_year, max_year in cur.fetchall():
        agency_stats[agency] = {
            "total": count,
            "min_year": min_year,
            "max_year": max_year,
        }

    cur.close()
    conn.close()

    # Identify gaps
    # Only look at years >= 1990 to avoid noise from bad dates
    MIN_ANALYSIS_YEAR = 1990

    # Build set of doc_types each agency has actually published (across all years)
    agency_published_types: dict[str, set[str]] = defaultdict(set)
    for agency_name, year_data in coverage.items():
        for year_val, type_counts in year_data.items():
            for dt in type_counts:
                agency_published_types[agency_name].add(dt)

    gaps = []
    for agency, config in ACTIVE_AGENCIES.items():
        stats = agency_stats.get(agency)
        if not stats:
            gaps.append({
                "agency": agency,
                "issue": "no_data",
                "detail": f"No guidance documents found for {agency}",
            })
            continue

        min_year = max(stats["min_year"] or 0, MIN_ANALYSIS_YEAR)
        max_year = stats["max_year"]
        if not max_year or min_year > max_year:
            continue

        # Only check for types this agency has actually published
        published = agency_published_types.get(agency, set())

        # Check each year in the agency's range
        for year in range(min_year, max_year + 1):
            year_total = sum(coverage[agency][year].values())
            if year_total < config["min_annual"]:
                gaps.append({
                    "agency": agency,
                    "year": year,
                    "issue": "low_count",
                    "have_count": year_total,
                    "expected_min": config["min_annual"],
                    "detail": (
                        f"{agency} {year}: {year_total} docs "
                        f"(expected >= {config['min_annual']})"
                    ),
                })

            # Check specific doc types — only if this agency has ever published them
            for dt in config["types"]:
                if dt not in published:
                    continue
                dt_count = coverage[agency][year].get(dt, 0)
                if dt_count == 0 and year_total > 0:
                    gaps.append({
                        "agency": agency,
                        "year": year,
                        "doc_type": dt,
                        "issue": "missing_type",
                        "have_count": 0,
                        "detail": f"{agency} {year}: no {dt} docs (agency has {year_total} total that year)",
                    })

    report = {
        "agency_stats": agency_stats,
        "gaps": gaps,
        "total_agencies": len(agency_stats),
        "total_docs": sum(s["total"] for s in agency_stats.values()),
        "total_gaps": len(gaps),
    }

    if output_format == "text":
        _print_report(report, coverage)
    elif output_format == "json":
        print(json.dumps(report, indent=2, default=str))

    return report


def _print_report(report: dict, coverage: dict) -> None:
    """Print gap analysis report to stdout."""
    print("\n=== Guidance Document Gap Analysis ===\n")

    print(f"Total documents: {report['total_docs']}")
    print(f"Total agencies: {report['total_agencies']}")
    print(f"Total gaps identified: {report['total_gaps']}")

    print("\n--- Agency Coverage ---")
    for agency, stats in sorted(report["agency_stats"].items(), key=lambda x: -x[1]["total"]):
        print(f"  {agency:8s}: {stats['total']:5d} docs ({stats['min_year']}-{stats['max_year']})")

    if report["gaps"]:
        print("\n--- Gaps (Low Counts / Missing Types) ---")
        # Group by agency
        by_agency = defaultdict(list)
        for gap in report["gaps"]:
            by_agency[gap["agency"]].append(gap)

        for agency in sorted(by_agency):
            print(f"\n  {agency}:")
            for gap in sorted(by_agency[agency], key=lambda g: g.get("year", 0)):
                print(f"    {gap['detail']}")
    else:
        print("\nNo gaps identified.")
