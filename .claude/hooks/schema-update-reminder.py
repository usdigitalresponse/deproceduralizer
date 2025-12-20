#!/usr/bin/env python3
"""
PostToolUse hook: Require database.md update when schema.sql changes
Blocks Claude until the database skill file is updated
"""
import json
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})
file_path = tool_input.get("file_path", "")

# Only trigger for schema.sql writes
if tool_name not in ("Write", "Edit") or not file_path.endswith("schema.sql"):
    sys.exit(0)

# Block and require database.md update
output = {
    "decision": "block",
    "reason": "You just modified schema.sql. Per project instructions, you MUST now update .claude/skills/database.md to reflect the schema changes. Read the updated schema.sql and update database.md accordingly before continuing with other tasks."
}
print(json.dumps(output))
sys.exit(0)
