# Deployment Guide: GitHub to Google Apps Script

This guide covers the complete workflow for syncing code between this GitHub repository and Google Apps Script using `clasp`.

## Prerequisites

- Node.js installed (v12 or higher)
- A Google account with access to the Apps Script project
- Git installed

## One-Time Setup

### 1. Install clasp globally

```bash
npm install -g @google/clasp
```

### 2. Login to Google

```bash
clasp login
```

This opens a browser window to authenticate with your Google account. Grant the requested permissions.

### 3. Get your Apps Script ID

1. Open your Google Apps Script project in the browser
2. Look at the URL: `https://script.google.com/home/projects/YOUR_SCRIPT_ID_HERE/edit`
3. Copy the script ID (the long string between `/projects/` and `/edit`)

### 4. Create your local .clasp.json

```bash
cd /path/to/benchapp-google-calendar-sync
cp .clasp.json.example .clasp.json
```

Edit `.clasp.json` and replace `YOUR_SCRIPT_ID_HERE` with your actual script ID:

```json
{
  "scriptId": "1ABC123xyz...",
  "rootDir": "./src"
}
```

Note: `.clasp.json` is gitignored to keep your script ID private.

### 5. Verify connection

```bash
clasp pull
```

This should download the current Apps Script files. If it works, your setup is complete.

## Daily Workflow

### Pulling changes from Apps Script (if you edited in browser)

```bash
clasp pull
```

### Pushing local changes to Apps Script

```bash
clasp push
```

### Opening the Apps Script editor

```bash
clasp open
```

## Complete Deployment: GitHub + Apps Script

### Step 1: Review your local changes

```bash
git status
git diff
```

### Step 2: Commit to GitHub

```bash
git add .
git commit -m "Fix duplicate event issue and add cleanup utilities"
git push origin main
```

### Step 3: Push to Google Apps Script

```bash
clasp push
```

### Step 4: Verify in Apps Script

```bash
clasp open
```

Check that the code looks correct in the browser editor.

## Running Functions in Apps Script

### From the Apps Script Editor UI

1. Open the script: `clasp open`
2. Select a function from the dropdown menu (top toolbar)
3. Click "Run"

**Available convenience functions (no parameters needed):**

| Function | Description |
|----------|-------------|
| `reviewDuplicates_Last3Days` | Review duplicates from last 3 days |
| `reviewDuplicates_Last7Days` | Review duplicates from last 7 days |
| `reviewDuplicates_Last14Days` | Review duplicates from last 14 days |
| `reviewDuplicates_Last30Days` | Review duplicates from last 30 days |
| `cleanupDuplicates_Last3Days` | Cleanup duplicates from last 3 days |
| `cleanupDuplicates_Last7Days` | Cleanup duplicates from last 7 days |
| `cleanupDuplicates_Last14Days` | Cleanup duplicates from last 14 days |
| `cleanupDuplicates_Last30Days` | Cleanup duplicates from last 30 days |
| `reviewDuplicateEvents` | Review ALL duplicates (Aug 1 to present) |
| `cleanupDuplicateEvents` | Cleanup ALL duplicates (Aug 1 to present) |

### Using the Script Editor Console (with parameters)

For custom date ranges, use the Apps Script editor's execution log:

1. Open Apps Script editor
2. At the bottom, find the "Execution log" panel
3. You can also use `console.log()` output there

To run with custom parameters, create a temporary test function:

```javascript
function testCustomRange() {
  // Custom date range: December 1-15, 2025
  const start = new Date(2025, 11, 1);  // Month is 0-indexed
  const end = new Date(2025, 11, 15);
  return reviewDuplicatesInRange(start, end);
}
```

### Using clasp run (command line)

You can also run functions from the command line:

```bash
# First, enable the Apps Script API at:
# https://script.google.com/home/usersettings

clasp run reviewDuplicates_Last3Days
clasp run cleanupDuplicates_Last7Days
```

Note: `clasp run` requires additional setup (Apps Script API enabled, OAuth configured).

## Recommended Cleanup Workflow

### Before cleanup: Disable notifications

1. Go to Google Calendar
2. Settings (gear icon) → Settings for your calendar
3. Remove or disable "Event notifications" temporarily
4. Also disable "All-day event notifications" if present

### Test on small subset first

1. Run `reviewDuplicates_Last3Days` to see what would be deleted
2. Check the execution log for results
3. If it looks right, run `cleanupDuplicates_Last3Days`
4. Verify in your calendar that duplicates were removed and no notifications sent

### Full cleanup

Once you've verified notifications are suppressed:

1. Run `reviewDuplicateEvents` to see the full scope
2. Run `cleanupDuplicateEvents` to clean up everything

### After cleanup: Re-enable notifications

Don't forget to turn your calendar notifications back on!

## Troubleshooting

### "Script not found" error

- Verify your script ID in `.clasp.json`
- Make sure you're logged in: `clasp login --status`

### "Permission denied" error

- Re-authenticate: `clasp login --creds`
- Check that the Google account has edit access to the script

### Changes not appearing in Apps Script

- Make sure you ran `clasp push` (not just git push)
- Check that `rootDir` in `.clasp.json` points to `./src`

### Can't run functions via clasp

Enable the Apps Script API:
1. Go to https://script.google.com/home/usersettings
2. Turn on "Google Apps Script API"

## File Structure

```
benchapp-google-calendar-sync/
├── .clasp.json.example    # Template (copy to .clasp.json)
├── .clasp.json            # Your config (gitignored)
├── src/
│   ├── config.js          # Configuration template
│   └── hockey-sync.js     # Main script
└── docs/
    └── deployment-guide.md
```

In Google Apps Script, these appear as:
- `config.gs` (from config.js)
- `hockey-sync.gs` (from hockey-sync.js)
