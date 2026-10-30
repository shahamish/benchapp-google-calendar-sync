# Claude Code Notes

## Clasp Deployment Workflow

```bash
clasp show-file-status   # preview which files will be pushed
clasp push --force
```

**Important:**
- Live settings are stored in the Apps Script project's **Script Properties** under
  `CONFIG_JSON`, not in any file. `src/config.js` is committed and only loads them.
- `clasp push --force` replaces every file in the Apps Script project with `src/`.
  Never push from a folder that has an old-style `src/config.js` with a hardcoded
  `const CONFIG = {...}`: it would collide with the loader.
- Verify after pushing: run `testConfig()` in the Apps Script editor.

## Cloud Sessions (Claude Code on the web)

`.claude/hooks/session-start.sh` runs at session start and prepares clasp from two
environment variables set in the cloud environment's settings:

| Variable | Contents |
|----------|----------|
| `CLASPRC_B64` | base64 of `~/.clasprc.json` (the Google login). Secret. |
| `CLASP_SCRIPT_ID` | The Apps Script project's script ID |

If `clasp push` says "No credentials found", one of these is missing or invalid; check
the hook's output. If the login expires, re-run `clasp login` on a computer and update
`CLASPRC_B64`.

## File Handling

| File | Pushed to Apps Script | Committed to Git |
|------|----------------------|------------------|
| `src/config.js` (loader only) | Yes | Yes |
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

Settings live in Script Properties, which `clasp push` never touches. If
`CONFIG_JSON` is deleted, re-create it from `examples/sample-config.js` (as JSON)
under Project Settings > Script Properties.

## Deployment Commands

```bash
# Push to Apps Script
clasp push --force

# Push to GitHub
git add . && git commit -m "message" && git push
```
