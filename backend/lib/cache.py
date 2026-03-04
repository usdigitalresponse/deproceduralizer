"""
LLM API response cache backed by Postgres.

SHA-256 hash of canonical request params → cached response.
Transparent to callers: check before API call, store after.
"""

import hashlib
import json
from datetime import datetime
from typing import Optional

import psycopg

from lib.db import get_db_connection


def _canonical_json(params: dict) -> str:
    """Deterministic JSON for hashing. Extracts only the fields that affect the response."""
    cache_keys = ("model", "system", "messages", "tools", "tool_choice", "max_tokens")
    canonical = {k: params[k] for k in cache_keys if k in params}
    return json.dumps(canonical, sort_keys=True, ensure_ascii=True)


class CacheManager:
    """LLM API response cache backed by Postgres."""

    def __init__(self, enabled: bool = True, conn=None):
        self.enabled = enabled
        self._conn = conn
        self._hits = 0
        self._misses = 0
        self._parse_failures = 0

    @property
    def conn(self):
        if self._conn is None or self._conn.closed:
            self._conn = get_db_connection()
        return self._conn

    @property
    def hits(self) -> int:
        return self._hits

    @property
    def misses(self) -> int:
        return self._misses

    def compute_hash(self, request_params: dict) -> str:
        """SHA-256 of canonical JSON (model, system, messages, tools, tool_choice, max_tokens)."""
        canonical = _canonical_json(request_params)
        return hashlib.sha256(canonical.encode()).hexdigest()

    def lookup(self, request_hash: str, allow_stale: bool = False) -> Optional[dict]:
        """Return cached response_body or None."""
        if not self.enabled:
            return None

        conn = self.conn
        if conn is None:
            return None

        try:
            stale_clause = "" if allow_stale else " AND (stale_after IS NULL OR stale_after > NOW())"
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT response_body FROM llm_api_cache WHERE request_hash = %s{stale_clause}",
                    (request_hash,),
                )
                row = cur.fetchone()
            if row:
                try:
                    result = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"  Cache parse error: {e}")
                    self._parse_failures += 1
                    self._misses += 1
                    return None
                self._hits += 1
                return result
            self._misses += 1
            return None
        except psycopg.Error as e:
            print(f"  Cache lookup error: {e}")
            self._misses += 1
            return None

    def store(
        self,
        request_hash: str,
        request_body: dict,
        response_body: dict,
        model: str,
        usage: dict | None = None,
        pipeline: str | None = None,
        tier: int | None = None,
        document_id: int | None = None,
        stale_after: datetime | None = None,
        prompt_hash: str | None = None,
    ) -> None:
        """Insert or update cache entry."""
        if not self.enabled:
            return

        conn = self.conn
        if conn is None:
            return

        usage = usage or {}
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_api_cache
                        (request_hash, model, request_body, response_body,
                         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                         pipeline, tier, document_id, stale_after, prompt_hash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (request_hash) DO UPDATE SET
                        response_body = EXCLUDED.response_body,
                        input_tokens = EXCLUDED.input_tokens,
                        output_tokens = EXCLUDED.output_tokens,
                        cache_read_tokens = EXCLUDED.cache_read_tokens,
                        cache_write_tokens = EXCLUDED.cache_write_tokens,
                        created_at = NOW()
                    """,
                    (
                        request_hash,
                        model,
                        json.dumps(request_body),
                        json.dumps(response_body),
                        usage.get("input_tokens"),
                        usage.get("output_tokens"),
                        usage.get("cache_read_tokens"),
                        usage.get("cache_write_tokens"),
                        pipeline,
                        tier,
                        document_id,
                        stale_after,
                        prompt_hash,
                    ),
                )
            conn.commit()
        except psycopg.Error as e:
            print(f"  Cache store error: {e}")
            try:
                conn.rollback()
            except psycopg.Error:
                self._conn = None

    def lookup_batch(self, hashes: list[str], allow_stale: bool = False) -> dict[str, dict]:
        """Bulk lookup for batch path efficiency. Returns {hash: response_body}."""
        if not self.enabled or not hashes:
            return {}

        conn = self.conn
        if conn is None:
            return {}

        try:
            stale_clause = "" if allow_stale else " AND (stale_after IS NULL OR stale_after > NOW())"
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT request_hash, response_body FROM llm_api_cache WHERE request_hash = ANY(%s){stale_clause}",
                    (hashes,),
                )
                rows = cur.fetchall()

            result = {}
            for row in rows:
                try:
                    body = row[1] if isinstance(row[1], dict) else json.loads(row[1])
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"  Cache batch parse error for {row[0][:12]}…: {e}")
                    self._parse_failures += 1
                    continue
                result[row[0]] = body

            self._hits += len(result)
            self._misses += len(hashes) - len(result)
            return result
        except psycopg.Error as e:
            print(f"  Cache batch lookup error: {e}")
            self._misses += len(hashes)
            return {}

    def store_batch(self, entries: list[dict]) -> None:
        """Bulk insert for batch path. Each entry: {request_hash, model, request_body, response_body, usage, ...}."""
        if not self.enabled or not entries:
            return

        conn = self.conn
        if conn is None:
            return

        try:
            params_seq = []
            for entry in entries:
                usage = entry.get("usage", {})
                params_seq.append((
                    entry["request_hash"],
                    entry["model"],
                    json.dumps(entry["request_body"]),
                    json.dumps(entry["response_body"]),
                    usage.get("input_tokens"),
                    usage.get("output_tokens"),
                    usage.get("cache_read_tokens"),
                    usage.get("cache_write_tokens"),
                    entry.get("pipeline"),
                    entry.get("tier"),
                    entry.get("document_id"),
                    entry.get("stale_after"),
                    entry.get("prompt_hash"),
                ))

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO llm_api_cache
                        (request_hash, model, request_body, response_body,
                         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                         pipeline, tier, document_id, stale_after, prompt_hash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (request_hash) DO UPDATE SET
                        response_body = EXCLUDED.response_body,
                        input_tokens = EXCLUDED.input_tokens,
                        output_tokens = EXCLUDED.output_tokens,
                        cache_read_tokens = EXCLUDED.cache_read_tokens,
                        cache_write_tokens = EXCLUDED.cache_write_tokens,
                        created_at = NOW()
                    """,
                    params_seq,
                )
            conn.commit()
        except psycopg.Error as e:
            print(f"  Cache batch store error: {e}")
            try:
                conn.rollback()
            except psycopg.Error:
                self._conn = None

    def summary(self) -> str:
        """Return a one-line summary of cache hits/misses."""
        total = self._hits + self._misses
        if total == 0:
            return "Cache: no lookups"
        rate = self._hits / total * 100
        parts = f"Cache: {self._hits} hits, {self._misses} misses"
        if self._parse_failures > 0:
            parts += f", {self._parse_failures} parse failures"
        parts += f" ({rate:.0f}% hit rate)"
        return parts

    def close(self) -> None:
        """Close the DB connection if we own it."""
        if self._conn and not self._conn.closed:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
