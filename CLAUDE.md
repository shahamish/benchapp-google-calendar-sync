# Claude Code Notes

## Clasp Deployment Workflow

When pushing changes to Google Apps Script:

```bash
clasp push --force
```

**Important:**
- `config.js` contains real calendar credentials and MUST be pushed to Apps Script
- `config.js` is gitignored - it will NOT be committed to GitHub
- Always ensure local `src/config.js` exists with real credentials before pushing
- If config.js gets deleted from Apps Script, pull it first: `clasp pull`

## File Handling

| File | Pushed to Apps Script | Committed to Git |
|------|----------------------|------------------|
| `src/config.js` | Yes | No (gitignored) |
| `src/hockey-sync.js` | Yes | Yes |
| `src/f1-sync.js` | Yes | Yes |
| `src/baseball-sync.js` | Yes | Yes |
| `src/appsscript.json` | Yes | Yes |

## If Config Gets Lost

1. User must restore credentials in Apps Script UI, or
2. Pull from Apps Script: `clasp pull`
3. Rename if needed: `mv src/config.gs.js src/config.js`

## Deployment Commands

```bash
# Push to Apps Script
clasp push --force

# Push to GitHub
git add . && git commit -m "message" && git push origin main

# Both
clasp push --force && git add . && git commit -m "message" && git push origin main
```
