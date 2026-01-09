"""
Pipeline logging module for the research pipeline.

Provides per-tier log files that are written to the run directory,
making it easy to monitor progress even when stdout is buffered.

Log files created:
- pipeline.log: All events from all tiers
- tier1.log: Tier 1 (Match Filtering) events only
- tier2.log: Tier 2 (Summary Research) events only
- tier3.log: Tier 3 (Web Search) events only
"""

import logging
import sys
from pathlib import Path
from typing import Optional


class PipelineLogger:
    """
    Manages per-tier log files for pipeline runs.

    Creates log files in the run directory with immediate flushing
    to avoid buffering issues when running in background.

    Usage:
        logger = PipelineLogger(run_dir)
        logger.info(1, "Starting Tier 1")
        logger.debug(1, "Building context...")
        logger.info(None, "Pipeline complete")  # None = pipeline.log only
    """

    def __init__(self, run_dir: Path):
        """
        Initialize logger with run directory.

        Args:
            run_dir: Path to the run directory (e.g., backend/.pipeline_batches/run_*)
        """
        self.run_dir = Path(run_dir)
        self._loggers: dict[str, logging.Logger] = {}
        self._handlers: list[logging.Handler] = []
        self._current_tier: Optional[int] = None
        self._setup_loggers()

    def _setup_loggers(self):
        """Set up all log files."""
        # Main pipeline log
        self._create_logger("pipeline", "pipeline.log")

        # Per-tier logs
        for tier in [1, 2, 3]:
            self._create_logger(f"tier{tier}", f"tier{tier}.log")

    def _create_logger(self, name: str, filename: str):
        """
        Create a logger with file handler.

        Args:
            name: Logger name (e.g., "pipeline", "tier1")
            filename: Log file name (e.g., "pipeline.log", "tier1.log")
        """
        # Use unique logger name to avoid conflicts
        logger_name = f"research_pipeline.{name}"
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.DEBUG)

        # Remove any existing handlers to avoid duplicates on re-init
        logger.handlers.clear()

        # File handler with immediate flush
        log_path = self.run_dir / filename
        handler = logging.FileHandler(log_path, mode='a', encoding='utf-8')
        handler.setLevel(logging.DEBUG)

        # Format: HH:MM:SS | LEVEL | message
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-5s | %(message)s',
            datefmt='%H:%M:%S'
        )
        handler.setFormatter(formatter)

        # Force immediate flush after each write
        handler.stream.reconfigure(line_buffering=True)

        logger.addHandler(handler)
        self._loggers[name] = logger
        self._handlers.append(handler)

    def set_tier(self, tier: int):
        """Set the current tier for subsequent log calls."""
        self._current_tier = tier

    def _log(self, tier: Optional[int], level: str, message: str):
        """
        Log a message to pipeline.log and optionally to tier-specific log.

        Args:
            tier: Tier number (1, 2, 3) or None for pipeline-only
            level: Log level ("debug", "info", "warning", "error")
            message: Log message
        """
        # Always log to pipeline.log
        log_fn = getattr(self._loggers["pipeline"], level.lower())
        log_fn(message)

        # Also log to tier-specific file if tier specified
        effective_tier = tier if tier is not None else self._current_tier
        if effective_tier:
            tier_logger = self._loggers.get(f"tier{effective_tier}")
            if tier_logger:
                getattr(tier_logger, level.lower())(message)

        # Flush all handlers immediately
        for handler in self._handlers:
            handler.flush()

    def debug(self, tier: Optional[int], message: str):
        """Log debug message."""
        self._log(tier, "debug", message)

    def info(self, tier: Optional[int], message: str):
        """Log info message."""
        self._log(tier, "info", message)

    def warning(self, tier: Optional[int], message: str):
        """Log warning message."""
        self._log(tier, "warning", message)

    def error(self, tier: Optional[int], message: str):
        """Log error message."""
        self._log(tier, "error", message)

    def exception(self, tier: Optional[int], message: str):
        """Log error message with exception traceback."""
        self._loggers["pipeline"].exception(message)

        effective_tier = tier if tier is not None else self._current_tier
        if effective_tier:
            tier_logger = self._loggers.get(f"tier{effective_tier}")
            if tier_logger:
                tier_logger.exception(message)

        for handler in self._handlers:
            handler.flush()

    def close(self):
        """Close all log handlers."""
        for handler in self._handlers:
            handler.close()
        self._handlers.clear()


class DualOutput:
    """
    Helper class that prints to console AND logs to file.

    Usage:
        out = DualOutput(logger, tier=1)
        out.info("Starting tier 1")  # Prints AND logs
        out.debug("Details...")       # Prints AND logs
    """

    def __init__(self, logger: Optional[PipelineLogger], tier: Optional[int] = None):
        """
        Initialize dual output.

        Args:
            logger: PipelineLogger instance (or None to print-only)
            tier: Current tier number for logging
        """
        self.logger = logger
        self.tier = tier

    def _output(self, level: str, message: str, print_level: bool = False):
        """Print and log a message."""
        # Print to console (with flush for immediate visibility)
        if print_level:
            print(f"[{level.upper()}] {message}", flush=True)
        else:
            print(message, flush=True)

        # Log to file if logger available
        if self.logger:
            log_fn = getattr(self.logger, level.lower())
            log_fn(self.tier, message)

    def debug(self, message: str):
        """Debug level (logged, not printed unless verbose)."""
        # For debug, only log - don't clutter console
        if self.logger:
            self.logger.debug(self.tier, message)

    def info(self, message: str):
        """Info level (printed and logged)."""
        self._output("info", message)

    def warning(self, message: str):
        """Warning level (printed and logged)."""
        self._output("warning", message, print_level=True)

    def error(self, message: str):
        """Error level (printed and logged)."""
        self._output("error", message, print_level=True)

    def progress(self, message: str, end: str = "\n"):
        """
        Progress update (printed with custom end, logged as debug).

        Useful for \r carriage return progress updates.
        """
        print(message, end=end, flush=True)
        if self.logger:
            # Log without carriage return artifacts
            clean_msg = message.strip()
            if clean_msg:
                self.logger.debug(self.tier, clean_msg)
