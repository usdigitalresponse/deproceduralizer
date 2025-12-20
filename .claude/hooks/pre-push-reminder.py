#!/usr/bin/env python3
"""
PreToolUse hook: Ask about smoke tests before git push
Returns permission dialog for user to approve or deny the push
"""
import json
import sys

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})
command = tool_input.get("command", "")

# Only trigger for git push commands
if tool_name != "Bash" or "git push" not in command:
    sys.exit(0)

# Ask user before pushing - they can approve to push, or deny to run tests
output = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": "Before pushing: Would you like to run smoke tests first? (Deny to run tests, Approve to push without tests). Test command: cd frontend/apps/web && pnpm test:e2e"
    }
}
print(json.dumps(output))
sys.exit(0)
