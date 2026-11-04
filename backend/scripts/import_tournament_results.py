#!/usr/bin/env python3
"""Import tournament_results.json into the database."""

import json
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg

PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(PROJECT_ROOT / "backend" / ".env")

RESULTS_FILE = PROJECT_ROOT / "backend" / "outputs" / "barrier_strategies" / "tournament_results.json"


def main():
    with open(RESULTS_FILE) as f:
        data = json.load(f)

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # Truncate (fresh import)
    cur.execute("TRUNCATE tournament_examples, tournament_patterns, tournament_named_findings RESTART IDENTITY CASCADE")

    pattern_count = 0
    example_count = 0

    for pass_key in ["pass1", "pass2"]:
        pass_data = data[pass_key]
        for mp in pass_data["mega_patterns"]:
            cur.execute(
                """INSERT INTO tournament_patterns (pass, name, description, regulation_count, citations)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (pass_key, mp["name"], mp["description"], mp["regulation_count"], mp["citations"]),
            )
            pattern_id = cur.fetchone()[0]
            pattern_count += 1

            for ex in mp.get("top_examples", []):
                cur.execute(
                    """INSERT INTO tournament_examples
                       (pattern_id, barrier_issue_id, citation, category, severity, explanation, fix, why_it_matters)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        pattern_id,
                        ex.get("id"),
                        ex["citation"],
                        ex.get("category"),
                        ex.get("severity"),
                        ex["explanation"],
                        ex["fix"],
                        ex["why_it_matters"],
                    ),
                )
                example_count += 1

    # Named findings (pass 1 only)
    nf_count = 0
    for nf in data["pass1"].get("named_findings", []):
        cur.execute(
            """INSERT INTO tournament_named_findings (name, fix, citations, why)
               VALUES (%s, %s, %s, %s)""",
            (nf["name"], nf["fix"], nf["citations"], nf["why"]),
        )
        nf_count += 1

    conn.commit()
    conn.close()

    print(f"Imported: {pattern_count} patterns, {example_count} examples, {nf_count} named findings")


if __name__ == "__main__":
    main()
