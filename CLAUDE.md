# Claude Code Notes

## Clasp Deployment Workflow

**Always deploy with the script, never with a bare `clasp push`:**

```bash
scripts/deploy.sh --dry-run   # preview: what changes, what would be deleted
scripts/deploy.sh             # pull live config.gs, then push src/
```

**Important:**
- Live settings live in `config.gs` inside the Apps Script project and are edited in
  the Apps Script editor. It is never committed, because this repo is public.
- `clasp push --force` makes Apps Script an exact copy of `src/`. A bare push from a
  checkout without `src/config.js` (every cloud session) deletes the live settings.
  `scripts/deploy.sh` pulls the live `config.gs` into `src/config.js` (gitignored)
  first, and aborts if the pull fails or the config is missing.
- The script also aborts if Apps Script holds files not in `src/` (a push would
  delete them). Add them to the repo, delete them in the editor, or pass
  `--allow-delete`.
- Verify after deploying: run `testConfig()` in the Apps Script editor.

## Cloud Sessions (Claude Code on the web)

`.claude/hooks/session-start.sh` runs at session start and prepares clasp from two
environment variables set in the cloud environment's settings:

| Variable | Contents |
|----------|----------|
| `CLASPRC_B64` | base64 of `~/.clasprc.json` (the Google login). Secret. |
| `CLASP_SCRIPT_ID` | The Apps Script project's script ID |

If clasp says "No credentials found", one of these is missing or invalid; check
the hook's output. If the login expires, re-run `clasp login` on a computer and update
`CLASPRC_B64`.

## File Handling

| File | Pushed to Apps Script | Committed to Git |
|------|----------------------|------------------|
| `src/config.js` (live `config.gs`, pulled by deploy script) | Yes | No (gitignored) |
| `src/hockey-sync.js` | Yes | Yes |
| `src/f1-sync.js` | Yes | Yes |
| `src/baseball-sync.js` | Yes | Yes |
| `src/appsscript.json` | Yes | Yes |
| `.clasp.json` | No | No (gitignored) |

## Hockey Config Shape

`src/hockey-sync.js` reads `CONFIG.HOCKEY_TEAMS`, an array of
`{ name, calendarUrl, eventPrefix, legacyPrefixes }`. Each team syncs independently
under its own prefix; `legacyPrefixes` lets a prefix rename retitle existing events
in place. The old single-team keys (`HOCKEY_CALENDAR_URL` + `EVENT_PREFIX`) still
work as a fallback. See `examples/sample-config.js`.

## If Config Gets Lost

If `config.gs` is deleted from Apps Script, `scripts/deploy.sh` refuses to push.
Re-create it in the editor from `examples/sample-config.js` with real values.
Apps Script's Project History may also have the previous version.

## Deployment Commands

```bash
# Push to Apps Script
scripts/deploy.sh

# Push to GitHub
git add . && git commit -m "message" && git push
```
