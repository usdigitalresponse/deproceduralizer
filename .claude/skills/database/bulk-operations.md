# Bulk Database Operations

Best practices for writing data to the Neon PostgreSQL database efficiently.

## Key Principle: Remote Database = Network Latency

This is a **remote Neon PostgreSQL database**, not local. Every query has network latency (~50-100ms). For bulk operations:

- **Bad**: 50,000 individual INSERTs = 50,000 round trips = ~1+ hour
- **Good**: Batch commits every 1,000 rows = 50 round trips = ~5 seconds
- **Best**: Multi-value INSERT or COPY = 1 round trip = <1 second

## Python Patterns

### Connection Setup

```python
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / '.env')
from shared_utils import get_db_connection

conn = get_db_connection()
```

### Pattern 1: Collect Then Batch Insert

Best for upserts with conflict handling:

```python
# 1. Collect all rows in memory (fast)
rows_to_insert = []
for item in items:
    rows_to_insert.append((col1, col2, col3))

# 2. Batch insert with periodic commits
batch_size = 1000
upsert_sql = """
    INSERT INTO my_table (col1, col2, col3)
    VALUES (%s, %s, %s)
    ON CONFLICT (col1) DO UPDATE SET
        col2 = EXCLUDED.col2,
        col3 = EXCLUDED.col3
"""

for i in range(0, len(rows_to_insert), batch_size):
    batch = rows_to_insert[i:i + batch_size]
    for row in batch:
        conn.execute(upsert_sql, row)
    conn.commit()  # Commit each batch
    print(f"Inserted {min(i + batch_size, len(rows_to_insert)):,}/{len(rows_to_insert):,}")
```

### Pattern 2: Bulk UPDATE with JOIN

When updating many rows based on computed values:

```python
# Bad: 50,000 individual UPDATEs
for id, new_value in updates:
    conn.execute("UPDATE t SET col = %s WHERE id = %s", (new_value, id))

# Good: Single UPDATE with JOIN
conn.execute("""
    UPDATE child_table c
    SET parent_id = p.id
    FROM parent_table p
    WHERE c.parent_key = p.key
      AND c.parent_id IS NULL
""")
conn.commit()
```

### Pattern 3: Multi-Value INSERT

For simple inserts without conflicts:

```python
# Build multi-value INSERT
values = []
params = []
for i, (a, b, c) in enumerate(rows):
    values.append(f"(${i*3+1}, ${i*3+2}, ${i*3+3})")
    params.extend([a, b, c])

sql = f"INSERT INTO my_table (col_a, col_b, col_c) VALUES {', '.join(values)}"
conn.execute(sql, params)
conn.commit()
```

### Pattern 4: COPY for Maximum Speed

For very large imports (100k+ rows):

```python
import io
import csv

# Create CSV in memory
buffer = io.StringIO()
writer = csv.writer(buffer)
for row in rows:
    writer.writerow(row)
buffer.seek(0)

# Use COPY
with conn.connection.cursor() as cur:
    cur.copy_expert(
        "COPY my_table (col1, col2, col3) FROM STDIN WITH CSV",
        buffer
    )
conn.commit()
```

## Progress Reporting

Always show progress for long operations:

```python
import time

start_time = time.time()
total = len(items)

for i, item in enumerate(items):
    # ... process item ...

    if (i + 1) % 1000 == 0:
        elapsed = time.time() - start_time
        rate = (i + 1) / elapsed
        eta = (total - i - 1) / rate
        print(f"Processed {i+1:,}/{total:,} ({rate:.0f}/sec, ETA: {eta:.0f}s)")
```

## Upsert Patterns

### Preserve Existing Data

Don't overwrite reviewed/edited rows:

```sql
INSERT INTO my_table (id, data, reviewed_at)
VALUES (%s, %s, %s)
ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data
WHERE my_table.reviewed_at IS NULL  -- Only update if not reviewed
```

### Track What Changed

```sql
INSERT INTO my_table (id, data)
VALUES (%s, %s)
ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data
WHERE my_table.data IS DISTINCT FROM EXCLUDED.data  -- Only if different
RETURNING id, (xmax = 0) as was_inserted
```

## Common Mistakes

1. **Committing every row** - Commit in batches of 500-1000
2. **Loading all data into Python** - Stream large result sets with `fetchmany()`
3. **Not using indexes** - Ensure WHERE clauses hit indexes
4. **Individual SELECTs in loops** - Load lookup data once into a dict
5. **No progress reporting** - Always show progress for operations >10s

## Performance Benchmarks (Neon)

| Operation | Time (10k rows) |
|-----------|-----------------|
| Individual INSERTs, commit each | ~15 minutes |
| Individual INSERTs, batch commit (1000) | ~30 seconds |
| Multi-value INSERT (500 per statement) | ~5 seconds |
| COPY | ~1 second |
