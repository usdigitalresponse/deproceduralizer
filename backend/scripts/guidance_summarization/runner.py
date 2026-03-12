"""Guidance document batch summarization runner.

Single-phase batch using Anthropic's Batch API (Haiku).
Unlike regulation summarization, guidance docs are flat (no hierarchy).
Context comes from cross-referenced regulation summaries.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

from pydantic import BaseModel, Field
from typing import Literal

from lib.batch import BatchManager, format_batch_request
from .db_queries import (
    get_guidance_docs,
    get_cross_ref_summaries,
    get_summarization_stats,
    batch_update_guidance_summaries,
)
from .prompts import GUIDANCE_SUMMARIZATION_SYSTEM, build_guidance_user_prompt


# Model used for batch summarization
BATCH_MODEL = "claude-haiku-4-5-20251001"

# Max content length to send (chars). Haiku context is 200K tokens.
# Very long docs (e.g., "other" type avg 233K chars) need truncation.
MAX_CONTENT_CHARS = 100_000

# Section type categories (same as regulation pipeline)
SectionType = Literal[
    "definitions", "requirements", "procedures", "prohibitions", "standards",
    "eligibility", "penalties", "fees", "forms", "reporting", "purpose",
    "scope", "exemptions", "reserved", "other"
]


class GuidanceSummaryResponse(BaseModel):
    """Structured response for guidance document summarization."""

    summary: str = Field(
        ...,
        description="3-5 sentence summary (80-120 words). START with the action/effect."
    )
    section_type: SectionType = Field(
        ...,
        description="Primary category of this document"
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="3-5 searchable terms"
    )
    applies_to: list[str] = Field(
        default_factory=list,
        description="Who must comply or act"
    )
    has_form: bool = Field(
        default=False,
        description="References or contains a specific form"
    )
    has_incorporation_by_reference: bool = Field(
        default=False,
        description="Incorporates external non-governmental standards"
    )


def _parse_tool_use_result(message) -> dict:
    """Extract structured fields from a tool_use response block."""
    result = {
        "summary": "",
        "section_type": "",
        "keywords": [],
        "applies_to": [],
        "has_form": False,
        "has_incorporation_by_reference": False,
    }
    for block in message.content:
        if block.type == "tool_use":
            input_data = block.input
            if isinstance(input_data, dict):
                result["summary"] = input_data.get("summary", "")
                result["section_type"] = input_data.get("section_type", "")
                result["keywords"] = input_data.get("keywords", [])
                result["applies_to"] = input_data.get("applies_to", [])
                result["has_form"] = input_data.get("has_form", False)
                result["has_incorporation_by_reference"] = input_data.get(
                    "has_incorporation_by_reference", False
                )
            break
    else:
        logger.warning("No tool_use block found in response")
    return result


def _truncate_content(content: str, max_chars: int = MAX_CONTENT_CHARS) -> str:
    """Truncate very long content, keeping head and tail."""
    if len(content) <= max_chars:
        return content

    # Keep 80% head, 20% tail
    head_chars = int(max_chars * 0.8)
    tail_chars = max_chars - head_chars - 100  # 100 chars for separator

    head = content[:head_chars]
    tail = content[-tail_chars:]
    omitted = len(content) - head_chars - tail_chars

    return f"{head}\n\n[... {omitted:,} characters omitted ...]\n\n{tail}"


class GuidanceSummarizationRunner:
    """Single-phase batch summarization for guidance documents."""

    def __init__(
        self,
        output_dir: Path,
        agency: Optional[str] = None,
        doc_type: Optional[str] = None,
    ):
        self.agency = agency
        self.doc_type = doc_type

        # Output directory: output_dir/guidance/batch/
        self.output_dir = output_dir / "guidance" / "batch"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.manager = BatchManager(batches_dir=self.output_dir)

    def show_stats(self) -> dict:
        """Show summarization progress stats."""
        stats = get_summarization_stats()

        print(f"\n=== GUIDANCE SUMMARIZATION STATS ===")
        print(f"  Total with content: {stats['total_with_content']:,}")
        print(f"  Summarized:         {stats['summarized']:,}")
        print(f"  Pending:            {stats['pending']:,}")

        if stats['total_with_content'] > 0:
            pct = 100 * stats['summarized'] / stats['total_with_content']
            print(f"  Progress:           {pct:.1f}%")

        return stats

    def submit_batch(
        self,
        resume: bool = True,
        dry_run: bool = False,
        limit: Optional[int] = None,
    ) -> Optional[str]:
        """
        Build and submit a batch for guidance document summarization.

        Args:
            resume: Skip docs that already have summaries
            dry_run: Preview without submitting
            limit: Max docs to include in batch

        Returns:
            Batch ID if submitted, None if dry run or no work
        """
        filters = []
        if self.agency:
            filters.append(f"agency={self.agency}")
        if self.doc_type:
            filters.append(f"doc_type={self.doc_type}")
        filter_str = f" ({', '.join(filters)})" if filters else ""

        print(f"\n=== GUIDANCE SUMMARIZATION{filter_str} ===")

        # Get docs to summarize
        docs = get_guidance_docs(
            agency=self.agency,
            doc_type=self.doc_type,
            resume=resume,
            limit=limit,
        )
        print(f"  Documents to summarize: {len(docs)}")

        if not docs:
            print("  No documents to summarize.")
            return None

        # Fetch cross-ref context in bulk
        doc_ids = [d["id"] for d in docs]
        print(f"  Fetching cross-reference context for {len(doc_ids)} docs...")
        cross_refs = get_cross_ref_summaries(doc_ids)

        docs_with_context = sum(1 for gid in doc_ids if cross_refs.get(gid))
        print(f"  Docs with cited regulation summaries: {docs_with_context}")

        # Build batch requests
        requests = []
        skipped = 0

        for doc in docs:
            content = doc.get("content", "")

            # Skip empty/very short content
            if not content or len(content.strip()) < 20:
                skipped += 1
                continue

            # Truncate very long content
            content = _truncate_content(content)

            # Get cross-ref summaries for this doc
            refs = cross_refs.get(doc["id"], [])

            # Build prompt
            user_prompt = build_guidance_user_prompt(doc, refs, content)

            requests.append(format_batch_request(
                custom_id=f"guidance_{doc['id']}",
                prompt=user_prompt,
                response_format=GuidanceSummaryResponse,
                system=GUIDANCE_SUMMARIZATION_SYSTEM,
                model=BATCH_MODEL,
            ))

        print(f"  Requests to submit: {len(requests)}")
        if skipped:
            print(f"  Skipped (empty/short): {skipped}")

        if dry_run:
            print(f"\n  [DRY RUN] Would submit batch with {len(requests)} requests")
            # Show sample
            for req in requests[:3]:
                print(f"    - {req['custom_id']}")
            if len(requests) > 3:
                print(f"    ... and {len(requests) - 3} more")
            return None

        if not requests:
            print("  No requests to submit.")
            return None

        # Submit
        batch_name = "guidance"
        if self.agency:
            batch_name += f"_{self.agency}"
        if self.doc_type:
            batch_name += f"_{self.doc_type}"

        batch_id = self.manager.submit_batch(
            requests=requests,
            batch_name=batch_name,
            metadata={
                "type": "guidance_summarization",
                "agency": self.agency,
                "doc_type": self.doc_type,
                "model": BATCH_MODEL,
                "doc_count": len(requests),
            },
        )

        print(f"\n  Submitted batch: {batch_id}")
        return batch_id

    def process_results(self, batch_id: Optional[str] = None) -> list[dict]:
        """
        Process results from a completed batch.

        Args:
            batch_id: Specific batch ID. If None, finds latest.

        Returns:
            List of result dicts
        """
        print(f"\n=== PROCESSING GUIDANCE RESULTS ===\n")

        # Find batch directory
        if batch_id:
            batch_dir = self._find_batch_dir_by_id(batch_id)
        else:
            batch_dir = self._find_latest_batch_dir()

        if not batch_dir:
            print("  No batch directory found.")
            return []

        info_file = batch_dir / "batch_info.json"
        with open(info_file) as f:
            info = json.load(f)

        batch_id = info.get("batch_api_id")
        if not batch_id:
            print(f"  No batch ID found in {info_file}")
            return []

        # Check completion
        status = self.manager.get_batch_status(batch_id)
        if status["status"] != "ended":
            print(f"  Batch not complete: {status['status']}")
            print(f"  Progress: {status['succeeded']}/{status['total']}")
            return []

        print(f"  Processing batch: {batch_id}")
        print(f"  Succeeded: {status['succeeded']}, Errored: {status['errored']}")

        results = []
        processed = 0

        for result in self.manager.get_batch_results(batch_id):
            custom_id = result.custom_id
            guidance_id = int(custom_id.replace("guidance_", ""))

            if result.result.type == "succeeded":
                parsed = _parse_tool_use_result(result.result.message)

                result_dict = {
                    "id": guidance_id,
                    **parsed,
                }
                results.append(result_dict)

            elif result.result.type == "errored":
                error = result.result.error
                self.manager.log_error(batch_dir, custom_id, "ERROR", str(error))

            elif result.result.type == "expired":
                self.manager.log_error(batch_dir, custom_id, "EXPIRED", "Request timed out")

            processed += 1
            if processed % 1000 == 0:
                print(f"  Processed {processed}/{status['succeeded']} results...")

        # Save results to disk
        results_file = batch_dir / "results.json"
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)

        print(f"\n  Saved {len(results)} results to {results_file}")

        # Update batch info
        info["status"] = "processed"
        info["processed_at"] = datetime.now().isoformat()
        info["results_count"] = len(results)
        with open(info_file, "w") as f:
            json.dump(info, f, indent=2)

        return results

    def import_to_db(self, results: list[dict], dry_run: bool = False) -> int:
        """
        Import summarization results into guidance_documents table.

        Args:
            results: List of result dicts from process_results
            dry_run: Preview without committing

        Returns:
            Number of rows updated
        """
        if not results:
            print("  No results to import.")
            return 0

        # Transform results for DB update
        updates = []
        for r in results:
            summary = r.get("summary", "")
            if not summary:
                continue

            updates.append({
                "id": r["id"],
                "summary": summary,
                "section_type": (r.get("section_type", "") or "")[:50],
                "keywords": r.get("keywords", []),
                "applies_to": r.get("applies_to", []),
                "has_form": bool(r.get("has_form", False)),
                "has_ibr": bool(r.get("has_incorporation_by_reference", False)),
            })

        print(f"  Records to update: {len(updates)}")

        if dry_run:
            print("  [DRY RUN] Would update:")
            for u in updates[:5]:
                print(f"    - ID {u['id']}: {u['section_type']} — {u['summary'][:60]}...")
            if len(updates) > 5:
                print(f"    ... and {len(updates) - 5} more")
            return 0

        updated = batch_update_guidance_summaries(updates)
        print(f"  Updated {updated} guidance documents in database")
        return updated

    def run(self, dry_run: bool = False, limit: Optional[int] = None, poll_interval: int = 30) -> int:
        """
        Run the full pipeline: submit → poll → process → import.

        Args:
            dry_run: Preview without submitting or importing
            limit: Max docs to process
            poll_interval: Seconds between status polls

        Returns:
            Number of docs imported to DB
        """
        self.show_stats()

        batch_id = self.submit_batch(resume=True, dry_run=dry_run, limit=limit)

        if dry_run or not batch_id:
            return 0

        # Poll until complete
        print(f"\n  Polling batch {batch_id[:20]}... (every {poll_interval}s)")
        self.manager.poll_until_complete(batch_id, poll_interval=poll_interval)

        # Process results
        results = self.process_results(batch_id=batch_id)

        if not results:
            return 0

        # Import to DB
        return self.import_to_db(results)

    def check_status(self) -> list[dict]:
        """Check status of all guidance summarization batches."""
        print(f"\n=== GUIDANCE BATCH STATUS ===\n")

        statuses = []
        for batch_dir in sorted(self.output_dir.glob("guidance_*")):
            info_file = batch_dir / "batch_info.json"
            if not info_file.exists():
                continue

            with open(info_file) as f:
                info = json.load(f)

            batch_id = info.get("batch_api_id")
            if not batch_id:
                continue

            try:
                status = self.manager.get_batch_status(batch_id)
                state_icon = "✓" if status["status"] == "ended" else "⋯"
                pct = 100 * status["succeeded"] // status["total"] if status["total"] else 0
                err = f" ({status['errored']} errors)" if status.get("errored", 0) > 0 else ""
                print(f"  {batch_dir.name}: {status['succeeded']:>5}/{status['total']:<5} ({pct:>3}%) {state_icon} {status['status']}{err}")
                statuses.append(status)
            except Exception as e:
                print(f"  {batch_dir.name}: Error - {e}")

        if not statuses:
            print("  No batches found.")

        return statuses

    def _find_latest_batch_dir(self) -> Optional[Path]:
        """Find the most recent batch directory."""
        dirs = list(self.output_dir.glob("guidance_*"))
        if not dirs:
            return None
        return max(dirs, key=lambda d: d.stat().st_mtime)

    def _find_batch_dir_by_id(self, batch_id: str) -> Optional[Path]:
        """Find batch directory by batch API ID."""
        for batch_dir in self.output_dir.glob("guidance_*"):
            info_file = batch_dir / "batch_info.json"
            if not info_file.exists():
                continue
            with open(info_file) as f:
                info = json.load(f)
            if info.get("batch_api_id") == batch_id:
                return batch_dir
        return None
