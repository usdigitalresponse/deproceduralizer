"""
Batch persistence module for research pipeline resume capability.

Saves run state to disk to enable resuming interrupted batch runs.
When a pipeline run is interrupted (crash, timeout, manual stop), the
next invocation can automatically resume from where it left off.

Directory structure:
    backend/.pipeline_batches/
    ├── run_{timestamp}_{state}_{issue_label}/
    │   ├── manifest.json        # Run metadata and status
    │   ├── tier1_batch.json     # Tier 1 batch submission info
    │   ├── tier2_batch.json     # Tier 2 batch submission info
    │   └── units.json           # Unit states
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Union, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from .state_machine import TrackedUnit


class RunStatus(str, Enum):
    """Status of a pipeline run."""
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class RunManifest:
    """
    Manifest tracking a pipeline run's state.

    Saved to manifest.json in the run directory.
    """
    run_id: str
    state: str  # 'nj', 'ny', or 'dangerously-run-all'
    issue_types: list[str]
    max_tier: int
    enable_web_search: bool
    max_docs_per_issue: Union[int, str]  # int or 'all'
    global_docs_limit: Union[int, str]  # int or 'no-limit'

    status: RunStatus
    current_tier: int  # 0 = not started, 1-3 = in that tier

    # Optional fields
    title_filter: Optional[str] = None  # e.g., '3A' for Title 3A, None = all titles

    # Batch tracking
    tier1_batch_id: Optional[str] = None
    tier2_batch_id: Optional[str] = None

    # Timestamps
    created_at: str = ""
    updated_at: str = ""
    completed_at: Optional[str] = None

    # Counts
    total_units: int = 0
    units_completed: int = 0
    units_failed: int = 0

    # Error info
    error_message: Optional[str] = None

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()


@dataclass
class BatchInfo:
    """
    Information about a submitted batch.

    Saved to tier{N}_batch.json in the run directory.
    """
    batch_id: str
    tier: int
    submitted_at: str
    total_requests: int
    status: str  # 'submitted', 'in_progress', 'ended', 'failed'

    # Result counts (populated when batch completes)
    succeeded: int = 0
    errored: int = 0
    expired: int = 0

    # Tracking
    unit_custom_ids: list[str] = field(default_factory=list)


class BatchPersistence:
    """
    Manages persistence of pipeline run state for resume capability.

    Example usage:
        persistence = BatchPersistence(base_dir=Path("backend/.pipeline_batches"))

        # Start new run
        run_dir = persistence.create_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2,
            enable_web_search=False,
            max_docs_per_issue=100,
            global_docs_limit='no-limit',
        )

        # Save batch submission
        persistence.save_batch_info(run_dir, batch_info)

        # Save unit states
        persistence.save_units(run_dir, tracked_units)

        # Find existing runs for resume
        existing = persistence.find_matching_run(
            state="nj",
            issue_types=["mail_only"],
            max_tier=2
        )
    """

    def __init__(self, base_dir: Path):
        """
        Initialize batch persistence.

        Args:
            base_dir: Directory for storing run state (e.g., backend/.pipeline_batches)
        """
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _run_dir_name(self, timestamp: str, state: str, issue_label: str, title_filter: Optional[str] = None) -> str:
        """Generate run directory name."""
        # Sanitize state for filesystem
        safe_state = state.replace("-", "_")
        # Include title filter in name (e.g., "title3A" or "alltitles")
        title_label = f"title{title_filter}" if title_filter else "alltitles"
        return f"run_{timestamp}_{safe_state}_{title_label}_{issue_label}"

    def create_run(
        self,
        state: str,
        issue_types: list[str],
        max_tier: int,
        enable_web_search: bool,
        max_docs_per_issue: Union[int, str],
        global_docs_limit: Union[int, str],
        title_filter: Optional[str] = None,
    ) -> Path:
        """
        Create a new run directory with manifest.

        Args:
            state: State code ('nj', 'ny', or 'dangerously-run-all')
            issue_types: List of issue types being processed
            max_tier: Maximum tier to run (1-3)
            enable_web_search: Whether web search is enabled
            max_docs_per_issue: Max docs per issue type (int or 'all')
            global_docs_limit: Global doc limit (int or 'no-limit')
            title_filter: Optional title filter (e.g., '3A' for Title 3A)

        Returns:
            Path to the run directory
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        issue_label = issue_types[0] if len(issue_types) == 1 else f"multi_{len(issue_types)}"

        run_dir = self.base_dir / self._run_dir_name(timestamp, state, issue_label, title_filter)
        run_dir.mkdir(parents=True, exist_ok=True)

        manifest = RunManifest(
            run_id=timestamp,
            state=state,
            issue_types=issue_types,
            max_tier=max_tier,
            enable_web_search=enable_web_search,
            max_docs_per_issue=max_docs_per_issue,
            global_docs_limit=global_docs_limit,
            title_filter=title_filter,
            status=RunStatus.IN_PROGRESS,
            current_tier=0,
        )

        self._save_manifest(run_dir, manifest)
        return run_dir

    def _save_manifest(self, run_dir: Path, manifest: RunManifest) -> None:
        """Save manifest to disk."""
        manifest.updated_at = datetime.now().isoformat()
        with open(run_dir / "manifest.json", "w") as f:
            # Convert enum to string for JSON serialization
            data = asdict(manifest)
            data["status"] = manifest.status.value
            json.dump(data, f, indent=2)

    def load_manifest(self, run_dir: Path) -> Optional[RunManifest]:
        """Load manifest from disk."""
        manifest_path = run_dir / "manifest.json"
        if not manifest_path.exists():
            return None

        with open(manifest_path) as f:
            data = json.load(f)

        data["status"] = RunStatus(data["status"])
        return RunManifest(**data)

    def update_manifest(
        self,
        run_dir: Path,
        status: Optional[RunStatus] = None,
        current_tier: Optional[int] = None,
        tier1_batch_id: Optional[str] = None,
        tier2_batch_id: Optional[str] = None,
        total_units: Optional[int] = None,
        units_completed: Optional[int] = None,
        units_failed: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Update manifest fields.

        Only provided fields are updated; None values are ignored.
        """
        manifest = self.load_manifest(run_dir)
        if not manifest:
            raise ValueError(f"No manifest found in {run_dir}")

        if status is not None:
            manifest.status = status
        if current_tier is not None:
            manifest.current_tier = current_tier
        if tier1_batch_id is not None:
            manifest.tier1_batch_id = tier1_batch_id
        if tier2_batch_id is not None:
            manifest.tier2_batch_id = tier2_batch_id
        if total_units is not None:
            manifest.total_units = total_units
        if units_completed is not None:
            manifest.units_completed = units_completed
        if units_failed is not None:
            manifest.units_failed = units_failed
        if error_message is not None:
            manifest.error_message = error_message

        if status == RunStatus.COMPLETED:
            manifest.completed_at = datetime.now().isoformat()

        self._save_manifest(run_dir, manifest)

    def save_batch_info(self, run_dir: Path, batch_info: BatchInfo) -> None:
        """Save batch submission info to tier-specific file."""
        filename = f"tier{batch_info.tier}_batch.json"
        with open(run_dir / filename, "w") as f:
            json.dump(asdict(batch_info), f, indent=2)

    def load_batch_info(self, run_dir: Path, tier: int) -> Optional[BatchInfo]:
        """Load batch info for a tier."""
        filename = f"tier{tier}_batch.json"
        batch_path = run_dir / filename
        if not batch_path.exists():
            return None

        with open(batch_path) as f:
            data = json.load(f)
        return BatchInfo(**data)

    def update_batch_info(
        self,
        run_dir: Path,
        tier: int,
        status: Optional[str] = None,
        succeeded: Optional[int] = None,
        errored: Optional[int] = None,
        expired: Optional[int] = None,
    ) -> None:
        """Update batch info fields."""
        batch_info = self.load_batch_info(run_dir, tier)
        if not batch_info:
            raise ValueError(f"No batch info for tier {tier} in {run_dir}")

        if status is not None:
            batch_info.status = status
        if succeeded is not None:
            batch_info.succeeded = succeeded
        if errored is not None:
            batch_info.errored = errored
        if expired is not None:
            batch_info.expired = expired

        self.save_batch_info(run_dir, batch_info)

    def save_units(self, run_dir: Path, units: list["TrackedUnit"]) -> None:
        """
        Save unit states to disk.

        Note: Only saves essential state info, not full tier outputs
        (those are in the database via incremental saves).
        """
        unit_data = []
        for unit in units:
            unit_data.append({
                "custom_id": unit.custom_id,
                "document_id": unit.document_id,
                "issue_type": unit.issue_type,
                "state": unit.state.name,
                "tier1_batch_id": unit.tier1_batch_id,
                "tier2_batch_id": unit.tier2_batch_id,
                "error_message": unit.error_message,
                "retry_count": unit.retry_count,
            })

        with open(run_dir / "units.json", "w") as f:
            json.dump(unit_data, f, indent=2)

    def load_units(self, run_dir: Path) -> list[dict]:
        """
        Load unit state data from disk.

        Note: Currently unused for resume - the pipeline resumes via database
        state (get_existing_analyses) rather than disk state. This function
        is retained for potential future offline resume scenarios where DB
        access may not be available.
        """
        units_path = run_dir / "units.json"
        if not units_path.exists():
            return []

        with open(units_path) as f:
            return json.load(f)

    def find_matching_run(
        self,
        state: str,
        issue_types: list[str],
        max_tier: int,
        title_filter: Optional[str] = None,
    ) -> Optional[Path]:
        """
        Find an existing run matching the given parameters.

        Only returns runs with status IN_PROGRESS or FAILED.

        Args:
            state: State code to match
            issue_types: Issue types to match (order doesn't matter)
            max_tier: Max tier to match
            title_filter: Optional title filter to match

        Returns:
            Path to run directory, or None if no matching run found
        """
        if not self.base_dir.exists():
            return None

        # Sort by most recent first (run directories include timestamp)
        run_dirs = sorted(
            [d for d in self.base_dir.iterdir() if d.is_dir()],
            key=lambda d: d.name,
            reverse=True
        )

        issue_types_set = set(issue_types)

        for run_dir in run_dirs:
            manifest = self.load_manifest(run_dir)
            if not manifest:
                continue

            # Check if run matches parameters (including title filter)
            manifest_title = getattr(manifest, 'title_filter', None)
            if (
                manifest.state == state and
                set(manifest.issue_types) == issue_types_set and
                manifest.max_tier == max_tier and
                manifest_title == title_filter and
                manifest.status in (RunStatus.IN_PROGRESS, RunStatus.FAILED)
            ):
                return run_dir

        return None

    def list_runs(
        self,
        status_filter: Optional[RunStatus] = None
    ) -> list[tuple[Path, RunManifest]]:
        """
        List all runs, optionally filtered by status.

        Args:
            status_filter: Optional status to filter by

        Returns:
            List of (run_dir, manifest) tuples, sorted by creation time (newest first)
        """
        if not self.base_dir.exists():
            return []

        runs = []
        for run_dir in self.base_dir.iterdir():
            if not run_dir.is_dir():
                continue
            manifest = self.load_manifest(run_dir)
            if manifest:
                if status_filter is None or manifest.status == status_filter:
                    runs.append((run_dir, manifest))

        return sorted(runs, key=lambda x: x[1].created_at, reverse=True)

    def cleanup_old_runs(self, keep_last_n: int = 10) -> int:
        """
        Remove old completed runs, keeping the most recent N.

        Args:
            keep_last_n: Number of completed runs to keep

        Returns:
            Number of runs deleted
        """
        import shutil

        completed_runs = self.list_runs(status_filter=RunStatus.COMPLETED)

        if len(completed_runs) <= keep_last_n:
            return 0

        to_delete = completed_runs[keep_last_n:]
        deleted = 0

        for run_dir, _ in to_delete:
            try:
                shutil.rmtree(run_dir)
                deleted += 1
            except Exception as e:
                print(f"Warning: Could not delete {run_dir}: {e}")

        return deleted
