#!/usr/bin/env python3
"""
Hierarchical bottom-up summarization pipeline.

Processes documents from sections up to titles, using child summaries
to inform parent summaries.
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiohttp
from dotenv import load_dotenv

from db_queries import (
    get_documents_by_level,
    get_ancestors,
    get_children,
    get_child_ids,
    get_sections_grouped_by_parent,
)
from hierarchy import (
    HIERARCHY_ORDER,
    get_processing_order,
    get_phase_info,
    get_sibling_context,
    get_children_context,
    get_context_limits,
    is_parent_level,
)
from parent_context import (
    extract_intro_text,
    build_ancestor_context,
    build_section_prompt,
    build_parent_prompt,
    should_skip_content,
    get_standard_summary,
)
from models import SummaryMetadata, SummaryResult
from chunking import chunk_document

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "reg-summarizer"
MAX_CONCURRENT = 2  # Safe for 16GB M2


class ProgressDisplay:
    """Real-time progress display with ETA."""

    def __init__(self, total: int, phase_name: str, phase_num: int, total_phases: int):
        self.total = total
        self.phase_name = phase_name
        self.phase_num = phase_num
        self.total_phases = total_phases
        self.completed = 0
        self.start_time = time.time()
        self.recent_summaries: list[tuple[str, str]] = []  # (citation, summary)

    def update(self, citation: str, summary: str):
        """Update progress with a completed document."""
        self.completed += 1

        # Track recent summaries (last 3)
        self.recent_summaries.append((citation, summary[:80] + "..." if len(summary) > 80 else summary))
        if len(self.recent_summaries) > 3:
            self.recent_summaries.pop(0)

        self._display()

    def _display(self):
        """Render progress display."""
        elapsed = time.time() - self.start_time
        pct = (self.completed / self.total) * 100 if self.total > 0 else 0

        # Calculate speed and ETA
        if self.completed > 0:
            speed = self.completed / elapsed
            remaining = self.total - self.completed
            eta_seconds = remaining / speed if speed > 0 else 0
        else:
            speed = 0
            eta_seconds = 0

        # Format times
        elapsed_str = self._format_time(elapsed)
        eta_str = self._format_time(eta_seconds)

        # Progress bar
        bar_width = 30
        filled = int(bar_width * self.completed / self.total) if self.total > 0 else 0
        bar = "█" * filled + "░" * (bar_width - filled)

        # Clear and redraw
        print(f"\033[2K\rPhase {self.phase_num}/{self.total_phases}: {self.phase_name.upper()}")
        print(f"\033[2K\r[{bar}] {self.completed:,}/{self.total:,} ({pct:.1f}%)")
        print(f"\033[2K\r├─ Speed: {speed:.1f} docs/sec")
        print(f"\033[2K\r├─ Elapsed: {elapsed_str}")
        print(f"\033[2K\r└─ ETA: {eta_str}")

        if self.recent_summaries:
            print(f"\033[2K\r")
            print(f"\033[2K\rRecent summaries:")
            for citation, summary in self.recent_summaries:
                print(f"\033[2K\r  {citation}: {summary}")

        # Move cursor up to overwrite on next update
        lines_to_move = 6 + (1 + len(self.recent_summaries) if self.recent_summaries else 0)
        print(f"\033[{lines_to_move}A", end="")

    def _format_time(self, seconds: float) -> str:
        """Format seconds as Xm Ys."""
        if seconds < 60:
            return f"{seconds:.0f}s"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"

    def finish(self):
        """Finalize display."""
        elapsed = time.time() - self.start_time
        elapsed_str = self._format_time(elapsed)
        speed = self.completed / elapsed if elapsed > 0 else 0

        # Move cursor down past display area
        lines = 6 + (1 + len(self.recent_summaries) if self.recent_summaries else 0)
        print(f"\033[{lines}B", end="")
        print(f"\n✓ Phase {self.phase_num} complete: {self.completed:,} docs in {elapsed_str} ({speed:.1f} docs/sec)")


class HierarchicalSummarizer:
    """Hierarchical document summarizer."""

    def __init__(self, output_dir: str, state: str, title: Optional[str] = None, resume: bool = False):
        self.output_dir = Path(output_dir) / state.upper()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.state = state.upper()
        self.title = title
        self.resume = resume
        self.summaries_cache: dict[int, str] = {}  # doc_id -> summary
        self.completed_doc_ids: set[int] = set()  # Already processed docs
        self.results: list[SummaryResult] = []
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT)

        if resume:
            self._load_existing_results()

    def _load_existing_results(self):
        """Load results from existing checkpoint files to enable resume."""
        print("Loading existing results for resume...")

        # Find all checkpoint files and load them
        for phase in ["sections", "subchapters", "chapters", "parts", "subtitles", "titles"]:
            pattern = f"{phase}_*.json"
            files = sorted(self.output_dir.glob(pattern), reverse=True)

            if files:
                # Load most recent file for this phase
                latest = files[0]
                try:
                    with open(latest) as f:
                        data = json.load(f)

                    for item in data:
                        doc_id = item.get("document_id")
                        if doc_id:
                            self.completed_doc_ids.add(doc_id)
                            self.summaries_cache[doc_id] = item.get("summary", "")

                    print(f"  Loaded {len(data)} results from {latest.name}")
                except Exception as e:
                    print(f"  Warning: Could not load {latest}: {e}")

        print(f"  Total: {len(self.completed_doc_ids)} documents already processed\n")

    async def summarize_text(
        self,
        prompt: str,
        session: aiohttp.ClientSession,
    ) -> tuple[str, int, int]:
        """Call Ollama API to summarize text."""
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 150},
        }

        start_time = time.time()

        async with session.post(OLLAMA_URL, json=payload) as response:
            if response.status != 200:
                error_text = await response.text()
                raise RuntimeError(f"Ollama API error: {response.status} - {error_text}")
            result = await response.json()

        elapsed_ms = int((time.time() - start_time) * 1000)
        summary = result.get("response", "").strip()
        tokens = result.get("eval_count", 0)

        return summary, elapsed_ms, tokens

    async def process_section(
        self,
        doc: dict,
        siblings: list[dict],
        session: aiohttp.ClientSession,
    ) -> SummaryResult:
        """Process a single section with sibling and ancestor context."""
        async with self.semaphore:
            content = doc.get("content") or ""
            original_chars = len(content)
            original_words = len(content.split())

            # Check if unparseable
            should_skip, skip_reason = should_skip_content(content, doc.get("title", ""))
            if should_skip:
                summary = get_standard_summary(skip_reason)
                metadata = SummaryMetadata(
                    document_id=doc["id"],
                    hierarchy_level=doc.get("hierarchy_level", "section"),
                    state=self.state,
                    original_char_count=original_chars,
                    original_word_count=original_words,
                    input_char_count=0,
                    chunking_strategy="skipped",
                    num_chunks=0,
                    is_unparseable=True,
                    unparseable_reason=skip_reason,
                    phase="sections",
                    parent_id=doc.get("parent_id"),
                )
                return SummaryResult(
                    document_id=doc["id"],
                    title=doc.get("title", ""),
                    hierarchy_level=doc.get("hierarchy_level", "section"),
                    state=self.state,
                    citation=doc.get("citation"),
                    summary=summary,
                    metadata=metadata,
                )

            # Get ancestors for hierarchy breadcrumb
            ancestors = get_ancestors(doc["id"])

            # Get sibling context
            sibling_summaries = get_sibling_context(
                doc, siblings, self.summaries_cache, max_chars=800
            )

            # Chunk the content if needed
            chunks = chunk_document(content)

            # Build prompt with context
            chunk_text = chunks[0].text if chunks else content
            prompt = build_section_prompt(
                doc,
                ancestors,
                sibling_summaries,
                chunk_text,
            )

            # Summarize
            try:
                summary, elapsed_ms, tokens = await self.summarize_text(prompt, session)
                error_msg = None
            except Exception as e:
                summary = f"[ERROR: {str(e)}]"
                elapsed_ms = 0
                tokens = 0
                error_msg = str(e)

            # Build metadata
            metadata = SummaryMetadata(
                document_id=doc["id"],
                hierarchy_level=doc.get("hierarchy_level", "section"),
                state=self.state,
                original_char_count=original_chars,
                original_word_count=original_words,
                input_char_count=len(prompt),
                chunking_strategy=chunks[0].chunk_type if chunks else "full",
                num_chunks=len(chunks),
                summary_char_count=len(summary),
                summary_word_count=len(summary.split()),
                processing_time_ms=elapsed_ms,
                generation_tokens=tokens,
                parent_id=doc.get("parent_id"),
                sibling_summaries_used=len(sibling_summaries),
                ancestor_count=len(ancestors),
                phase="sections",
                error=error_msg,
            )

            return SummaryResult(
                document_id=doc["id"],
                title=doc.get("title", ""),
                hierarchy_level=doc.get("hierarchy_level", "section"),
                state=self.state,
                citation=doc.get("citation"),
                summary=summary,
                metadata=metadata,
            )

    async def process_parent(
        self,
        doc: dict,
        phase: str,
        session: aiohttp.ClientSession,
    ) -> SummaryResult:
        """Process a parent document using child summaries."""
        async with self.semaphore:
            content = doc.get("content") or ""
            original_chars = len(content)
            original_words = len(content.split())

            # Get context limits for this level
            level = doc.get("hierarchy_level", "chapter")
            limits = get_context_limits(level)

            # Get ancestors for hierarchy breadcrumb
            ancestors = get_ancestors(doc["id"])

            # Get children and their summaries
            children = get_children(doc["id"])
            child_summaries = get_children_context(
                doc["id"],
                children,
                self.summaries_cache,
                max_chars=limits["children_chars"],
            )

            # Extract intro text from parent's content
            intro_text = extract_intro_text(content, max_chars=limits["intro_chars"])

            # Check if we have enough context
            if not intro_text and not child_summaries:
                # Check if unparseable
                should_skip, skip_reason = should_skip_content(content, doc.get("title", ""))
                if should_skip:
                    summary = get_standard_summary(skip_reason)
                else:
                    summary = f"This {level} contains regulatory provisions. See child sections for specific requirements."

                metadata = SummaryMetadata(
                    document_id=doc["id"],
                    hierarchy_level=level,
                    state=self.state,
                    original_char_count=original_chars,
                    original_word_count=original_words,
                    input_char_count=0,
                    chunking_strategy="skipped" if should_skip else "hierarchical",
                    num_chunks=0,
                    is_unparseable=should_skip,
                    unparseable_reason=skip_reason if should_skip else None,
                    phase=phase,
                    parent_id=doc.get("parent_id"),
                    child_ids=[c["id"] for c in children],
                )
                return SummaryResult(
                    document_id=doc["id"],
                    title=doc.get("title", ""),
                    hierarchy_level=level,
                    state=self.state,
                    citation=doc.get("citation"),
                    summary=summary,
                    metadata=metadata,
                )

            # Build prompt
            prompt = build_parent_prompt(doc, ancestors, child_summaries, intro_text)

            # Summarize
            try:
                summary, elapsed_ms, tokens = await self.summarize_text(prompt, session)
                error_msg = None
            except Exception as e:
                summary = f"[ERROR: {str(e)}]"
                elapsed_ms = 0
                tokens = 0
                error_msg = str(e)

            # Build metadata
            metadata = SummaryMetadata(
                document_id=doc["id"],
                hierarchy_level=level,
                state=self.state,
                original_char_count=original_chars,
                original_word_count=original_words,
                input_char_count=len(prompt),
                chunking_strategy="hierarchical",
                num_chunks=1,
                summary_char_count=len(summary),
                summary_word_count=len(summary.split()),
                processing_time_ms=elapsed_ms,
                generation_tokens=tokens,
                parent_id=doc.get("parent_id"),
                child_ids=[c["id"] for c in children],
                child_summaries_used=len(child_summaries),
                intro_chars_used=len(intro_text),
                ancestor_count=len(ancestors),
                phase=phase,
                error=error_msg,
            )

            return SummaryResult(
                document_id=doc["id"],
                title=doc.get("title", ""),
                hierarchy_level=level,
                state=self.state,
                citation=doc.get("citation"),
                summary=summary,
                metadata=metadata,
            )

    async def run_sections_phase(
        self,
        progress: ProgressDisplay,
        session: aiohttp.ClientSession,
    ) -> list[SummaryResult]:
        """Run the sections phase with sibling context."""
        # Group sections by parent for sibling context
        sections_by_parent = get_sections_grouped_by_parent(self.state, self.title)

        results = []
        skipped = 0

        # Process each parent group sequentially to maintain sibling order
        for parent_id, siblings in sections_by_parent.items():
            for doc in siblings:
                doc_id = doc["id"]

                # Skip if already completed (resume mode)
                if doc_id in self.completed_doc_ids:
                    skipped += 1
                    progress.update(
                        doc.get("citation", f"ID:{doc_id}"),
                        "[skipped - already processed]",
                    )
                    continue

                # Process one at a time within a parent to maintain sibling context
                result = await self.process_section(doc, siblings, session)
                results.append(result)

                # Cache the summary for sibling context
                self.summaries_cache[doc_id] = result.summary

                # Update progress
                progress.update(
                    doc.get("citation", f"ID:{doc_id}"),
                    result.summary,
                )

        if skipped > 0:
            print(f"  (Skipped {skipped} already-processed documents)")

        return results

    async def run_parent_phase(
        self,
        level: str,
        phase: str,
        progress: ProgressDisplay,
        session: aiohttp.ClientSession,
    ) -> list[SummaryResult]:
        """Run a parent level phase."""
        docs = get_documents_by_level(self.state, level, self.title)

        results = []
        tasks = []
        skipped = 0

        # Create tasks for documents not already completed
        for doc in docs:
            doc_id = doc["id"]

            # Skip if already completed (resume mode)
            if doc_id in self.completed_doc_ids:
                skipped += 1
                progress.update(
                    doc.get("citation", f"ID:{doc_id}"),
                    "[skipped - already processed]",
                )
                continue

            task = asyncio.create_task(self.process_parent(doc, phase, session))
            tasks.append((doc, task))

        # Process as they complete
        for doc, task in tasks:
            result = await task
            results.append(result)

            # Cache the summary for parent context
            self.summaries_cache[doc["id"]] = result.summary

            # Update progress
            progress.update(
                doc.get("citation", f"ID:{doc['id']}"),
                result.summary,
            )

        if skipped > 0:
            print(f"  (Skipped {skipped} already-processed documents)")

        return results

    async def run_full_pipeline(self, dry_run: bool = False):
        """Run all phases in order."""
        print("=" * 70)
        print(f"HIERARCHICAL SUMMARIZATION: {self.state}" + (f" Title {self.title}" if self.title else ""))
        print("=" * 70)

        # Get phase info
        phases = get_phase_info(self.state, self.title)
        total_docs = sum(p["count"] for p in phases)

        print(f"\nPhases to process:")
        for p in phases:
            print(f"  {p['phase']}. {p['level'].upper()}: {p['count']:,} documents")
        print(f"\nTotal: {total_docs:,} documents")

        if dry_run:
            print("\n[DRY RUN] Would process the above. Use --run to execute.")
            return

        # Confirm for large batches
        if total_docs > 500:
            est_time = total_docs * 0.5 / 60  # ~0.5s per doc
            response = input(f"\nProcess {total_docs:,} documents (est. {est_time:.0f} min)? [y/N] ")
            if response.lower() != "y":
                print("Cancelled.")
                return

        # Setup connection
        connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT)
        timeout = aiohttp.ClientTimeout(total=120)

        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            all_results = []

            for phase_info in phases:
                level = phase_info["level"]
                phase_num = phase_info["phase"]
                count = phase_info["count"]

                print(f"\n" + "-" * 50)
                progress = ProgressDisplay(count, level, phase_num, len(phases))

                if level == "section":
                    results = await self.run_sections_phase(progress, session)
                else:
                    results = await self.run_parent_phase(level, level + "s", progress, session)

                progress.finish()
                all_results.extend(results)

                # Save checkpoint
                self._save_checkpoint(level, results)

            # Save combined results
            self._save_combined(all_results)

    def _save_checkpoint(self, level: str, results: list[SummaryResult]):
        """Save checkpoint for a phase."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{level}s_{timestamp}.json"
        filepath = self.output_dir / filename

        with open(filepath, "w") as f:
            json.dump([r.to_dict() for r in results], f, indent=2)

        print(f"  Saved: {filepath}")

    def _save_combined(self, results: list[SummaryResult]):
        """Save combined results from all phases."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"combined_{timestamp}.json"
        filepath = self.output_dir / filename

        with open(filepath, "w") as f:
            json.dump([r.to_dict() for r in results], f, indent=2)

        print(f"\n✓ Combined results saved: {filepath}")
        print(f"\nNext steps:")
        print(f"  python generate_review_html.py {filepath}")


async def check_ollama():
    """Check if Ollama is running and model is available."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:11434/api/tags") as resp:
                if resp.status != 200:
                    return False, "Ollama is not responding"
                data = await resp.json()
                models = [m["name"] for m in data.get("models", [])]
                if "reg-summarizer:latest" not in models:
                    return False, f"Model 'reg-summarizer' not found. Available: {', '.join(models) or 'none'}"
                return True, None
    except Exception as e:
        return False, f"Cannot connect to Ollama: {e}"


async def main():
    parser = argparse.ArgumentParser(
        description="Hierarchical bottom-up summarization pipeline"
    )
    parser.add_argument(
        "--state",
        required=True,
        choices=["NJ", "NY", "nj", "ny"],
        help="State to process",
    )
    parser.add_argument(
        "--title",
        type=str,
        help="Specific title to process (e.g., '8', '15A')",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without running",
    )
    parser.add_argument(
        "--output-dir",
        default="summaries_staging",
        help="Output directory for staging files",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from previous run, skipping already-processed documents",
    )

    args = parser.parse_args()

    # Check Ollama
    if not args.dry_run:
        ok, error = await check_ollama()
        if not ok:
            print(f"\nERROR: {error}")
            print("Please run 'ollama serve' and ensure reg-summarizer model is created.")
            sys.exit(1)

    # Run pipeline
    summarizer = HierarchicalSummarizer(
        output_dir=args.output_dir,
        state=args.state,
        title=args.title,
        resume=args.resume,
    )

    await summarizer.run_full_pipeline(dry_run=args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
