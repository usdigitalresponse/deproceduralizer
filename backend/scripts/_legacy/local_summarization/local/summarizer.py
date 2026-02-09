"""Async summarizer using Ollama API."""

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import aiohttp

from chunking import Chunk, chunk_document
from models import SummaryMetadata, SummaryResult

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "reg-summarizer"
MAX_CONCURRENT = 2  # Safe for 16GB M2
CHECKPOINT_EVERY = 50


class ParallelSummarizer:
    """Parallel document summarizer using Ollama."""

    def __init__(self, output_dir: str = "summaries_staging"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.results: list[SummaryResult] = []
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def summarize_text(
        self, text: str, session: aiohttp.ClientSession
    ) -> tuple[str, int, int]:
        """Call Ollama API to summarize text."""
        prompt = f"Summarize this regulatory text in 1-2 sentences:\n\n{text}"

        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 100},
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

    async def process_document(
        self, doc: dict[str, Any], session: aiohttp.ClientSession
    ) -> SummaryResult:
        """Process a single document with chunking and summarization."""

        async with self.semaphore:  # Limit concurrency
            content = doc.get("content") or ""
            original_chars = len(content)
            original_words = len(content.split())

            # Detect unparseable content
            is_unparseable = False
            unparseable_reason = None

            content_lower = content.lower().strip()
            if "data in image" in content_lower:
                is_unparseable = True
                unparseable_reason = "image_only"
            elif content_lower.count("data in image") > 2:
                is_unparseable = True
                unparseable_reason = "image_only"
            elif original_chars < 50 and ("reserved" in content_lower or "[reserved]" in content_lower):
                is_unparseable = True
                unparseable_reason = "reserved"
            elif original_chars < 20:
                is_unparseable = True
                unparseable_reason = "empty"
            elif content_lower.replace("\n", "").replace(" ", "") in ["", "reserved", "[reserved]"]:
                is_unparseable = True
                unparseable_reason = "reserved"

            # Detect special content types
            is_index = bool(
                "table of contents" in content_lower
                or (content.count("\n") > 50 and len(content) < 2000)
            )
            contains_defs = bool(
                "definition" in doc.get("title", "").lower()
                or '"means"' in content_lower
                or "shall mean" in content_lower
            )

            # Skip LLM for unparseable content - return standard message
            if is_unparseable:
                if unparseable_reason == "image_only":
                    final_summary = "Contains tabular data or images not available as text."
                elif unparseable_reason == "reserved":
                    final_summary = "Reserved section - no current requirements."
                else:
                    final_summary = "No parseable content available."

                metadata = SummaryMetadata(
                    document_id=doc["id"],
                    hierarchy_level=doc.get("hierarchy_level", "unknown"),
                    state=doc.get("state", "unknown"),
                    original_char_count=original_chars,
                    original_word_count=original_words,
                    input_char_count=0,
                    chunking_strategy="skipped",
                    num_chunks=0,
                    processing_time_ms=0,
                    is_unparseable=True,
                    unparseable_reason=unparseable_reason,
                )
                return SummaryResult(
                    document_id=doc["id"],
                    title=doc.get("title", ""),
                    hierarchy_level=doc.get("hierarchy_level", "unknown"),
                    state=doc.get("state", "unknown"),
                    citation=doc.get("citation"),
                    summary=final_summary,
                    metadata=metadata,
                )

            # Chunk the document
            chunks = chunk_document(content)

            # Summarize each chunk
            chunk_summaries: list[str] = []
            total_time_ms = 0
            total_tokens = 0
            error_msg = None

            for chunk in chunks:
                try:
                    summary, elapsed_ms, tokens = await self.summarize_text(
                        chunk.text, session
                    )
                    chunk_summaries.append(summary)
                    total_time_ms += elapsed_ms
                    total_tokens += tokens
                except Exception as e:
                    chunk_summaries.append(f"[ERROR: {str(e)}]")
                    error_msg = str(e)

            # Combine chunk summaries if multiple
            if len(chunk_summaries) == 1:
                final_summary = chunk_summaries[0]
            else:
                # For multi-chunk, create a meta-summary
                combined = " ".join(chunk_summaries)
                if len(combined) < 500:
                    final_summary = combined
                else:
                    # Summarize the summaries
                    try:
                        meta_prompt = f"Combine these partial summaries into one 1-2 sentence summary:\n\n{combined}"
                        final_summary, meta_time, meta_tokens = await self.summarize_text(
                            meta_prompt, session
                        )
                        total_time_ms += meta_time
                        total_tokens += meta_tokens
                    except Exception as e:
                        final_summary = combined[:500] + "..."
                        error_msg = str(e)

            # Build metadata
            metadata = SummaryMetadata(
                document_id=doc["id"],
                hierarchy_level=doc.get("hierarchy_level", "unknown"),
                state=doc.get("state", "unknown"),
                original_char_count=original_chars,
                original_word_count=original_words,
                input_char_count=sum(len(c.text) for c in chunks),
                chunking_strategy=chunks[0].chunk_type,
                num_chunks=len(chunks),
                chunk_summaries=chunk_summaries if len(chunks) > 1 else [],
                summary_char_count=len(final_summary),
                summary_word_count=len(final_summary.split()),
                processing_time_ms=total_time_ms,
                was_truncated=any(c.chunk_type == "truncated" for c in chunks),
                contains_definitions=contains_defs,
                is_index_or_toc=is_index,
                is_unparseable=is_unparseable,
                unparseable_reason=unparseable_reason,
                generation_tokens=total_tokens,
                error=error_msg,
            )

            return SummaryResult(
                document_id=doc["id"],
                title=doc.get("title", ""),
                hierarchy_level=doc.get("hierarchy_level", "unknown"),
                state=doc.get("state", "unknown"),
                citation=doc.get("citation"),
                summary=final_summary,
                metadata=metadata,
            )

    async def process_batch(
        self,
        documents: list[dict[str, Any]],
        progress_callback: callable = None,
    ) -> list[SummaryResult]:
        """Process a batch of documents with progress tracking."""

        connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT)
        timeout = aiohttp.ClientTimeout(total=120)  # 2 min timeout per request

        async with aiohttp.ClientSession(
            connector=connector, timeout=timeout
        ) as session:
            tasks = []
            for doc in documents:
                task = asyncio.create_task(self.process_document(doc, session))
                tasks.append(task)

            results = []
            for i, coro in enumerate(asyncio.as_completed(tasks)):
                try:
                    result = await coro
                    results.append(result)

                    # Progress update
                    if progress_callback:
                        progress_callback(i + 1, len(documents), result)
                    elif (i + 1) % 10 == 0:
                        print(f"  Processed {i + 1}/{len(documents)} documents...")

                    # Checkpoint
                    if (i + 1) % CHECKPOINT_EVERY == 0:
                        self.save_checkpoint(results, f"checkpoint_{i+1}.json")

                except Exception as e:
                    print(f"  Error processing document: {e}")

            return results

    def save_checkpoint(self, results: list[SummaryResult], filename: str):
        """Save intermediate results to JSON."""
        filepath = self.output_dir / filename
        with open(filepath, "w") as f:
            json.dump([r.to_dict() for r in results], f, indent=2)
        print(f"  Checkpoint saved: {filepath}")

    def save_results(
        self, results: list[SummaryResult], filename: str = "summaries.json"
    ) -> Path:
        """Save final results to staging file."""
        filepath = self.output_dir / filename
        with open(filepath, "w") as f:
            json.dump([r.to_dict() for r in results], f, indent=2)
        print(f"\nResults saved to: {filepath}")
        return filepath
