#!/usr/bin/env python3
"""Export the deproceduralizer Postgres database to flat JSONL files.

Designed to be run from inside the `deproceduralizer/` working copy (where
`.env.local` contains DATABASE_URL). The output is a self-contained
snapshot directory that can be copied into `deproceduralizer-backup/data/db_backup/`.

Usage:
    cd /path/to/deproceduralizer
    set -a && source .env.local && set +a
    python3 ../deproceduralizer-backup/scripts/export_db_to_flatfiles.py \
        --out-dir .db_backup_staging/$(date -u +%Y-%m-%dT%H-%M-%SZ)

Each non-excluded, non-sensitive public table becomes either:
  * <table>.jsonl.zip                    (small tables)
  * <table>/<table>.part-NNN.jsonl.zip   (chunked so every zip is <=90 MB)

Sensitive tables get `sensitive/<table>.schema.sql` plus an optional sanitized
sample. Excluded tables are recorded in manifest.json under `excluded`.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

EXCLUDED = {
    "llm_api_cache": "regeneratable; may contain raw prompts and responses",
}

SENSITIVE = {
    "share_tokens": {
        "drop_pii": [],
        "sample_limit": 0,
        "reason": "auth tokens; even used ones are credentials",
    },
    "bookmarks": {
        "drop_pii": ["created_by", "notes"],
        "sample_limit": 5,
        "reason": "user-created; created_by and notes redacted",
    },
    "document_notes": {
        "drop_pii": ["author_name", "content", "anchor_text"],
        "sample_limit": 5,
        "reason": "user-created; author/content/anchor_text redacted",
    },
    "eval_human_votes": {
        "drop_pii": ["reviewer_notes"],
        "sample_limit": 5,
        "reason": "reviewer-created; reviewer_notes redacted",
    },
    "prompt_feedback": {
        "drop_pii": ["author_name", "content", "highlighted_text"],
        "sample_limit": 5,
        "reason": "user feedback; author and content redacted",
    },
}

CHUNK_IF_BYTES_OVER = 200 * 1024 * 1024
DEFAULT_CHUNK_ROWS = 25_000
MIN_CHUNK_ROWS = 500
MAX_CHUNK_ROWS = 25_000
MAX_ZIP_BYTES = 90 * 1024 * 1024
HARD_LIMIT_BYTES = 94 * 1024 * 1024
# Conservative assumption for how much JSON deflate compresses (3x).
# Used only to pick the FIRST chunk size; subsequent chunks are sized
# adaptively from the measured bytes-per-row of the previous chunk.
ASSUMED_COMPRESSION_RATIO = 3.0
# Aim for first chunk to land around this fraction of MAX_ZIP_BYTES.
FIRST_CHUNK_SAFETY = 0.5


def estimate_initial_chunk_rows(total_bytes, row_count):
    """Estimate a safe initial chunk size from table averages.
    Clamped to [MIN_CHUNK_ROWS, MAX_CHUNK_ROWS].
    """
    if row_count <= 0:
        return DEFAULT_CHUNK_ROWS
    bytes_per_row = total_bytes / row_count
    est_compressed_per_row = bytes_per_row / ASSUMED_COMPRESSION_RATIO
    if est_compressed_per_row <= 0:
        return DEFAULT_CHUNK_ROWS
    target = int(MAX_ZIP_BYTES * FIRST_CHUNK_SAFETY / est_compressed_per_row)
    return max(MIN_CHUNK_ROWS, min(MAX_CHUNK_ROWS, target))


def psql_query(database_url, sql):
    result = subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
        check=True, capture_output=True, text=True,
    )
    return result.stdout


def dump_jsonl(database_url, sql, out_path):
    with open(out_path, "w") as f:
        subprocess.run(
            [
                "psql", database_url,
                "-v", "ON_ERROR_STOP=1",
                "--variable=FETCH_COUNT=1000",
                "-t", "-A", "-c", sql,
            ],
            check=True, stdout=f,
        )


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for blk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(blk)
    return h.hexdigest()


def zip_file(jsonl_path):
    zip_path = jsonl_path.with_suffix(jsonl_path.suffix + ".zip")
    subprocess.run(
        ["zip", "-9", "-j", "-q", str(zip_path), str(jsonl_path)],
        check=True,
    )
    jsonl_path.unlink()
    return zip_path


def list_tables(database_url):
    out = psql_query(
        database_url,
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;",
    )
    return [t for t in out.strip().splitlines() if t]


def table_info(database_url, table):
    out = psql_query(database_url, f"""
        SELECT
            pg_total_relation_size('public.{table}') AS bytes,
            COALESCE((
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a
                  ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = 'public.{table}'::regclass AND i.indisprimary
                LIMIT 1
            ), '') AS pk
    """)
    fields = out.strip().split("|")
    total_bytes = int(fields[0])
    pk = fields[1] if fields[1] else None
    exact = psql_query(database_url, f"SELECT count(*) FROM public.{table};").strip()
    return int(exact), total_bytes, pk


def column_types(database_url, table):
    out = psql_query(database_url, f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='{table}'
        ORDER BY ordinal_position;
    """)
    cols = []
    for line in out.strip().splitlines():
        if "|" in line:
            name, dtype = line.split("|", 1)
            cols.append((name, dtype))
    return cols


def write_schema_sql(database_url, out_dir):
    schema_path = out_dir / "schema.sql"
    with open(schema_path, "w") as f:
        subprocess.run(
            [
                "pg_dump", database_url,
                "--schema-only", "--no-owner", "--no-privileges",
                "--schema=public",
            ],
            check=True, stdout=f,
        )
    return schema_path


def dump_table_single(database_url, table, out_dir, limit):
    jsonl = out_dir / f"{table}.jsonl"
    suffix = f" LIMIT {int(limit)}" if limit is not None else ""
    sql = f"SELECT row_to_json(t) FROM (SELECT * FROM public.{table}{suffix}) t"
    dump_jsonl(database_url, sql, jsonl)
    line_count = sum(1 for _ in open(jsonl))
    z = zip_file(jsonl)
    size = z.stat().st_size
    if size > HARD_LIMIT_BYTES:
        raise RuntimeError(
            f"{table}: single-file zip is {size} bytes; exceeds {HARD_LIMIT_BYTES}. "
            "Add to CHUNK_IF_BYTES_OVER triggers or rerun."
        )
    return {
        "rows_written": line_count,
        "files": [{"name": z.name, "size": size, "sha256": sha256_of(z)}],
        "chunked": False,
    }


def dump_table_chunked(database_url, table, pk, out_dir, limit, row_count, total_bytes):
    if pk is None:
        raise RuntimeError(f"{table}: large table has no primary key; cannot chunk")
    table_dir = out_dir / table
    table_dir.mkdir(exist_ok=True)

    bounds = psql_query(
        database_url,
        f"SELECT COALESCE(min({pk}),0), COALESCE(max({pk}),0) FROM public.{table};",
    ).strip().split("|")
    min_id = int(bounds[0])

    chunk_rows = estimate_initial_chunk_rows(total_bytes, row_count)
    print(f"[{table}] initial chunk_rows estimate: {chunk_rows} "
          f"(avg {total_bytes/max(row_count,1):.0f} bytes/row uncompressed)",
          file=sys.stderr)
    files = []
    rows_written = 0
    cursor_id = min_id - 1
    chunk_idx = 0
    rows_budget = limit

    while True:
        if rows_budget is not None and rows_budget <= 0:
            break
        this_chunk = chunk_rows if rows_budget is None else min(chunk_rows, rows_budget)
        sql = (
            f"SELECT row_to_json(t) FROM "
            f"(SELECT * FROM public.{table} WHERE {pk} > {cursor_id} "
            f"ORDER BY {pk} ASC LIMIT {this_chunk}) t"
        )
        jsonl = table_dir / f"{table}.part-{chunk_idx:03d}.jsonl"
        dump_jsonl(database_url, sql, jsonl)
        n = sum(1 for _ in open(jsonl))
        if n == 0:
            jsonl.unlink()
            break
        z = zip_file(jsonl)
        size = z.stat().st_size
        if size > HARD_LIMIT_BYTES:
            # Retry without advancing the cursor: this chunk's rows are heavier
            # than the previous chunk projected. Halve the chunk size and redo.
            z.unlink()
            if this_chunk <= MIN_CHUNK_ROWS:
                raise RuntimeError(
                    f"{table} part-{chunk_idx:03d}: {size} bytes exceeds "
                    f"{HARD_LIMIT_BYTES} even at MIN_CHUNK_ROWS={MIN_CHUNK_ROWS}. "
                    "Manual intervention required."
                )
            new_chunk_rows = max(MIN_CHUNK_ROWS, this_chunk // 2)
            print(
                f"[{table}] chunk {chunk_idx} oversized at {size} bytes "
                f"({n} rows); halving {this_chunk} -> {new_chunk_rows} and retrying",
                file=sys.stderr,
            )
            chunk_rows = new_chunk_rows
            continue

        last_id_out = psql_query(
            database_url,
            f"SELECT max({pk}) FROM (SELECT {pk} FROM public.{table} "
            f"WHERE {pk} > {cursor_id} ORDER BY {pk} ASC LIMIT {this_chunk}) s;",
        ).strip()
        cursor_id = int(last_id_out)
        files.append({
            "name": f"{table}/{z.name}",
            "size": size,
            "sha256": sha256_of(z),
        })
        rows_written += n

        if size > 0 and n > 0:
            bytes_per_row = size / n
            # Conservative target: aim for 50% of MAX_ZIP_BYTES so 2x row-size
            # variance across the table is absorbed without triggering retries.
            target = int(MAX_ZIP_BYTES * 0.5 / bytes_per_row)
            chunk_rows = max(MIN_CHUNK_ROWS, min(MAX_CHUNK_ROWS, target))
        print(
            f"[{table}] chunk {chunk_idx}: {n} rows, {size} bytes; "
            f"cursor={cursor_id}; next chunk_rows={chunk_rows}",
            file=sys.stderr,
        )
        if rows_budget is not None:
            rows_budget -= n
        chunk_idx += 1

    return {"rows_written": rows_written, "files": files, "chunked": True}


def dump_sensitive(database_url, table, spec, out_dir):
    sens = out_dir / "sensitive"
    sens.mkdir(exist_ok=True)
    entry = {"reason": spec["reason"], "files": [], "redacted_columns": spec["drop_pii"]}

    schema_path = sens / f"{table}.schema.sql"
    with open(schema_path, "w") as f:
        subprocess.run(
            [
                "pg_dump", database_url,
                "--schema-only", "--no-owner", "--no-privileges",
                "-t", f"public.{table}",
            ],
            check=True, stdout=f,
        )
    entry["files"].append({
        "name": f"sensitive/{schema_path.name}",
        "size": schema_path.stat().st_size,
        "sha256": sha256_of(schema_path),
    })

    if spec["sample_limit"] <= 0:
        entry["sample_rows"] = 0
        return entry

    live_count = int(psql_query(database_url, f"SELECT count(*) FROM public.{table};").strip())
    if live_count == 0:
        entry["sample_rows"] = 0
        return entry

    cols = column_types(database_url, table)
    proj = []
    for name, dtype in cols:
        if name in spec["drop_pii"]:
            proj.append(f"NULL::{dtype} AS {name}")
        else:
            proj.append(name)
    select_list = ", ".join(proj)
    sample_limit = spec["sample_limit"]
    sql = (
        f"SELECT row_to_json(t) FROM "
        f"(SELECT {select_list} FROM public.{table} LIMIT {sample_limit}) t"
    )
    sample_path = sens / f"{table}.sample.jsonl"
    dump_jsonl(database_url, sql, sample_path)
    rows = sum(1 for _ in open(sample_path))
    z = zip_file(sample_path)
    entry["files"].append({
        "name": f"sensitive/{z.name}",
        "size": z.stat().st_size,
        "sha256": sha256_of(z),
    })
    entry["sample_rows"] = rows
    return entry


def write_readme(out_dir, manifest):
    started = manifest["started_at"]
    excluded = "\n".join(f"- `{k}` — {v}" for k, v in manifest["excluded"].items()) or "_(none)_"
    sensitive = "\n".join(
        f"- `{k}` — {v['reason']}" for k, v in manifest["sensitive"].items()
    ) or "_(none)_"
    body = f"""# Database snapshot — {started}

Point-in-time JSONL export of the `deproceduralizer` Neon Postgres database (`neondb`).

## Contents

- `schema.sql` — full `pg_dump --schema-only` of the `public` schema. Restore this first.
- `manifest.json` — machine-readable index: row counts, file sizes, sha256 hashes per file.
- `<table>.jsonl.zip` — one zip per normal table; each line of the inner `.jsonl` is one row encoded via `row_to_json(t)` (full jsonb fidelity, no CSV escaping).
- `<table>/<table>.part-NNN.jsonl.zip` — chunked tables (split so every zip is <90 MB, under GitHub's 100 MB hard limit). Concatenate parts in order to reconstruct.
- `sensitive/` — tables that contain user/PII data. Schema preserved; sample rows (where included) have PII columns nulled.

## Excluded tables

{excluded}

## Sensitive tables (partial dumps)

{sensitive}

## Restore

```bash
# 1. Recreate schema
psql "$DATABASE_URL" -f schema.sql

# 2. Restore one normal table
unzip -p agencies.jsonl.zip > /tmp/agencies.jsonl
python3 -c "
import json, sys, psycopg
conn = psycopg.connect('$DATABASE_URL'); cur = conn.cursor()
for line in open('/tmp/agencies.jsonl'):
    r = json.loads(line)
    cols = ','.join(r.keys())
    placeholders = ','.join(['%s']*len(r))
    cur.execute(f'INSERT INTO agencies ({{cols}}) VALUES ({{placeholders}})', list(r.values()))
conn.commit()
"

# 3. Restore a chunked table (e.g. regulatory_documents)
cd regulatory_documents
for z in *.zip; do unzip -p "$z"; done > /tmp/regulatory_documents.jsonl
# then import the same way
```

## Verification

Every file has a sha256 in `manifest.json`. Re-hash with:

```bash
sha256sum agencies.jsonl.zip
```
"""
    (out_dir / "README.md").write_text(body)


def load_database_url(env_file):
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    p = Path(env_file)
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"DATABASE_URL not in env and not found in {env_file}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--limit", type=int, default=None,
                    help="If set, dump only N rows per table (dry-run helper)")
    ap.add_argument("--env-file", default=".env.local")
    args = ap.parse_args()

    database_url = load_database_url(args.env_file)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    started_at = datetime.now(timezone.utc).isoformat()
    print(f"Starting export to {out_dir} at {started_at}", file=sys.stderr)

    write_schema_sql(database_url, out_dir)
    print("Wrote schema.sql", file=sys.stderr)

    manifest = {
        "started_at": started_at,
        "limit_per_table": args.limit,
        "database": "neondb (public schema)",
        "tables": {},
        "sensitive": {},
        "excluded": {k: v for k, v in EXCLUDED.items()},
    }

    for t in list_tables(database_url):
        if t in EXCLUDED:
            print(f"[{t}] excluded: {EXCLUDED[t]}", file=sys.stderr)
            continue
        if t in SENSITIVE:
            print(f"[{t}] sensitive (schema + sanitized sample)", file=sys.stderr)
            manifest["sensitive"][t] = dump_sensitive(database_url, t, SENSITIVE[t], out_dir)
            continue
        row_count, total_bytes, pk = table_info(database_url, t)
        print(f"[{t}] rows={row_count} bytes={total_bytes} pk={pk}", file=sys.stderr)
        if total_bytes > CHUNK_IF_BYTES_OVER and row_count > 0:
            entry = dump_table_chunked(
                database_url, t, pk, out_dir, args.limit, row_count, total_bytes,
            )
        else:
            entry = dump_table_single(database_url, t, out_dir, args.limit)
        entry["row_count_in_db"] = row_count
        entry["total_bytes_in_db"] = total_bytes
        manifest["tables"][t] = entry

    manifest["finished_at"] = datetime.now(timezone.utc).isoformat()
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    )
    write_readme(out_dir, manifest)
    print(f"Done. Manifest: {out_dir / 'manifest.json'}", file=sys.stderr)


if __name__ == "__main__":
    main()
