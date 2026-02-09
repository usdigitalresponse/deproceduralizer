#!/usr/bin/env python3
"""Main entry point for local summarization pipeline."""

import argparse
import asyncio
import os
from datetime import datetime
from pathlib import Path
import sys

import psycopg
from dotenv import load_dotenv

from summarizer import ParallelSummarizer

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def get_documents(
    state: str | None = None,
    hierarchy_level: str | None = None,
    limit: int | None = None,
    sample_per_level: int | None = None,
) -> list[dict]:
    """Fetch documents from database."""

    conn = psycopg.connect(os.getenv("DATABASE_URL"))

    # If sampling per level, get representative samples from each hierarchy level
    if sample_per_level:
        return get_representative_sample(conn, state, sample_per_level)

    conditions = ["content IS NOT NULL", "content <> ''"]
    params: list = []

    if state:
        conditions.append("state = %s")
        params.append(state.upper())

    if hierarchy_level:
        conditions.append("hierarchy_level = %s")
        params.append(hierarchy_level)

    where_clause = " AND ".join(conditions)
    limit_clause = f"LIMIT {limit}" if limit else ""

    query = f"""
        SELECT
            id,
            title,
            content,
            hierarchy_level,
            state,
            citation,
            short_title
        FROM regulatory_documents
        WHERE {where_clause}
        ORDER BY RANDOM()
        {limit_clause}
    """

    with conn.cursor() as cur:
        cur.execute(query, params)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    conn.close()

    return [dict(zip(columns, row)) for row in rows]


def get_representative_sample(
    conn: psycopg.Connection,
    state: str | None,
    per_level: int,
) -> list[dict]:
    """Get representative sample with N docs from each hierarchy level."""

    # First, get the distinct hierarchy levels
    level_query = """
        SELECT DISTINCT hierarchy_level
        FROM regulatory_documents
        WHERE content IS NOT NULL
          AND content <> ''
          AND hierarchy_level IS NOT NULL
          AND hierarchy_level <> ''
    """
    params: list = []
    if state:
        level_query += " AND state = %s"
        params.append(state.upper())

    with conn.cursor() as cur:
        cur.execute(level_query, params)
        levels = [row[0] for row in cur.fetchall()]

    print(f"  Found {len(levels)} hierarchy levels: {', '.join(levels)}")

    # Now get samples from each level
    all_docs = []
    for level in levels:
        sample_query = """
            SELECT
                id,
                title,
                content,
                hierarchy_level,
                state,
                citation,
                short_title
            FROM regulatory_documents
            WHERE content IS NOT NULL
              AND content <> ''
              AND hierarchy_level = %s
        """
        sample_params = [level]

        if state:
            sample_query += " AND state = %s"
            sample_params.append(state.upper())

        sample_query += f" ORDER BY RANDOM() LIMIT {per_level}"

        with conn.cursor() as cur:
            cur.execute(sample_query, sample_params)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

        level_docs = [dict(zip(columns, row)) for row in rows]
        print(f"    {level}: {len(level_docs)} docs")
        all_docs.extend(level_docs)

    conn.close()
    return all_docs


async def main():
    parser = argparse.ArgumentParser(
        description="Generate local summaries for regulatory documents"
    )
    parser.add_argument("--state", choices=["NY", "NJ"], help="Filter by state")
    parser.add_argument(
        "--level", help="Filter by hierarchy level (e.g., 'section', 'part')"
    )
    parser.add_argument("--limit", type=int, help="Maximum documents to process")
    parser.add_argument(
        "--sample-per-level",
        type=int,
        help="Sample N documents from each hierarchy level (recommended for testing)",
    )
    parser.add_argument(
        "--output-dir",
        default="summaries_staging",
        help="Output directory for staging files",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("LOCAL SUMMARIZATION PIPELINE")
    print("=" * 70)
    print(f"\nStarted: {datetime.now().isoformat()}")

    # Check Ollama is running
    try:
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:11434/api/tags") as resp:
                if resp.status != 200:
                    print("\nERROR: Ollama is not responding. Please run 'ollama serve' first.")
                    sys.exit(1)
                data = await resp.json()
                models = [m["name"] for m in data.get("models", [])]
                if "reg-summarizer:latest" not in models:
                    print("\nWARNING: 'reg-summarizer' model not found.")
                    print("Please run: ollama create reg-summarizer -f modelfiles/reg-summarizer.modelfile")
                    print(f"\nAvailable models: {', '.join(models) or 'none'}")
                    sys.exit(1)
    except Exception as e:
        print(f"\nERROR: Cannot connect to Ollama: {e}")
        print("Please run 'ollama serve' first.")
        sys.exit(1)

    # Fetch documents
    print(f"\n[1/3] Fetching documents from database...")
    print(f"      State: {args.state or 'all'}")
    if args.sample_per_level:
        print(f"      Sampling: {args.sample_per_level} docs per hierarchy level")
    else:
        print(f"      Level: {args.level or 'all'}")
        print(f"      Limit: {args.limit or 'none'}")

    documents = get_documents(
        state=args.state,
        hierarchy_level=args.level,
        limit=args.limit,
        sample_per_level=args.sample_per_level,
    )

    if not documents:
        print("      No documents found matching criteria.")
        return

    print(f"\n      Found {len(documents)} documents to process")

    # Show breakdown by level
    by_level: dict[str, int] = {}
    for doc in documents:
        level = doc.get("hierarchy_level", "unknown")
        by_level[level] = by_level.get(level, 0) + 1
    print("      Breakdown by level:")
    for level, count in sorted(by_level.items()):
        print(f"        {level}: {count}")

    # Estimate time (3B model is ~1s per doc with 2 concurrent)
    est_seconds = len(documents) * 1.0
    est_minutes = est_seconds / 60
    print(f"\n      Estimated time: {est_minutes:.1f} minutes")

    # Confirm for large batches
    if len(documents) > 100:
        response = input(f"\nProcess {len(documents)} documents? [y/N] ")
        if response.lower() != "y":
            print("Cancelled.")
            return

    # Process
    print(f"\n[2/3] Processing with local LLM...")
    summarizer = ParallelSummarizer(output_dir=args.output_dir)

    start_time = datetime.now()
    results = await summarizer.process_batch(documents)
    elapsed = (datetime.now() - start_time).total_seconds()

    print(f"\n      Processed {len(results)} documents in {elapsed:.1f}s")
    print(f"      Average: {elapsed/len(results):.2f}s per document")

    # Save results
    print(f"\n[3/3] Saving to staging directory...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"summaries_{args.state or 'all'}_{timestamp}.json"
    output_path = summarizer.save_results(results, filename)

    # Summary stats
    print(f"\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    by_level = {}
    by_strategy: dict[str, int] = {}
    errors = 0

    for r in results:
        level = r.hierarchy_level
        strategy = r.metadata.chunking_strategy

        by_level[level] = by_level.get(level, 0) + 1
        by_strategy[strategy] = by_strategy.get(strategy, 0) + 1

        if r.metadata.error:
            errors += 1

    print(f"\nBy hierarchy level:")
    for level, count in sorted(by_level.items()):
        print(f"  {level}: {count}")

    print(f"\nBy chunking strategy:")
    for strategy, count in sorted(by_strategy.items()):
        print(f"  {strategy}: {count}")

    if errors:
        print(f"\nErrors: {errors}")

    print(f"\n Results saved to: {output_path}")
    print(f"\nNext steps:")
    print(f"  1. Review with: python generate_review_html.py {output_path}")
    print(f"     Then open the generated HTML file in your browser")
    print(f"  2. Or use terminal: python review_summaries.py {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
