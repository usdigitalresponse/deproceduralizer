#!/bin/bash
# SessionStart hook: Check for remote git changes
# Outputs context for Claude to ask user and auto-execute pull/merge

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Fetch silently
git fetch --quiet 2>/dev/null || exit 0

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
MAIN_BRANCH="main"

# Check current branch upstream status
BEHIND_CURRENT=0
if git rev-parse --verify "origin/$CURRENT_BRANCH" >/dev/null 2>&1; then
  BEHIND_CURRENT=$(git rev-list --count HEAD..origin/$CURRENT_BRANCH 2>/dev/null || echo 0)
fi

# Check main branch status (for potential merge)
BEHIND_MAIN=0
if [ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]; then
  if git rev-parse --verify "origin/$MAIN_BRANCH" >/dev/null 2>&1; then
    BEHIND_MAIN=$(git rev-list --count HEAD..origin/$MAIN_BRANCH 2>/dev/null || echo 0)
  fi
fi

# Build JSON output with context for Claude
if [ "$BEHIND_CURRENT" -gt 0 ] || [ "$BEHIND_MAIN" -gt 0 ]; then
  CONTEXT=""

  if [ "$BEHIND_CURRENT" -gt 0 ]; then
    CONTEXT="REMOTE CHANGES DETECTED: Your current branch '$CURRENT_BRANCH' is $BEHIND_CURRENT commit(s) behind origin/$CURRENT_BRANCH. Ask the user if they would like to pull (git pull). If they say yes, run: git pull"
  fi

  if [ "$BEHIND_MAIN" -gt 0 ] && [ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]; then
    if [ -n "$CONTEXT" ]; then
      CONTEXT="$CONTEXT | ALSO: "
    else
      CONTEXT="REMOTE CHANGES DETECTED: "
    fi
    CONTEXT="${CONTEXT}The main branch has $BEHIND_MAIN new commit(s) not in your branch. Ask the user if they would like to merge main into '$CURRENT_BRANCH'. If they say yes, run: git merge origin/$MAIN_BRANCH"
  fi

  # Output as JSON for SessionStart additionalContext
  cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$CONTEXT"
  }
}
EOF
fi

exit 0
