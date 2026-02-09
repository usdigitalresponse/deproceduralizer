#!/usr/bin/env python3
"""Terminal-based review interface for summaries."""

import argparse
import json
import sys
from pathlib import Path


def load_summaries(filepath: str) -> list[dict]:
    with open(filepath) as f:
        return json.load(f)


def save_summaries(summaries: list[dict], filepath: str):
    with open(filepath, "w") as f:
        json.dump(summaries, f, indent=2)


def print_summary(s: dict, index: int, total: int):
    """Print a single summary for review."""
    print("\n" + "=" * 70)
    print(f"[{index + 1}/{total}] Document ID: {s['document_id']}")
    print("=" * 70)

    # Document type badge
    level = s.get("hierarchy_level", "unknown")
    state = s.get("state", "?")
    print(f"\n[{state}] [{level.upper()}]")
    print(f"Title: {s['title'][:80]}{'...' if len(s.get('title', '')) > 80 else ''}")
    print(f"Citation: {s.get('citation', 'N/A')}")

    meta = s["metadata"]
    print(
        f"\nOriginal: {meta['original_word_count']} words ({meta['original_char_count']} chars)"
    )
    print(f"Strategy: {meta['chunking_strategy']} ({meta['num_chunks']} chunks)")
    print(f"Time: {meta['processing_time_ms']}ms")

    # Flags
    flags = []
    if meta.get("was_truncated"):
        flags.append("TRUNCATED")
    if meta.get("contains_definitions"):
        flags.append("DEFINITIONS")
    if meta.get("is_index_or_toc"):
        flags.append("INDEX/TOC")
    if meta.get("num_chunks", 1) > 1:
        flags.append(f"MULTI-CHUNK ({meta['num_chunks']})")
    if meta.get("error"):
        flags.append(f"ERROR: {meta['error'][:30]}")

    if flags:
        print(f"Flags: {', '.join(flags)}")

    print(f"\n{'-' * 70}")
    print("SUMMARY:")
    print(f"{'-' * 70}")
    print(f"\n{s['summary']}\n")

    # Show compression ratio
    if meta.get("original_word_count"):
        ratio = meta.get("summary_word_count", 0) / meta["original_word_count"]
        print(f"Compression: {meta['original_word_count']} -> {meta.get('summary_word_count', 0)} words ({ratio:.1%})")

    if meta.get("chunk_summaries") and len(meta["chunk_summaries"]) > 1:
        print(f"\n{'-' * 70}")
        print("CHUNK SUMMARIES:")
        for i, cs in enumerate(meta["chunk_summaries"]):
            print(f"  [{i + 1}] {cs[:100]}{'...' if len(cs) > 100 else ''}")


def review_interactive(filepath: str):
    """Interactive review session."""
    summaries = load_summaries(filepath)

    # Filter to pending
    pending = [s for s in summaries if s.get("review_status", "pending") == "pending"]

    print(f"\n{'=' * 70}")
    print("SUMMARY REVIEW SESSION")
    print(f"{'=' * 70}")
    print(f"\nFile: {filepath}")
    print(f"Total summaries: {len(summaries)}")
    print(f"Pending review: {len(pending)}")

    print(f"\nCommands:")
    print("  [Enter/a] Approve")
    print("  [r]       Reject (mark for re-run)")
    print("  [e]       Edit summary")
    print("  [n]       Add note")
    print("  [s]       Skip (keep pending)")
    print("  [q]       Quit and save")
    print("  [stats]   Show statistics")

    current = 0
    modified = False

    while current < len(pending):
        s = pending[current]
        print_summary(s, current, len(pending))

        cmd = input("\nAction [a/r/e/n/s/q/stats]: ").strip().lower()

        if cmd in ["", "a"]:
            s["review_status"] = "approved"
            modified = True
            current += 1

        elif cmd == "r":
            s["review_status"] = "rejected"
            reason = input("Reason (optional): ").strip()
            if reason:
                s["reviewer_notes"] = reason
            modified = True
            current += 1

        elif cmd == "e":
            print(f"\nCurrent: {s['summary']}")
            new_summary = input("New summary: ").strip()
            if new_summary:
                s["summary"] = new_summary
                s["metadata"]["was_manually_edited"] = True
                s["review_status"] = "approved"
                modified = True
            current += 1

        elif cmd == "n":
            note = input("Note: ").strip()
            if note:
                s["reviewer_notes"] = note
                modified = True

        elif cmd == "s":
            current += 1

        elif cmd == "q":
            break

        elif cmd == "stats":
            show_stats(summaries)

        else:
            print("Unknown command")

    if modified:
        # Update the original list
        pending_by_id = {s["document_id"]: s for s in pending}
        for i, s in enumerate(summaries):
            if s["document_id"] in pending_by_id:
                summaries[i] = pending_by_id[s["document_id"]]

        save_summaries(summaries, filepath)
        print(f"\n Saved changes to {filepath}")

    show_stats(summaries)


def show_stats(summaries: list[dict]):
    """Show review statistics."""
    by_status: dict[str, int] = {}
    by_level: dict[str, dict[str, int]] = {}

    for s in summaries:
        status = s.get("review_status", "pending")
        level = s.get("hierarchy_level", "unknown")

        by_status[status] = by_status.get(status, 0) + 1

        if level not in by_level:
            by_level[level] = {}
        by_level[level][status] = by_level[level].get(status, 0) + 1

    print(f"\n{'-' * 40}")
    print("Review Status:")
    for status, count in sorted(by_status.items()):
        pct = count / len(summaries) * 100
        print(f"  {status}: {count} ({pct:.1f}%)")

    print(f"\nBy Hierarchy Level:")
    for level, statuses in sorted(by_level.items()):
        total = sum(statuses.values())
        approved = statuses.get("approved", 0)
        print(f"  {level}: {approved}/{total} approved")

    print(f"{'-' * 40}")


def batch_approve(filepath: str, hierarchy_level: str | None = None):
    """Batch approve summaries by criteria."""
    summaries = load_summaries(filepath)

    approved = 0
    for s in summaries:
        if s.get("review_status") != "pending":
            continue

        if hierarchy_level and s["hierarchy_level"] != hierarchy_level:
            continue

        # Auto-approve criteria:
        # - Not truncated
        # - Reasonable length (10-100 words)
        # - No errors
        meta = s["metadata"]
        word_count = meta.get("summary_word_count", 0)

        if (
            not meta.get("was_truncated")
            and not meta.get("error")
            and 10 <= word_count <= 100
        ):
            s["review_status"] = "approved"
            s["reviewer_notes"] = "auto-approved"
            approved += 1

    save_summaries(summaries, filepath)
    print(f"Auto-approved {approved} summaries")
    show_stats(summaries)


def main():
    parser = argparse.ArgumentParser(description="Review generated summaries")
    parser.add_argument("filepath", help="Path to summaries JSON file")
    parser.add_argument("--batch", action="store_true", help="Auto-approve good ones")
    parser.add_argument("--stats", action="store_true", help="Show stats only")
    parser.add_argument("--level", help="Filter by hierarchy level for batch approval")

    args = parser.parse_args()

    if not Path(args.filepath).exists():
        print(f"Error: File not found: {args.filepath}")
        sys.exit(1)

    if args.stats:
        summaries = load_summaries(args.filepath)
        show_stats(summaries)
    elif args.batch:
        batch_approve(args.filepath, args.level)
    else:
        review_interactive(args.filepath)


if __name__ == "__main__":
    main()
