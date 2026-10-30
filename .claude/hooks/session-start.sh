#!/bin/bash
# Prepares a Claude Code cloud session to deploy with clasp.
#   - Installs clasp if missing
#   - Writes ~/.clasprc.json (Google login) from the CLASPRC_B64 environment variable
#   - Writes .clasp.json (which script to push to) from the CLASP_SCRIPT_ID environment variable
# Both variables are set in the cloud environment's settings, never committed.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if ! command -v clasp >/dev/null 2>&1; then
  echo "Installing clasp..."
  npm install -g @google/clasp >/dev/null 2>&1 || echo "WARNING: clasp install failed"
fi

if [ -n "${CLASPRC_B64:-}" ]; then
  umask 077
  if printf '%s' "$CLASPRC_B64" | base64 -d > "$HOME/.clasprc.json.tmp" 2>/dev/null \
     && node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$HOME/.clasprc.json.tmp"; then
    mv "$HOME/.clasprc.json.tmp" "$HOME/.clasprc.json"
    echo "clasp login written to ~/.clasprc.json"
  else
    rm -f "$HOME/.clasprc.json.tmp"
    echo "WARNING: CLASPRC_B64 is set but is not valid base64-encoded JSON; clasp is not logged in"
  fi
else
  echo "NOTE: CLASPRC_B64 not set; clasp is not logged in"
fi

if [ -n "${CLASP_SCRIPT_ID:-}" ]; then
  printf '{\n  "scriptId": "%s",\n  "rootDir": "./src"\n}\n' "$CLASP_SCRIPT_ID" > .clasp.json
  echo ".clasp.json written for script ${CLASP_SCRIPT_ID:0:6}..."
else
  echo "NOTE: CLASP_SCRIPT_ID not set; .clasp.json not written"
fi
