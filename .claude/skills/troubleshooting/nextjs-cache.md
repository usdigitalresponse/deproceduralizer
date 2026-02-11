# Next.js Cache Troubleshooting

## Symptoms

Runtime errors that don't match the code, such as:
- `SyntaxError: Unexpected non-whitespace character after JSON at position XXX`
- Stale module errors after merging branches
- Build passes but dev server fails with cryptic errors
- Tests fail with errors that don't reproduce manually

## Solution

Kill any running dev servers and clear all caches:

```bash
cd frontend/apps/web

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Clear Next.js, Turbopack, and node_modules cache
rm -rf .next .turbo node_modules/.cache
```

Then re-run your command (dev server, tests, etc.).

## When to Use

- After resolving merge conflicts
- After switching branches with significant changes
- When seeing JSON parsing errors at runtime
- When dev server behavior doesn't match the code
- After updating dependencies
