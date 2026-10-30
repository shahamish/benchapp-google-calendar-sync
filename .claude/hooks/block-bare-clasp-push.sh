#!/bin/bash
# PreToolUse hook: blocks a bare `clasp push` in Claude Code sessions.
# A bare push mirrors src/ exactly and deletes the live config.gs whenever
# src/config.js is absent (every cloud session). Deploy with scripts/deploy.sh,
# which pulls the live config first. The script's own internal push is not
# affected, because this hook only sees the command Claude runs.
set -euo pipefail

COMMAND="$(node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  try { process.stdout.write(((JSON.parse(s).tool_input || {}).command) || ""); }
  catch (e) { process.stdout.write(""); }
});')"

if printf '%s' "$COMMAND" | grep -Eq '(^|[^[:alnum:]_.-])clasp[[:space:]]+push([[:space:]]|$)'; then
  echo "Blocked: never run 'clasp push' directly; it can delete the live config.gs. Deploy with scripts/deploy.sh (use --dry-run to preview)." >&2
  exit 2
fi
exit 0
