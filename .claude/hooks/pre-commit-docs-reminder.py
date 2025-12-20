#!/usr/bin/env python3
"""
Pre-commit hook that prompts user about documentation updates.
Uses permission dialog to ask before git commit.
"""

import json
import sys

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Allow if we can't parse input

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    # Only process Bash commands
    if tool_name != "Bash":
        sys.exit(0)

    # Check if this is a git commit command
    if "git commit" not in command:
        sys.exit(0)

    # Use permission dialog to ask user about documentation
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": "Documentation check: Select 'No' to update docs first, 'Yes' to commit now"
        }
    }
    print(json.dumps(output))
    sys.exit(0)

if __name__ == "__main__":
    main()
