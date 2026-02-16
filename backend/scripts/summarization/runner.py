"""Haiku batch summarization runner.

Manages batch submission, status checking, and result processing for
hierarchical document summarization using Anthropic's Batch API.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional
from pydantic import BaseModel, Field

from lib.batch import BatchManager, format_batch_request
from .db_queries import (
    get_documents_by_level,
    get_ancestors,
    get_ancestors_batch,
    get_sections_grouped_by_parent,
    get_child_ids,
    get_child_ids_batch,
    get_hierarchy_order,
)
from .parent_context import extract_intro_text
from .models import SummaryMetadata, SummaryResult
from .prompts import (
    SUMMARIZATION_SYSTEM,
    build_section_user_prompt,
    build_parent_user_prompt,
    should_skip_content,
    get_standard_summary,
)


# Only use Claude-generated summaries for context
VALID_CONTEXT_MODEL_FAMILIES = {"claude"}

# Model used for batch summarization
BATCH_MODEL = "claude-haiku-4-5-20251001"


# Section type categories (15 total)
SectionType = Literal[
    "definitions", "requirements", "procedures", "prohibitions", "standards",
    "eligibility", "penalties", "fees", "forms", "reporting", "purpose", "scope", "exemptions", "reserved", "other"
]


class SummaryResponse(BaseModel):
    """Structured response for regulatory document summarization."""

    summary: str = Field(
        ...,
        description="3-5 sentence summary (80-120 words). START with the action/effect (e.g., 'Requires...', 'Establishes...'), not 'This section'."
    )
    section_type: SectionType = Field(
        ...,
        description="Primary category: definitions, requirements, procedures, prohibitions, standards, eligibility, penalties, fees, forms, reporting, purpose, scope, exemptions, reserved, or other (if none fit)"
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="3-5 searchable terms covering key concepts, programs, or subjects"
    )
    applies_to: list[str] = Field(
        default_factory=list,
        description="Who must comply: e.g., 'licensees', 'employers', 'facilities', 'applicants', 'municipalities'"
    )
    has_form: bool = Field(
        default=False,
        description="True if the section references or contains a specific form"
    )
    has_incorporation_by_reference: bool = Field(
        default=False,
        description="True ONLY if section incorporates external non-governmental standards (ASTM, ANSI, NFPA, ISO, International Building Code). NOT for legal citations (CFR, N.J.S.A.)."
    )


def _parse_tool_use_result(message) -> dict:
    """Extract structured fields from a tool_use response block.

    Returns dict with summary, section_type, keywords, applies_to, has_form,
    has_incorporation_by_reference. Returns empty/default values if no tool_use found.
    """
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
                result["has_incorporation_by_reference"] = input_data.get("has_incorporation_by_reference", False)
            break
    return result


def get_model_family(model_name: str) -> str:
    """Determine model family from model name.

    Legacy helper used to map model IDs (e.g., 'claude-haiku-4-5-20251001') to
    family strings ('claude', 'ollama') for Batch API compatibility.  The family
    is stored in result metadata so that downstream phases can filter context
    summaries to only those produced by a specific model family.
    """
    if model_name.startswith("claude"):
        return "claude"
    elif "qwen" in model_name.lower() or "ollama" in model_name.lower():
        return "ollama"
    else:
        return "other"


class SummarizationBatchRunner:
    """
    Manages Haiku batch summarization with hierarchical context.

    Supports:
    - Phase-by-phase submission (sections, subchapters, chapters, titles)
    - Status checking for active batches
    - Result processing and caching
    - Resume functionality (skip already-processed docs)
    """

    def __init__(
        self,
        state: str,
        output_dir: Path,
        title: Optional[str] = None,
    ):
        """
        Initialize batch runner.

        Args:
            state: State code (e.g., 'NJ', 'NY')
            output_dir: Base output directory (will create state/batch/ subdirectory)
            title: Optional title filter (e.g., '8', '12A')
        """
        self.state = state.upper()
        self.title = title
        self.output_dir = output_dir / self.state / "batch"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.manager = BatchManager(batches_dir=self.output_dir)
        self.summaries_cache: dict[int, dict] = {}  # doc_id -> {summary, model_family, citation}

    def _load_summaries_cache(self):
        """Load summaries from previous batch runs for context.

        Only loads Claude-generated summaries (not Ollama).
        """
        loaded_count = 0
        for batch_dir in self.output_dir.glob("*_*_*"):
            results_file = batch_dir / "results.json"
            if results_file.exists():
                try:
                    with open(results_file) as f:
                        data = json.load(f)
                    for r in data:
                        model_family = r.get("metadata", {}).get("model_family", "")
                        if model_family in VALID_CONTEXT_MODEL_FAMILIES:
                            self.summaries_cache[r["document_id"]] = {
                                "summary": r["summary"],
                                "model_family": model_family,
                                "citation": r.get("citation"),
                            }
                            loaded_count += 1
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"  Warning: Could not load {results_file}: {e}")

        if loaded_count > 0:
            print(f"  Loaded {loaded_count} Claude-generated summaries for context")

    def _load_completed_ids(self, phase: str) -> set[int]:
        """Load document IDs already processed in previous runs."""
        completed = set()
        for batch_dir in self.output_dir.glob(f"{phase}_*"):
            results_file = batch_dir / "results.json"
            if results_file.exists():
                try:
                    with open(results_file) as f:
                        data = json.load(f)
                    completed.update(r["document_id"] for r in data)
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"  Warning: Could not load {results_file}: {e}")
        return completed

    def _get_sibling_summaries(
        self,
        current_doc: dict,
        siblings: list[dict],
    ) -> list[tuple[str, str]]:
        """
        Get summaries of preceding siblings for context.

        Only includes Claude-generated summaries.
        """
        result = []
        for sib in siblings:
            if sib["id"] == current_doc["id"]:
                break
            cached = self.summaries_cache.get(sib["id"])
            if cached and cached.get("model_family") in VALID_CONTEXT_MODEL_FAMILIES:
                citation = sib.get("citation", f"ID:{sib['id']}")
                result.append((citation, cached["summary"]))
        return result[-3:]  # Last 3 siblings max

    def _save_skipped_docs(self, phase: str, skipped_docs: list[dict]) -> None:
        """Save skipped (reserved/empty) docs so process_results can include them."""
        skipped_file = self.output_dir / f"{phase}_skipped.json"
        # Merge with any existing skipped docs (from previous runs)
        existing = []
        if skipped_file.exists():
            with open(skipped_file) as f:
                existing = json.load(f)
        existing_ids = {d["document_id"] for d in existing}
        for doc in skipped_docs:
            if doc["document_id"] not in existing_ids:
                existing.append(doc)
        with open(skipped_file, "w") as f:
            json.dump(existing, f, indent=2)
        print(f"  Saved {len(skipped_docs)} skipped docs to {skipped_file.name}")

    def _load_skipped_docs(self, phase: str) -> list[dict]:
        """Load skipped docs for a phase."""
        skipped_file = self.output_dir / f"{phase}_skipped.json"
        if not skipped_file.exists():
            return []
        with open(skipped_file) as f:
            return json.load(f)

    def _find_latest_batch_dir(self, phase: str) -> Optional[Path]:
        """Find the most recent batch directory for a phase."""
        dirs = list(self.output_dir.glob(f"{phase}_*"))
        if not dirs:
            return None
        return max(dirs, key=lambda d: d.stat().st_mtime)

    def submit_sections_phase(
        self,
        resume: bool = False,
        dry_run: bool = False,
    ) -> Optional[str]:
        """
        Submit sections batch.

        Args:
            resume: Skip already-processed documents
            dry_run: Show what would be submitted without actually submitting

        Returns:
            Batch ID if submitted, None if dry run
        """
        print(f"\n=== SECTIONS PHASE: {self.state}" + (f" Title {self.title}" if self.title else "") + " ===")

        # Load existing summaries for sibling context
        self._load_summaries_cache()

        # Get sections grouped by parent
        sections_by_parent = get_sections_grouped_by_parent(self.state, self.title)

        # Flatten for counting
        all_sections = [s for siblings in sections_by_parent.values() for s in siblings]
        print(f"  Total sections: {len(all_sections)}")

        # Filter if resuming
        completed_ids = set()
        if resume:
            completed_ids = self._load_completed_ids("sections")
            if completed_ids:
                print(f"  Already completed: {len(completed_ids)}")

        # Build requests
        requests = []
        skipped_docs: list[dict] = []  # reserved/empty docs to save with standard summaries
        skipped_done = 0

        # Batch-fetch all ancestors in ONE query (huge speedup)
        # Get first doc_id from each parent group - siblings share ancestors
        first_doc_ids = [siblings[0]["id"] for siblings in sections_by_parent.values()]
        print(f"  Fetching ancestors for {len(first_doc_ids)} parent groups...", flush=True)
        ancestors_by_doc = get_ancestors_batch(first_doc_ids)

        # Map parent_id -> ancestors (using first sibling's ancestors)
        ancestors_cache: dict[int, list[dict]] = {}
        for parent_id, siblings in sections_by_parent.items():
            first_doc_id = siblings[0]["id"]
            ancestors_cache[parent_id] = ancestors_by_doc.get(first_doc_id, [])

        for parent_id, siblings in sections_by_parent.items():
            ancestors = ancestors_cache[parent_id]

            for doc in siblings:
                doc_id = doc["id"]

                # Skip if already done
                if doc_id in completed_ids:
                    skipped_done += 1
                    continue

                # Check if should skip
                content = doc.get("content", "")
                title = doc.get("title", "")
                skip, reason = should_skip_content(content, title)

                if skip:
                    skipped_docs.append({
                        "document_id": doc_id,
                        "reason": reason,
                    })
                    continue

                # Build prompt (ancestors already fetched for this parent group)
                sibling_sums = self._get_sibling_summaries(doc, siblings)
                user_prompt = build_section_user_prompt(doc, ancestors, sibling_sums, content)

                requests.append(format_batch_request(
                    custom_id=f"doc_{doc_id}",
                    prompt=user_prompt,
                    response_format=SummaryResponse,
                    system=SUMMARIZATION_SYSTEM,
                    model=BATCH_MODEL,
                ))

        print(f"  Requests to submit: {len(requests)}")
        print(f"  Skipped (reserved/empty): {len(skipped_docs)}")
        if skipped_done > 0:
            print(f"  Skipped (already done): {skipped_done}")

        if dry_run:
            print("\n  [DRY RUN] Would submit batch with these requests:")
            for req in requests[:3]:
                print(f"    - {req['custom_id']}")
            if len(requests) > 3:
                print(f"    ... and {len(requests) - 3} more")
            return None

        if not requests and not skipped_docs:
            print("  No requests to submit.")
            return None

        # Save skipped docs so process_results can include them
        if skipped_docs:
            self._save_skipped_docs("sections", skipped_docs)

        if not requests:
            print("  No LLM requests needed (all skipped).")
            return None

        # Submit batch
        batch_id = self.manager.submit_batch(
            requests=requests,
            batch_name=f"sections_{self.state}",
            metadata={
                "state": self.state,
                "phase": "sections",
                "title": self.title,
                "model": BATCH_MODEL,
                "skipped_reserved": len(skipped_docs),
            },
        )

        print(f"\n  Submitted batch: {batch_id}")
        return batch_id

    def submit_parent_phase(
        self,
        level: str,  # 'subchapter', 'chapter', 'part', 'title'
        resume: bool = False,
        dry_run: bool = False,
    ) -> Optional[str]:
        """
        Submit parent-level batch.

        Args:
            level: Hierarchy level ('subchapter', 'chapter', 'part', 'title')
            resume: Skip already-processed documents
            dry_run: Show what would be submitted without actually submitting

        Returns:
            Batch ID if submitted, None if dry run
        """
        print(f"\n=== {level.upper()}S PHASE: {self.state}" + (f" Title {self.title}" if self.title else "") + " ===")

        # Load child summaries from previous phases
        self._load_summaries_cache()

        # Get documents at this level
        docs = get_documents_by_level(self.state, level, self.title)
        print(f"  Total {level}s: {len(docs)}")

        # Filter if resuming
        completed_ids = set()
        if resume:
            completed_ids = self._load_completed_ids(f"{level}s")
            if completed_ids:
                print(f"  Already completed: {len(completed_ids)}")

        # Build requests
        requests = []
        skipped_docs: list[dict] = []
        skipped_done = 0

        # Batch-fetch all ancestors and child IDs in TWO queries (huge speedup)
        doc_ids = [doc["id"] for doc in docs]
        print(f"  Fetching ancestors for {len(doc_ids)} documents...", flush=True)
        ancestors_by_doc = get_ancestors_batch(doc_ids)
        print(f"  Fetching child IDs for {len(doc_ids)} documents...", flush=True)
        children_by_doc = get_child_ids_batch(doc_ids)

        for doc in docs:
            doc_id = doc["id"]

            # Skip if already done
            if doc_id in completed_ids:
                skipped_done += 1
                continue

            # Check if should skip
            content = doc.get("content", "")
            title = doc.get("title", "")
            skip, reason = should_skip_content(content, title)

            if skip:
                skipped_docs.append({
                    "document_id": doc_id,
                    "reason": reason,
                })
                continue

            # Build prompt with child summaries (using pre-fetched data)
            ancestors = ancestors_by_doc.get(doc_id, [])
            child_ids = children_by_doc.get(doc_id, [])

            # Get child summaries from cache
            child_sums = []
            for cid in child_ids:
                cached = self.summaries_cache.get(cid)
                if cached and cached.get("model_family") in VALID_CONTEXT_MODEL_FAMILIES:
                    citation = cached.get("citation") or f"ID:{cid}"
                    child_sums.append((citation, cached["summary"]))

            intro_text = extract_intro_text(content)
            user_prompt = build_parent_user_prompt(doc, ancestors, child_sums, intro_text)

            requests.append(format_batch_request(
                custom_id=f"doc_{doc_id}",
                prompt=user_prompt,
                response_format=SummaryResponse,
                system=SUMMARIZATION_SYSTEM,
                model=BATCH_MODEL,
            ))

        print(f"  Requests to submit: {len(requests)}")
        print(f"  Skipped (reserved/empty): {len(skipped_docs)}")
        if skipped_done > 0:
            print(f"  Skipped (already done): {skipped_done}")

        if dry_run:
            print("\n  [DRY RUN] Would submit batch with these requests:")
            for req in requests[:3]:
                print(f"    - {req['custom_id']}")
            if len(requests) > 3:
                print(f"    ... and {len(requests) - 3} more")
            return None

        if not requests and not skipped_docs:
            print("  No requests to submit.")
            return None

        # Save skipped docs so process_results can include them
        if skipped_docs:
            self._save_skipped_docs(f"{level}s", skipped_docs)

        if not requests:
            print("  No LLM requests needed (all skipped).")
            return None

        # Submit batch
        batch_id = self.manager.submit_batch(
            requests=requests,
            batch_name=f"{level}s_{self.state}",
            metadata={
                "state": self.state,
                "phase": f"{level}s",
                "title": self.title,
                "model": BATCH_MODEL,
                "skipped_reserved": len(skipped_docs),
            },
        )

        print(f"\n  Submitted batch: {batch_id}")
        return batch_id

    def submit_all_titles(
        self,
        phase: str,
        resume: bool = False,
        dry_run: bool = False,
    ) -> dict[str, str]:
        """
        Submit separate batches for each title.

        Args:
            phase: Phase to submit ('sections', 'subchapters', etc.)
            resume: Skip already-processed documents
            dry_run: Show what would be submitted without actually submitting

        Returns:
            Dict mapping title -> batch_id
        """
        from .db_queries import get_all_titles

        titles = get_all_titles(self.state)
        print(f"\n{'=' * 60}", flush=True)
        print(f"SUBMITTING {phase.upper()} FOR ALL TITLES ({len(titles)} titles)", flush=True)
        print(f"{'=' * 60}\n", flush=True)

        results = {}

        for i, title in enumerate(titles, 1):
            print(f"[{i}/{len(titles)}] Title {title}...", flush=True)

            # Create runner for this title
            # output_dir is summaries_staging/NJ/batch/, need to go up 2 levels
            # to summaries_staging/ so __init__ can add state/batch/ correctly
            title_runner = SummarizationBatchRunner(
                state=self.state,
                output_dir=self.output_dir.parent.parent,  # summaries_staging/
                title=title,
            )

            # Submit based on phase
            if phase == "sections":
                batch_id = title_runner.submit_sections_phase(
                    resume=resume,
                    dry_run=dry_run,
                )
            else:
                level = phase.rstrip("s")  # subchapters -> subchapter
                batch_id = title_runner.submit_parent_phase(
                    level=level,
                    resume=resume,
                    dry_run=dry_run,
                )

            if batch_id:
                results[title] = batch_id
                print(f"    ✓ Submitted: {batch_id[:20]}...")
            elif not dry_run:
                print(f"    - Skipped (no requests)")

        print(f"\n{'=' * 60}")
        if dry_run:
            print(f"DRY RUN complete - would submit {len(titles)} batches")
        else:
            print(f"SUBMITTED {len(results)} BATCHES")
        print(f"{'=' * 60}")
        return results

    def check_status(self) -> list[dict]:
        """
        Check status of all batches for this state, grouped by title.

        Returns:
            List of batch status dicts
        """
        print(f"\n=== BATCH STATUS: {self.state} ===\n")

        statuses = []
        by_title: dict[str, list[dict]] = {}  # title -> list of statuses

        for batch_dir in sorted(self.output_dir.glob("*_*")):
            info_file = batch_dir / "batch_info.json"
            if not info_file.exists():
                continue

            with open(info_file) as f:
                info = json.load(f)

            batch_id = info.get("batch_api_id")
            if not batch_id:
                continue

            title = info.get("title") or "all"

            try:
                status = self.manager.get_batch_status(batch_id)
                status["batch_dir"] = batch_dir.name
                status["phase"] = info.get("phase", "unknown")
                status["batch_id"] = batch_id
                status["title"] = title
                statuses.append(status)

                # Group by title
                if title not in by_title:
                    by_title[title] = []
                by_title[title].append(status)

            except Exception as e:
                print(f"  {batch_dir.name}: Error checking status - {e}")

        # Display grouped by title
        if len(by_title) > 1:
            # Multiple titles - show compact grouped view
            for title in sorted(by_title.keys(), key=lambda x: (x == "all", x)):
                title_statuses = by_title[title]
                for s in title_statuses:
                    state_icon = "✓" if s["status"] == "ended" else "⋯"
                    pct = 100 * s["succeeded"] // s["total"] if s["total"] else 0
                    err_str = f" ({s['errored']} errors)" if s.get("errored", 0) > 0 else ""
                    print(f"  Title {title:>4}: {s['succeeded']:>5}/{s['total']:<5} ({pct:>3}%) {state_icon} {s['status']}{err_str}")
        else:
            # Single title or legacy - show detailed view
            for status in statuses:
                phase = status["phase"]
                state = status["status"]
                succeeded = status["succeeded"]
                total = status["total"]
                batch_id = status["batch_id"]

                print(f"  {phase}: {batch_id[:20]}...")
                print(f"    Status: {state}")
                print(f"    Progress: {succeeded}/{total} ({100*succeeded//total if total else 0}%)")
                if status["errored"] > 0:
                    print(f"    Errors: {status['errored']}")
                print()

        return statuses

    def _find_batch_dir_by_id(self, batch_id: str) -> Optional[Path]:
        """Find batch directory using batch_mapping.json for exact lookup."""
        mapping_file = self.output_dir / "batch_mapping.json"
        if mapping_file.exists():
            mapping = json.loads(mapping_file.read_text())
            batch_dir_str = mapping.get(batch_id)
            if batch_dir_str:
                batch_dir = Path(batch_dir_str)
                if batch_dir.exists():
                    return batch_dir
        return None

    def process_results(self, phase: str, batch_id: str = None) -> list[dict]:
        """
        Process results from a completed batch.

        Args:
            phase: Phase name (e.g., 'sections', 'subchapters')
            batch_id: Specific batch ID to process. When provided, looks up the
                exact batch directory instead of globbing (avoids collisions
                when multiple titles run concurrently).

        Returns:
            List of result dicts with keys: document_id, title, hierarchy_level,
            state, citation, summary, section_type, keywords, applies_to,
            has_form, has_incorporation_by_reference, metadata.
        """
        print(f"\n=== PROCESSING {phase.upper()} RESULTS ===\n")

        # Use exact batch_id lookup when available, fall back to glob
        if batch_id:
            batch_dir = self._find_batch_dir_by_id(batch_id)
            if not batch_dir:
                print(f"  No batch directory found for batch_id: {batch_id}")
                return []
        else:
            batch_dir = self._find_latest_batch_dir(phase)
            if not batch_dir:
                print(f"  No batch directory found for phase: {phase}")
                return []

        info_file = batch_dir / "batch_info.json"
        with open(info_file) as f:
            info = json.load(f)

        batch_id = info.get("batch_api_id")
        if not batch_id:
            print(f"  No batch ID found in {info_file}")
            return []

        # Check if batch is complete
        status = self.manager.get_batch_status(batch_id)
        if status["status"] != "ended":
            print(f"  Batch not complete: {status['status']}")
            print(f"  Progress: {status['succeeded']}/{status['total']}")
            return []

        print(f"  Processing batch: {batch_id}")
        print(f"  Succeeded: {status['succeeded']}, Errored: {status['errored']}")

        if status['succeeded'] == 0 and status.get('total', 0) > 0:
            print(f"  ERROR: Batch completely failed — all {status.get('total', '?')} requests errored.")
            print(f"  No results to process. Check batch logs for details.")
            return []

        if status['errored'] > 0:
            error_rate = status['errored'] / status.get('total', 1) * 100
            print(f"  WARNING: {error_rate:.1f}% of requests failed ({status['errored']}/{status.get('total', '?')})")

        results = []  # List of dicts with all extracted fields
        processed = 0

        for result in self.manager.get_batch_results(batch_id):
            custom_id = result.custom_id
            doc_id = int(custom_id.replace("doc_", ""))

            if result.result.type == "succeeded":
                parsed = _parse_tool_use_result(result.result.message)
                summary_text = parsed["summary"]
                word_count = len(summary_text.split())

                # Create metadata
                metadata = SummaryMetadata(
                    document_id=doc_id,
                    hierarchy_level=phase.rstrip("s"),  # sections -> section
                    state=self.state,
                    original_char_count=0,  # Not tracked in batch
                    original_word_count=0,
                    input_char_count=0,
                    chunking_strategy="batch",
                    num_chunks=1,
                    summary_char_count=len(summary_text),
                    summary_word_count=word_count,
                    model_name=BATCH_MODEL,
                    phase=phase,
                )
                metadata_dict = metadata.to_dict()
                metadata_dict["model_family"] = "claude"
                metadata_dict["batch_id"] = batch_id

                result_dict = {
                    "document_id": doc_id,
                    "title": "",
                    "hierarchy_level": phase.rstrip("s"),
                    "state": self.state,
                    "citation": None,
                    **parsed,
                    "metadata": metadata_dict,
                }

                # Cache for parent phases (citation filled in below)
                self.summaries_cache[doc_id] = {
                    "summary": summary_text,
                    "model_family": "claude",
                    "citation": None,
                }

                results.append(result_dict)

            elif result.result.type == "errored":
                error = result.result.error
                self.manager.log_error(batch_dir, custom_id, "ERROR", str(error))

            elif result.result.type == "expired":
                self.manager.log_error(batch_dir, custom_id, "EXPIRED", "Request timed out")

            processed += 1
            if processed % 1000 == 0:
                print(f"  Processed {processed} results...")

        # Backfill citations from DB (batch API responses don't include them)
        if results:
            from .db_queries import get_connection
            result_ids = [r["document_id"] for r in results]
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, citation FROM regulatory_documents WHERE id = ANY(%s)",
                        [result_ids],
                    )
                    citation_map = {row[0]: row[1] for row in cur.fetchall()}
            for r in results:
                doc_id = r["document_id"]
                citation = citation_map.get(doc_id)
                r["citation"] = citation
                if doc_id in self.summaries_cache:
                    self.summaries_cache[doc_id]["citation"] = citation

        # Add skipped docs with standard summaries
        skipped_docs = self._load_skipped_docs(phase)
        for doc in skipped_docs:
            doc_id = doc["document_id"]
            reason = doc.get("reason", "empty")
            summary_text = get_standard_summary(reason)
            section_type = "reserved" if reason in ("reserved", "repealed") else "other"

            result_dict = {
                "document_id": doc_id,
                "title": "",
                "hierarchy_level": phase.rstrip("s"),
                "state": self.state,
                "citation": None,
                "summary": summary_text,
                "section_type": section_type,
                "keywords": [],
                "applies_to": [],
                "has_form": False,
                "has_incorporation_by_reference": False,
                "metadata": {"skipped_reason": reason},
            }
            results.append(result_dict)

        if skipped_docs:
            print(f"  Added {len(skipped_docs)} skipped docs with standard summaries")

        # Save results (results is already a list of dicts)
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

    def process_all_batches(self, phase: str) -> list[dict]:
        """
        Process ALL batches for a phase with deduplication.

        Finds all batch directories for the phase, processes any unprocessed ones,
        then combines all results with deduplication (keeps most recent by timestamp).

        Args:
            phase: Phase name (e.g., 'sections')

        Returns:
            Deduplicated list of results
        """
        print(f"\n=== PROCESSING ALL {phase.upper()} BATCHES (with deduplication) ===\n")

        # Find all batch directories for this phase
        batch_dirs = sorted(self.output_dir.glob(f"{phase}_*"))
        print(f"  Found {len(batch_dirs)} batch directories for {phase}")

        error_count = 0

        # Process any unprocessed batches
        for batch_dir in batch_dirs:
            info_file = batch_dir / "batch_info.json"
            results_file = batch_dir / "results.json"

            if not info_file.exists():
                continue

            # Skip if already processed
            if results_file.exists():
                print(f"  {batch_dir.name}: already processed")
                continue

            with open(info_file) as f:
                info = json.load(f)

            batch_id = info.get("batch_api_id")
            if not batch_id:
                continue

            # Check if batch is complete
            try:
                status = self.manager.get_batch_status(batch_id)
                if status["status"] != "ended":
                    print(f"  {batch_dir.name}: not complete ({status['status']})")
                    continue

                print(f"  {batch_dir.name}: processing {status['succeeded']} results...")

                # Process this batch (reuse existing logic)
                results = []
                for result in self.manager.get_batch_results(batch_id):
                    custom_id = result.custom_id
                    doc_id = int(custom_id.replace("doc_", ""))

                    if result.result.type == "succeeded":
                        parsed = _parse_tool_use_result(result.result.message)
                        result_dict = {
                            "document_id": doc_id,
                            **parsed,
                            "metadata": {
                                "model_family": "claude",
                                "batch_id": batch_id,
                                "batch_dir": batch_dir.name,
                            },
                        }
                        results.append(result_dict)

                # Save results
                with open(results_file, "w") as f:
                    json.dump(results, f, indent=2)

                # Update batch info
                info["status"] = "processed"
                info["processed_at"] = datetime.now().isoformat()
                info["results_count"] = len(results)
                with open(info_file, "w") as f:
                    json.dump(info, f, indent=2)

                print(f"    Saved {len(results)} results")

            except Exception as e:
                error_count += 1
                print(f"  {batch_dir.name}: error - {e}")

        # Now combine all results with deduplication
        print(f"\n  Combining and deduplicating...")
        all_results: dict[int, dict] = {}  # doc_id -> result (keeps latest)

        for batch_dir in batch_dirs:
            results_file = batch_dir / "results.json"
            if not results_file.exists():
                continue

            with open(results_file) as f:
                data = json.load(f)

            for r in data:
                doc_id = r["document_id"]
                all_results[doc_id] = r  # Later batches overwrite earlier

        deduped = list(all_results.values())
        print(f"  Total unique results: {len(deduped)}")

        # Save combined deduped file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        combined_file = self.output_dir / f"{phase}_combined_{timestamp}.json"
        with open(combined_file, "w") as f:
            json.dump(deduped, f, indent=2)

        print(f"  Saved to: {combined_file}")

        if error_count > 0:
            print(f"  WARNING: {error_count} batch(es) encountered errors during processing")

        return deduped

    def combine_results(self) -> Path:
        """
        Combine all phase results into a single file.

        Returns:
            Path to combined results file
        """
        print(f"\n=== COMBINING RESULTS ===\n")

        all_results = []

        for phase in ["sections", "subchapters", "chapters", "parts", "titles"]:
            batch_dir = self._find_latest_batch_dir(phase)
            if not batch_dir:
                continue

            results_file = batch_dir / "results.json"
            if not results_file.exists():
                continue

            with open(results_file) as f:
                data = json.load(f)

            all_results.extend(data)
            print(f"  Loaded {len(data)} results from {phase}")

        # Save combined
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        combined_file = self.output_dir / f"combined_{timestamp}.json"

        with open(combined_file, "w") as f:
            json.dump(all_results, f, indent=2)

        print(f"\n  Combined {len(all_results)} results to {combined_file}")

        return combined_file

    def view_results(self, phase: str, limit: int = 5) -> None:
        """
        Display sample results from a completed batch.

        Args:
            phase: Phase name (e.g., 'sections', 'subchapters')
            limit: Number of results to display
        """
        batch_dir = self._find_latest_batch_dir(phase)
        if not batch_dir:
            print(f"\n  No batch directory found for phase: {phase}")
            return

        results_file = batch_dir / "results.json"
        if not results_file.exists():
            print(f"\n  No results file found at {results_file}")
            print(f"  Run --process first to download and save results.")
            return

        with open(results_file) as f:
            results = json.load(f)

        print(f"\n{'='*60}")
        print(f"SAMPLE RESULTS: {phase} ({len(results)} total)")
        print(f"From: {batch_dir.name}")
        print(f"{'='*60}\n")

        for i, r in enumerate(results[:limit]):
            citation = r.get("citation") or f"ID:{r['document_id']}"
            title = r.get("title", "Untitled")
            if len(title) > 60:
                title = title[:57] + "..."
            summary = r.get("summary", "")
            section_type = r.get("section_type", "")
            keywords = r.get("keywords", [])
            applies_to = r.get("applies_to", [])
            has_form = r.get("has_form", False)
            has_ibr = r.get("has_incorporation_by_reference", False)

            print(f"[{i+1}] {citation}")
            print(f"    {title}")
            print(f"    Type: {section_type}" + (" | Form: ✓" if has_form else "") + (" | IBR: ✓" if has_ibr else ""))
            if keywords:
                print(f"    Keywords: {', '.join(keywords[:5])}")
            if applies_to:
                print(f"    Applies to: {', '.join(applies_to[:5])}")
            print(f"    ---")
            # Print summary with word wrapping
            words = summary.split()
            line = "    "
            for word in words:
                if len(line) + len(word) + 1 > 80:
                    print(line)
                    line = "    " + word
                else:
                    line += " " + word if line.strip() else word
            if line.strip():
                print(line)
            print()

        if len(results) > limit:
            print(f"... and {len(results) - limit} more results")
            print(f"\nUse --limit {limit*2} to see more")

    def watch_status(self, interval: int = 30) -> None:
        """
        Continuously poll and display batch status.

        Args:
            interval: Polling interval in seconds
        """
        import time

        print(f"\nWatching batch status (polling every {interval}s)...")
        print("Press Ctrl+C to stop\n")

        try:
            while True:
                # Clear screen
                print("\033[2J\033[H", end="")

                statuses = self.check_status()

                if not statuses:
                    print("No batches found.")
                    break

                # Check if all complete
                all_complete = all(s.get("status") == "ended" for s in statuses)
                if all_complete:
                    print("\n✅ All batches complete!")
                    print("\nRun --process to download and save results.")
                    break

                # Show next poll time
                print(f"\n(Polling every {interval}s, Ctrl+C to stop)")
                print(f"Next poll in {interval} seconds...")
                time.sleep(interval)

        except KeyboardInterrupt:
            print("\n\nStopped watching.")

    def run_phase(self, phase: str, poll_interval: int = 30) -> list[dict]:
        """
        Run a single phase end-to-end: submit → poll → process.

        Args:
            phase: Phase name (e.g., 'sections', 'subchapters')
            poll_interval: Seconds between status polls

        Returns:
            List of result dicts from process_results
        """
        print(f"\n{'='*60}")
        print(f"RUNNING PHASE: {phase.upper()}")
        print(f"{'='*60}")

        # Submit
        if phase == "sections":
            batch_id = self.submit_sections_phase(resume=True)
        else:
            level = phase.rstrip("s")  # subchapters -> subchapter
            batch_id = self.submit_parent_phase(level=level, resume=True)

        if not batch_id:
            print(f"  No requests to submit for {phase} (all already processed)")
            # Still try to process existing results
            return self.process_results(phase)

        # Poll until complete
        print(f"\n  Polling batch {batch_id[:20]}... (every {poll_interval}s)")
        self.manager.poll_until_complete(
            batch_id,
            poll_interval=poll_interval,
        )

        # Process results — pass batch_id for exact directory lookup
        # (avoids picking up another concurrent title's batch dir)
        return self.process_results(phase, batch_id=batch_id)

    def run_all_phases(self, poll_interval: int = 30) -> dict[str, list[dict]]:
        """
        Run all phases sequentially in bottom-up hierarchy order.

        Auto-detects the hierarchy levels present for this state/title and
        orders them deepest-first (e.g., sections → subparts → parts →
        subchapters → chapters → titles). Each phase submits, polls until
        complete, and processes results before the next phase starts (parent
        phases need child summaries as context).

        Args:
            poll_interval: Seconds between status polls

        Returns:
            Dict mapping phase name → list of result dicts
        """
        # Auto-detect parent levels in bottom-up order
        parent_levels = get_hierarchy_order(self.state, self.title)
        # Sections are always first, then parent levels (pluralized for phase names)
        phases = ["sections"] + [f"{level}s" for level in parent_levels]

        all_results = {}

        print(f"\n{'='*60}")
        print(f"RUNNING ALL PHASES: {self.state}" + (f" Title {self.title}" if self.title else ""))
        print(f"Detected phase order: {' → '.join(phases)}")
        print(f"{'='*60}")

        for i, phase in enumerate(phases, 1):
            print(f"\n[{i}/{len(phases)}] Phase: {phase}")
            results = self.run_phase(phase, poll_interval=poll_interval)
            all_results[phase] = results
            print(f"  {phase}: {len(results)} results")

        total = sum(len(r) for r in all_results.values())
        print(f"\n{'='*60}")
        print(f"ALL PHASES COMPLETE: {total} total results")
        print(f"{'='*60}")
        return all_results
