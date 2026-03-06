"""CLI entry point for the guidance document pipeline."""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def main():
    parser = argparse.ArgumentParser(
        description="Guidance document import pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 -m scripts.guidance_pipeline --dry-run
  python3 -m scripts.guidance_pipeline --execute
  python3 -m scripts.guidance_pipeline --execute --resolve-citations
  python3 -m scripts.guidance_pipeline --execute --agency OCFS --limit 100
  python3 -m scripts.guidance_pipeline --gap-analysis
  python3 -m scripts.guidance_pipeline --clean-refs
  python3 -m scripts.guidance_pipeline --clean-refs --execute
  python3 -m scripts.guidance_pipeline --fix-refs
  python3 -m scripts.guidance_pipeline --fix-refs --execute
  python3 -m scripts.guidance_pipeline --detect-supersedure
  python3 -m scripts.guidance_pipeline --detect-supersedure --execute
  python3 -m scripts.guidance_pipeline --supersedure-report
  python3 -m scripts.guidance_pipeline --import-manifest data/client_requested_docs.json
  python3 -m scripts.guidance_pipeline --import-manifest data/client_requested_docs.json --group H
  python3 -m scripts.guidance_pipeline --classify
  python3 -m scripts.guidance_pipeline --classify --execute
  python3 -m scripts.guidance_pipeline --regex-scan
  python3 -m scripts.guidance_pipeline --regex-scan --agency OCFS
        """,
    )
    parser.add_argument(
        "--source-dir",
        default=os.path.join(PROJECT_ROOT, "..", "nys-documents"),
        help="Path to nys-documents repo (default: sibling nys-documents directory)",
    )

    # Import mode flags
    parser.add_argument("--dry-run", action="store_true", help="Preview import without inserting")
    parser.add_argument("--execute", action="store_true", help="Run the import (or execute clean-refs/detect-supersedure)")

    # Standalone modes
    parser.add_argument("--gap-analysis", action="store_true", help="Run gap analysis on imported data")
    parser.add_argument("--clean-refs", action="store_true", help="Clean junk canonical_ref values (dry-run by default)")
    parser.add_argument("--fix-refs", action="store_true", help="Fix canonical_refs using title + agency metadata (dry-run by default)")
    parser.add_argument("--detect-supersedure", action="store_true", help="Detect supersedure relationships (dry-run by default)")
    parser.add_argument("--supersedure-report", action="store_true", help="Print supersedure relationship report")
    parser.add_argument("--re-resolve", action="store_true", help="Re-resolve all guidance→regulation citations from DB (dry-run by default)")
    parser.add_argument("--classify", action="store_true", help="Run rule-based classification (dry-run by default)")
    parser.add_argument("--regex-scan", action="store_true", help="Scan guidance docs for compliance issue regex patterns")
    parser.add_argument("--doc-type", help="Filter regex scan to a specific doc_type")
    parser.add_argument("--resolve-guidance-refs", action="store_true", help="Resolve cites_documents to guidance_documents (dry-run by default)")

    parser.add_argument(
        "--import-manifest",
        metavar="PATH",
        help="Check DB coverage against a curated manifest JSON file",
    )
    parser.add_argument(
        "--group",
        help="Filter manifest to a specific group (e.g. A, B, H)",
    )

    # Import options
    parser.add_argument("--limit", type=int, help="Limit number of docs to import")
    parser.add_argument(
        "--source-project",
        choices=["childcare", "guidance", "statewide_expansion"],
        help="Filter by source project",
    )
    parser.add_argument("--agency", help="Filter by agency (e.g. OCFS, OTDA)")
    parser.add_argument(
        "--resolve-citations",
        action="store_true",
        help="Resolve NYCRR citations to cross_references after import",
    )
    parser.add_argument(
        "--gap-format",
        choices=["text", "json"],
        default="text",
        help="Output format for gap analysis (default: text)",
    )

    args = parser.parse_args()

    # --- Standalone modes ---

    if args.gap_analysis:
        from scripts.guidance_pipeline.gap_analysis import run_gap_analysis
        run_gap_analysis(output_format=args.gap_format)
        return

    if args.clean_refs:
        from scripts.guidance_pipeline.canonical_ref_cleaner import clean_canonical_refs
        dry_run = not args.execute
        clean_canonical_refs(dry_run=dry_run)
        return

    if args.fix_refs:
        from scripts.guidance_pipeline.fix_canonical_refs import fix_canonical_refs
        dry_run = not args.execute
        fix_canonical_refs(dry_run=dry_run)
        return

    if args.detect_supersedure:
        from scripts.guidance_pipeline.supersedure_detector import detect_supersedure
        dry_run = not args.execute
        detect_supersedure(dry_run=dry_run)
        return

    if args.supersedure_report:
        from scripts.guidance_pipeline.supersedure_detector import supersedure_report
        supersedure_report()
        return

    if args.re_resolve:
        from scripts.guidance_pipeline.citation_resolver import re_resolve_all
        dry_run = not args.execute
        re_resolve_all(dry_run=dry_run)
        return

    if args.classify:
        from scripts.guidance_pipeline.classifier import classify
        dry_run = not args.execute
        classify(dry_run=dry_run)
        return

    if args.regex_scan:
        from scripts.guidance_pipeline.regex_scan import regex_scan
        regex_scan(agency=args.agency, doc_type=args.doc_type, execute=args.execute)
        return

    if args.resolve_guidance_refs:
        from scripts.guidance_pipeline.guidance_ref_resolver import resolve_guidance_refs
        dry_run = not args.execute
        resolve_guidance_refs(dry_run=dry_run)
        return

    # --- Manifest coverage check ---
    if args.import_manifest:
        manifest_path = os.path.abspath(args.import_manifest)
        if not os.path.isfile(manifest_path):
            print(f"ERROR: Manifest file not found: {manifest_path}")
            sys.exit(1)

        from scripts.guidance_pipeline.manifest_importer import preview_manifest

        preview_manifest(manifest_path, group=args.group)
        return

    # --- Import mode ---
    if not args.dry_run and not args.execute:
        parser.error("One of --dry-run, --execute, --gap-analysis, --clean-refs, --fix-refs, --detect-supersedure, --supersedure-report, --classify, or --regex-scan is required")

    source_dir = os.path.abspath(args.source_dir)
    print(f"Source directory: {source_dir}")

    if not os.path.isdir(source_dir):
        print(f"ERROR: Source directory not found: {source_dir}")
        sys.exit(1)

    from scripts.guidance_pipeline.catalog import merge_catalog_and_text_dirs
    from scripts.guidance_pipeline.importer import import_documents, preview_import

    all_docs = merge_catalog_and_text_dirs(
        source_dir,
        source_project=args.source_project,
        agency=args.agency,
        limit=args.limit,
    )

    if not all_docs:
        print("No eligible documents found.")
        return

    if args.dry_run:
        preview_import(all_docs)

        if args.resolve_citations:
            from scripts.guidance_pipeline.citation_resolver import resolve_citations
            resolve_citations(all_docs, dry_run=True)
        return

    # Execute import
    id_map = import_documents(source_dir, all_docs)

    if args.resolve_citations:
        from scripts.guidance_pipeline.citation_resolver import resolve_citations
        resolve_citations(all_docs, dry_run=False)

    print(f"\nDone. Imported {len(id_map)} documents into guidance_documents.")


if __name__ == "__main__":
    main()
