"""Reusable enrichment runner for batch LLM classification tasks.

Handles the common pattern: fetch rows → build prompts → call LLM → parse → write back.
Supports both realtime and batch API modes, with chunked writes and batch resume.

Usage:
    from lib.enrichment import EnrichmentRunner

    runner = EnrichmentRunner(
        name="who_pays_normalized",
        response_model=WhoPaysClassification,
        system_prompt=SYSTEM_PROMPT,
        build_prompt=lambda row: f"who_pays: {row['who_pays']}",
        fetch_rows=lambda limit: fetch_unclassified(limit),
        write_result=lambda row_id, parsed: (row_id, parsed.category),
        write_batch=lambda results: bulk_update(results),
    )
    runner.run(execute=True, batch=True, limit=100)
"""

import asyncio
import logging
import time
from typing import Callable, Optional, Type

from pydantic import BaseModel

from lib.batch import BatchManager, format_batch_request, parse_batch_result_tool_use
from lib.llm import call_llm_parse_async, get_async_anthropic_client
from lib.stats import format_time

logger = logging.getLogger(__name__)


class EnrichmentRunner:
    """Generic runner for DB enrichment via LLM classification.

    Args:
        name: Short name for this enrichment (used in batch naming and logs).
        response_model: Pydantic model for the LLM structured output.
        system_prompt: System prompt for the LLM.
        build_prompt: Callable(row_dict) -> str. Builds the user prompt from a DB row.
        fetch_rows: Callable(limit) -> list[dict]. Fetches rows to enrich.
            Each row must have an 'id' key.
        write_result: Callable(row_id, parsed_model) -> tuple.
            Extracts the (id, value) pair to write. Returns a tuple that
            write_batch will receive as a list.
        write_batch: Callable(list[tuple]) -> int. Writes results to DB.
            Returns count of rows written.
        batch_model: Model to use for batch API (default: Haiku).
        realtime_model: Model to use for realtime API (default: Haiku).
        max_tokens: Max tokens for LLM response (default: 8192).
    """

    def __init__(
        self,
        name: str,
        response_model: Type[BaseModel],
        system_prompt: str,
        build_prompt: Callable[[dict], str],
        fetch_rows: Callable[[int], list[dict]],
        write_result: Callable,
        write_batch: Callable[[list], int],
        batch_model: str = "claude-haiku-4-5-20251001",
        realtime_model: str = "claude-haiku-4-5-20251001",
        max_tokens: int = 8192,
    ):
        self.name = name
        self.response_model = response_model
        self.system_prompt = system_prompt
        self.build_prompt = build_prompt
        self.fetch_rows = fetch_rows
        self.write_result = write_result
        self.write_batch = write_batch
        self.batch_model = batch_model
        self.realtime_model = realtime_model
        self.max_tokens = max_tokens

    def run(
        self,
        execute: bool = False,
        batch: bool = False,
        limit: int = 0,
        resume_batch_ids: list[str] | None = None,
    ) -> int:
        """Run the enrichment pipeline.

        Args:
            execute: If False, dry-run only (preview prompts, no LLM calls).
            batch: If True, use batch API; otherwise realtime.
            limit: Max rows to process (0 = all).
            resume_batch_ids: List of Anthropic batch IDs to resume from
                (skip fetch/submit, just download results and write to DB).

        Returns:
            Number of rows updated (0 in dry-run mode).
        """
        if resume_batch_ids:
            return self._resume_batches(resume_batch_ids)

        print(f"Fetching rows for {self.name}...")
        rows = self.fetch_rows(limit)
        print(f"  Found {len(rows)} rows to process")

        if not rows:
            print("  Nothing to do.")
            return 0

        if not execute:
            self._dry_run(rows)
            return 0

        print(f"\nClassifying {len(rows)} rows via {'batch' if batch else 'realtime'} API...")
        if batch:
            results = self._run_batch(rows)
        else:
            results = self._run_realtime(rows)

        print(f"\nWriting {len(results)} results to DB...")
        updated = self.write_batch(results)
        print(f"  Done: {updated} rows updated.")
        return updated

    def _resume_batches(self, batch_ids: list[str]) -> int:
        """Resume from completed Anthropic batches — download results and write to DB.

        Useful when a script was killed after batch submission but before
        results were written. The batch results persist in the Anthropic API.
        """
        from lib.llm import get_anthropic_client

        client = get_anthropic_client()
        results = []
        failed = 0

        for batch_id in batch_ids:
            print(f"  Downloading results from {batch_id}...")
            batch = client.messages.batches.retrieve(batch_id)
            print(f"    Status: {batch.processing_status}, counts: {batch.request_counts}")

            if batch.processing_status != "ended":
                print(f"    Skipping — batch not complete")
                continue

            for result in client.messages.batches.results(batch_id):
                try:
                    parsed = parse_batch_result_tool_use(result, self.response_model)
                    if parsed:
                        # Extract row_id from custom_id like 'name_12345'
                        row_id = int(result.custom_id.rsplit("_", 1)[-1])
                        results.append(self.write_result(row_id, parsed))
                    else:
                        failed += 1
                except Exception as e:
                    failed += 1
                    print(f"    Parse error for {result.custom_id}: {str(e)[:100]}")

        print(f"\n  Downloaded {len(results)} results, {failed} failures")

        if results:
            print(f"  Writing {len(results)} results to DB...")
            updated = self.write_batch(results)
            print(f"  Done: {updated} rows updated.")
            return updated
        return 0

    def _dry_run(self, rows: list[dict]) -> None:
        """Preview prompts without making LLM calls."""
        print(f"\n  DRY RUN — showing first 5 prompts:\n")
        for row in rows[:5]:
            prompt = self.build_prompt(row)
            print(f"  --- id={row['id']} ---")
            print(f"  {prompt}")
            print()
        print(f"  Run with --execute to classify and write to DB.")

    def _run_realtime(self, rows: list[dict]) -> list:
        """Classify rows one-by-one via realtime API."""

        async def _run():
            client = get_async_anthropic_client()
            results = []
            failed = 0
            total = len(rows)
            start = time.time()

            for i, row in enumerate(rows):
                prompt = self.build_prompt(row)
                elapsed = time.time() - start

                if i > 0 and total > 1:
                    rate = i / elapsed if elapsed > 0 else 0
                    remaining = (total - i) / rate if rate > 0 else 0
                    eta = format_time(remaining)
                else:
                    eta = "..."

                # Build a short label from the row for progress display
                label = self._row_label(row)
                print(f"  [{i+1}/{total}] id={row['id']} {label}... ", end="", flush=True)

                try:
                    parsed, usage = await call_llm_parse_async(
                        client=client,
                        prompt=prompt,
                        response_format=self.response_model,
                        system=self.system_prompt,
                        model=self.realtime_model,
                        max_tokens=self.max_tokens,
                    )
                    if parsed:
                        result = self.write_result(row['id'], parsed)
                        results.append(result)
                        print(f"→ {self._parsed_label(parsed)} ETA: {eta}")
                    else:
                        failed += 1
                        print("→ FAILED (no result)")
                except Exception as e:
                    failed += 1
                    print(f"→ ERROR: {str(e)[:80]}")

            print(f"\n[realtime] Completed: {len(results)} succeeded, {failed} failed out of {total} total")
            return results

        return asyncio.run(_run())

    def _run_batch(self, rows: list[dict]) -> list:
        """Classify rows via batch API, with realtime retry + coercion fallback for failures."""
        requests = []
        id_map = {}  # custom_id -> row_id
        row_map = {}  # row_id -> row dict (for retries)

        for row in rows:
            custom_id = f"{self.name}_{row['id']}"
            prompt = self.build_prompt(row)
            req = format_batch_request(
                custom_id=custom_id,
                prompt=prompt,
                response_format=self.response_model,
                model=self.batch_model,
                system=self.system_prompt,
                max_tokens=self.max_tokens,
            )
            requests.append(req)
            id_map[custom_id] = row['id']
            row_map[row['id']] = row

        # Split into chunks of 10,000 (practical limit for batch submissions)
        BATCH_CHUNK_SIZE = 10_000
        manager = BatchManager()
        results = []
        failed_row_ids = []

        chunks = [requests[i:i + BATCH_CHUNK_SIZE] for i in range(0, len(requests), BATCH_CHUNK_SIZE)]
        for chunk_idx, chunk in enumerate(chunks):
            chunk_label = f" (chunk {chunk_idx + 1}/{len(chunks)})" if len(chunks) > 1 else ""
            print(f"  Submitting {len(chunk)} requests to batch API{chunk_label}...")
            batch_id = manager.submit_batch(chunk, batch_name=f"{self.name}_{chunk_idx}" if len(chunks) > 1 else self.name)
            print(f"  BATCH SUBMITTED: {batch_id}")
            print(f"  (To resume: --resume-batch {batch_id})")
            manager.poll_until_complete(batch_id)

            for result in manager.get_batch_results(batch_id):
                row_id = id_map.get(result.custom_id)
                if not row_id:
                    logger.warning("Unknown custom_id in batch results: %s", result.custom_id)
                    continue
                try:
                    parsed = parse_batch_result_tool_use(result, self.response_model)
                    if parsed:
                        results.append(self.write_result(row_id, parsed))
                    else:
                        failed_row_ids.append(row_id)
                except Exception as e:
                    failed_row_ids.append(row_id)
                    print(f"  Batch parse error for {result.custom_id}: {str(e)[:100]}")

        print(f"  Batch complete: {len(results)} classified, {len(failed_row_ids)} failures")

        # Retry failures via realtime API with coercion fallback
        if failed_row_ids:
            failed_rows = [row_map[rid] for rid in failed_row_ids if rid in row_map]
            retry_results = self._retry_failures(failed_rows)
            results.extend(retry_results)

        total = len(rows)
        print(f"\n[batch] Completed: {len(results)} succeeded, {total - len(results)} failed out of {total} total")

        return results

    def _retry_failures(self, rows: list[dict]) -> list:
        """Retry failed rows via realtime API with coercion fallback.

        Strategy: try realtime model (1 attempt) → coerce raw response → skip.
        Coercion handles the common case where the LLM returns valid data
        except for hallucinated Literal values in list/scalar fields.
        """
        from lib.llm import call_llm_parse, get_anthropic_client

        print(f"\n  Retrying {len(rows)} failures via realtime API...")
        client = get_anthropic_client()
        results = []

        for row in rows:
            prompt = self.build_prompt(row)

            # Try realtime model with 1 attempt (not 3 — if it hallucinates, retries won't help)
            parsed = call_llm_parse(
                client=client,
                prompt=prompt,
                response_format=self.response_model,
                model=self.realtime_model,
                system=self.system_prompt,
                max_tokens=self.max_tokens,
                max_retries=1,
            )

            if parsed:
                results.append(self.write_result(row['id'], parsed))
                print(f"    id={row['id']} → retry OK")
                continue

            # Try coercing the raw response (filter invalid list items, null invalid scalars)
            coerced = self._coerce_realtime(client, prompt, row['id'])
            if coerced:
                results.append(self.write_result(row['id'], coerced))
                print(f"    id={row['id']} → coerced OK")
            else:
                print(f"    id={row['id']} → FAILED")

        print(f"  Retry complete: {len(results)}/{len(rows)} recovered")
        return results

    def _coerce_realtime(self, client, prompt: str, row_id: int) -> Optional[BaseModel]:
        """Make a raw LLM call and coerce the response, filtering invalid Literal values."""
        from typing import get_args, get_origin, Union

        try:
            # Raw call without Pydantic validation
            response = client.messages.create(
                model=self.realtime_model,
                max_tokens=self.max_tokens,
                system=[{"type": "text", "text": self.system_prompt}],
                tools=[{
                    "name": self.response_model.__name__,
                    "description": self.response_model.__doc__ or "",
                    "input_schema": self.response_model.model_json_schema(),
                }],
                tool_choice={"type": "tool", "name": self.response_model.__name__},
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract tool_use input
            for block in response.content:
                if block.type == 'tool_use':
                    input_data = dict(block.input)

                    # Coerce invalid Literal values
                    model_fields = self.response_model.model_fields
                    for field_name, field_info in model_fields.items():
                        annotation = field_info.annotation
                        raw_val = input_data.get(field_name)

                        # Unwrap Optional
                        inner = annotation
                        if get_origin(annotation) is Union:
                            args = get_args(annotation)
                            non_none = [a for a in args if a is not type(None)]
                            if len(non_none) == 1:
                                inner = non_none[0]

                        # list[Literal[...]] — filter invalid
                        if get_origin(inner) is list:
                            list_args = get_args(inner)
                            if list_args and hasattr(list_args[0], '__args__'):
                                valid_values = set(list_args[0].__args__)
                                if isinstance(raw_val, list):
                                    input_data[field_name] = [v for v in raw_val if v in valid_values]

                        # Scalar Literal — null if invalid
                        elif hasattr(inner, '__args__') and isinstance(raw_val, str):
                            valid_values = set(inner.__args__)
                            if raw_val not in valid_values:
                                input_data[field_name] = None

                    return self.response_model.model_validate(input_data)

        except Exception as e:
            logger.warning("JSON coercion failed for item %s: %s", row_id, e)
        return None

    def _row_label(self, row: dict) -> str:
        """Build a short display label from a row for progress output."""
        # Use the first non-id string field, truncated
        for key, val in row.items():
            if key != 'id' and isinstance(val, str) and val:
                return f"{key}={val[:50]}"
        return ""

    def _parsed_label(self, parsed: BaseModel) -> str:
        """Build a short display label from a parsed result."""
        parts = []
        # Show the first 1-2 fields (usually the classification)
        for field_name, field_value in parsed:
            parts.append(f"{field_value}")
            if len(parts) >= 2:
                break
        return " ".join(str(p) for p in parts)
