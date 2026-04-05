"""Retry non-verbatim text_examples with a stricter prompt.

After the main JenAI analysis batch completes, this module checks each
finding's text_examples against the source text. Any that are paraphrased
get retried with a tighter prompt asking for only verbatim quotes.

If the retry also fails to produce verbatim quotes, the original
text_examples are kept and is_verbatim is set to false (summaries are fine,
we just flag them).
"""

from pydantic import BaseModel, Field

from scripts.research_pipeline.result_processor import check_verbatim
from lib.batch import BatchManager, format_batch_request
from .state_machine import TrackedUnit, ProcessingState
from .config import BATCH_MODEL


RETRY_SYSTEM = """\
Your previous analysis of a regulatory section produced text_examples that \
were paraphrased instead of verbatim. Please provide ONLY verbatim text \
excerpts from the section text that illustrate the issue.

CRITICAL RULES:
- Every excerpt MUST be copied VERBATIM from the section text below
- Do NOT paraphrase, summarize, or create hypothetical scenarios
- Do NOT generate examples — only quote actual regulatory text
- Copy exact words, punctuation, and capitalization
- Each excerpt should be 1-3 sentences illustrating the regulatory problem
- If no verbatim excerpt illustrates the issue, return an empty list

Call submit_examples with your verbatim excerpts."""


class RetryExamples(BaseModel):
    text_examples: list[str] = Field(
        default_factory=list,
        description="Verbatim excerpts from the section text (0-5 excerpts)",
    )


SUBMIT_TOOL = {
    "name": "submit_examples",
    "description": "Submit verbatim text excerpts from the regulation",
    "input_schema": RetryExamples.model_json_schema(),
}


def find_non_verbatim(units: list[TrackedUnit]) -> list[tuple[TrackedUnit, int]]:
    """Find units with non-verbatim text_examples.

    Returns list of (unit, category_index) pairs that need retry.
    """
    needs_retry = []
    for tracked in units:
        if tracked.state != ProcessingState.DONE or not tracked.analysis_output:
            continue
        source_text = tracked.unit.content or ""
        if not source_text:
            continue

        for i, cat in enumerate(tracked.analysis_output.categories):
            if not cat.text_examples:
                continue
            all_verbatim, _ = check_verbatim(cat.text_examples, source_text)
            if not all_verbatim:
                needs_retry.append((tracked, i))

    return needs_retry


def build_retry_requests(
    needs_retry: list[tuple[TrackedUnit, int]],
) -> tuple[list[dict], dict[str, tuple[TrackedUnit, int]]]:
    """Build batch requests for retrying non-verbatim text_examples."""
    requests = []
    id_map: dict[str, tuple[TrackedUnit, int]] = {}

    for tracked, cat_idx in needs_retry:
        cat = tracked.analysis_output.categories[cat_idx]
        unit = tracked.unit
        custom_id = f"retry_{unit.document_id}_{cat_idx}"

        user_msg = (
            f"Issue found: [{cat.category.value}] {cat.explanation[:300]}\n"
            f"Citation: {unit.citation}\n\n"
            f"SECTION TEXT:\n{unit.content}"
        )

        req = format_batch_request(
            custom_id=custom_id,
            prompt=user_msg,
            system=RETRY_SYSTEM,
            model=BATCH_MODEL,
            max_tokens=1024,
            tools=[SUBMIT_TOOL],
        )
        requests.append(req)
        id_map[custom_id] = (tracked, cat_idx)

    return requests, id_map


def apply_retry_results(
    manager: BatchManager,
    batch_id: str,
    id_map: dict[str, tuple[TrackedUnit, int]],
) -> tuple[int, int]:
    """Parse retry results and update the units' text_examples.

    Returns (fixed_count, kept_as_summary_count).
    """
    fixed = 0
    kept = 0

    for result in manager.get_batch_results(batch_id):
        entry = id_map.get(result.custom_id)
        if not entry:
            continue

        tracked, cat_idx = entry
        cat = tracked.analysis_output.categories[cat_idx]
        source_text = tracked.unit.content or ""

        try:
            if result.result.type != "succeeded":
                raise ValueError(f"Result type: {result.result.type}")

            # Extract tool_use block
            new_examples = None
            for block in result.result.message.content:
                if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "submit_examples":
                    new_examples = block.input.get("text_examples", [])
                    break

            if new_examples is None:
                raise ValueError("No submit_examples tool call")

            # Validate new examples
            if new_examples and source_text:
                all_verbatim, _ = check_verbatim(new_examples, source_text)
                if all_verbatim:
                    cat.text_examples = new_examples
                    fixed += 1
                    continue

            # Retry also failed — keep originals as summaries
            kept += 1

        except Exception:
            kept += 1

    return fixed, kept


def retry_non_verbatim_text_examples(
    units: list[TrackedUnit],
    batch_name: str = "jenai_retry_verbatim",
) -> None:
    """Run a retry batch for any non-verbatim text_examples.

    Modifies units in place — updates text_examples on categories where
    the retry produces better verbatim quotes.
    """
    needs_retry = find_non_verbatim(units)
    if not needs_retry:
        print("  All text_examples are verbatim — no retry needed")
        return

    print(f"  Found {len(needs_retry)} findings with non-verbatim text_examples")

    requests, id_map = build_retry_requests(needs_retry)
    print(f"  Submitting retry batch ({len(requests)} requests)...")

    manager = BatchManager()
    batch_id = manager.submit_batch(requests, batch_name=batch_name)
    manager.poll_until_complete(batch_id, poll_interval=30)

    fixed, kept = apply_retry_results(manager, batch_id, id_map)
    print(f"  Retry results: {fixed} fixed to verbatim, {kept} kept as summaries")
