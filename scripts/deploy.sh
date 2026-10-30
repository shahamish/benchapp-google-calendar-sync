#!/bin/bash
# Deploys src/ to Google Apps Script without touching the live settings.
#
# The settings live in config.gs inside the Apps Script project (edited in the
# Apps Script editor) and are never committed, because this repo is public.
# `clasp push --force` makes Apps Script an exact copy of src/, so pushing from
# a checkout without config.js would delete the live settings. This script:
#   1. Pulls the current project from Apps Script into a temporary folder
#   2. Refuses to continue if the pull fails or config.js is missing
#   3. Refuses to continue if Apps Script has files that are not in src/
#      (they would be deleted), unless --allow-delete is given
#   4. Copies the live config.js into src/ (gitignored) and pushes
#
# Usage: scripts/deploy.sh [--dry-run] [--allow-delete]
set -euo pipefail

DRY_RUN=false
ALLOW_DELETE=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --allow-delete) ALLOW_DELETE=true ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

fail() { echo "ABORTED: $*" >&2; exit 1; }

command -v clasp >/dev/null 2>&1 || fail "clasp is not installed (npm install -g @google/clasp)"
[ -f .clasp.json ] || fail ".clasp.json not found. In cloud sessions it is written at startup from CLASP_SCRIPT_ID."

SCRIPT_ID="$(node -e 'console.log(require(process.argv[1]).scriptId || "")' "$REPO_DIR/.clasp.json")"
[ -n "$SCRIPT_ID" ] || fail ".clasp.json has no scriptId"

PULL_DIR="$(mktemp -d)"
trap 'rm -rf "$PULL_DIR"' EXIT

echo "1/4 Pulling the live project from Apps Script..."
printf '{"scriptId":"%s","rootDir":"."}\n' "$SCRIPT_ID" > "$PULL_DIR/.clasp.json"
if ! (cd "$PULL_DIR" && clasp pull >/dev/null 2>&1); then
  fail "clasp pull failed, so nothing was pushed. Check that clasp is logged in (clasp show-file-status)."
fi

echo "2/4 Checking the live settings file..."
LIVE_CONFIG="$PULL_DIR/config.js"
[ -s "$LIVE_CONFIG" ] || fail "Apps Script has no config file (config.gs). Nothing was pushed. Restore it in the Apps Script editor first."
grep -q "CONFIG" "$LIVE_CONFIG" || fail "The live config.gs does not define CONFIG. Nothing was pushed."

echo "3/4 Comparing the live project with src/..."
REMOTE_ONLY=()
for f in "$PULL_DIR"/*; do
  name="$(basename "$f")"
  [ "$name" = "config.js" ] && continue
  if [ ! -e "src/$name" ]; then
    REMOTE_ONLY+=("$name")
  elif ! cmp -s "$f" "src/$name"; then
    echo "   will update: $name"
  fi
done
for f in src/*; do
  name="$(basename "$f")"
  [ -e "$PULL_DIR/$name" ] || echo "   will add:    $name"
done
if [ "${#REMOTE_ONLY[@]}" -gt 0 ]; then
  echo "   only in Apps Script (a push deletes these): ${REMOTE_ONLY[*]}"
  if [ "$ALLOW_DELETE" != true ]; then
    fail "Apps Script has files that are not in src/. Add them to src/, delete them in the editor, or re-run with --allow-delete."
  fi
fi

if [ "$DRY_RUN" = true ]; then
  echo "4/4 Dry run: nothing was pushed."
  exit 0
fi

echo "4/4 Pushing src/ with the live config.gs preserved..."
cp "$LIVE_CONFIG" src/config.js
clasp push --force
echo "Deployed. Run testConfig() in the Apps Script editor to confirm."
