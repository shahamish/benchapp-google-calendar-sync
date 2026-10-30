# 🏒 BenchApp to Google Calendar Sync

Automatically synchronize your BenchApp hockey schedule with Google Calendar using Google Apps Script. Perfect for busy hockey families who want all events in one place!

## ✨ Features

- **🔄 Automatic Syncing**: Runs every 6 hours to keep calendars in sync
- **📅 Full CRUD Support**: Adds new events, updates changes, removes canceled games
- **🚫 No Duplicates**: Smart tracking prevents duplicate events
- **👨‍👩‍👧‍👦 Multiple Teams**: Sync several BenchApp teams into one calendar, each with its own prefix
- **⚙️ Configurable**: Customize event prefixes, sync frequency, and date ranges
- **🔍 Detailed Logging**: Clear logs for monitoring and troubleshooting
- **🧪 Test Mode**: Complete test suite for safe deployment

## 🚀 Quick Start

### Prerequisites
- Google account with access to Google Calendar
- BenchApp account with team calendar access
- 10 minutes for setup

### Installation

1. **Get Your BenchApp Calendar URL**
   - Open BenchApp mobile app or website
   - Go to your team calendar
   - Look for "Export" or "Subscribe" option
   - Copy the calendar URL (looks like: `https://ics.benchapp.com/...`)

2. **Set Up Google Apps Script**
   - Go to [script.google.com](https://script.google.com)
   - Create new project
   - Copy the code from `src/hockey-sync.js`
   - Update the configuration with your calendar details

3. **Configure Your Settings**
   - Settings are stored in the script's **Script Properties**, not in a file.
   - In the Apps Script editor go to Project Settings (gear icon) > Script Properties,
     and add a property named `CONFIG_JSON`. Its value is your settings as JSON, in the
     same shape as `examples/sample-config.js`:
```json
   {
     "FAMILY_CALENDAR_ID": "your-actual-calendar@gmail.com",
     "HOCKEY_TEAMS": [
       { "name": "Bodhi", "calendarUrl": "https://ics.benchapp.com/first-url",  "eventPrefix": "[Hockey - Bodhi] " },
       { "name": "Milo",  "calendarUrl": "https://ics.benchapp.com/second-url", "eventPrefix": "[Hockey - Milo] " }
     ],
     "DAYS_LOOKBACK": 7,
     "DAYS_LOOKAHEAD": 90
   }
   ```
   - `src/config.js` loads this property. Run `showConfig()` to print what is stored.

4. **Initialize**
   ```javascript
   setupSync();     // One-time setup
   setupTriggers(); // Enable automatic syncing
   ```

## 📖 Documentation

- [📋 Detailed Setup Guide](docs/setup-guide.md)
- [🔧 Troubleshooting](docs/troubleshooting.md)

## 🏒 Why This Exists

Hockey families know the struggle:
- ✅ Game schedules in BenchApp
- ✅ Family events in Google Calendar  
- ❌ Constantly copying events between calendars
- ❌ Missing games because they weren't in the family calendar

This script solves that by automatically keeping everything in sync!

## 🔧 How It Works

1. **Fetches** hockey schedule from BenchApp's ICS feed
2. **Compares** with existing events in your Google Calendar
3. **Syncs** changes (new events, updates, deletions)
4. **Repeats** automatically every 6 hours

## 🎯 Perfect For

- Hockey parents managing family schedules
- Players who want all events in one calendar
- Teams wanting to share schedules with families
- Anyone using BenchApp + Google Calendar

## 📊 What Gets Synced

| BenchApp Event | Google Calendar Result |
|----------------|------------------------|
| New game added | ➕ Event created with the team's prefix (e.g. `[Hockey - Bodhi]`) |
| Time changed | 📝 Existing event updated |
| Game canceled | 🗑️ Event removed from calendar |
| Location updated | 📍 Location synced automatically |

## ⚙️ Configuration Options

```javascript
const CONFIG = {
  FAMILY_CALENDAR_ID: '',    // Target Google Calendar
  HOCKEY_TEAMS: [            // One entry per BenchApp team
    {
      name: 'Bodhi',                         // Label used in logs
      calendarUrl: '',                       // BenchApp ICS URL
      eventPrefix: '[Hockey - Bodhi] ',      // Prefix for this team's events (unique per team)
      legacyPrefixes: ['[Hockey] ']          // Optional: old prefixes to retitle in place
    },
    {
      name: 'Milo',
      calendarUrl: '',
      eventPrefix: '[Hockey - Milo] '
    }
  ],
  DAYS_LOOKBACK: 7,         // How far back to sync
  DAYS_LOOKAHEAD: 90,       // How far forward to sync
};
```

Single-team configs using `HOCKEY_CALENDAR_URL` + `EVENT_PREFIX` still work and are
treated as one team.

### Renaming a prefix or adding a team

Events are matched to a team by their title prefix. If you rename a team's
`eventPrefix`, list the old value in that team's `legacyPrefixes` so the next sync
retitles the existing events in place instead of creating duplicates and leaving the
old ones behind. Prefixes must not be a prefix of one another (for example
`[Hockey] ` and `[Hockey] Milo ` would collide and the script refuses to run).

## 📁 File Structure

```
src/
├── hockey-sync.js    # Hockey sync logic (multi-team)
├── f1-sync.js        # F1 race calendar sync
├── baseball-sync.js  # Baseball league sync
└── config.js         # Loads settings from Script Properties (CONFIG_JSON)
```

**For Google Apps Script:**
- Push `src/` with `clasp push --force`, or copy each file into the editor
- Keep your real calendar IDs in Script Properties only

## 🐛 Troubleshooting

### Events Being Updated Every Sync
**Fixed in v1.2:** Improved description handling to prevent false positive updates due to UID-only descriptions.

### Rate Limiting Issues  
The script includes 300ms delays between calendar operations to prevent Google's rate limits.

### Location Addresses Not Clickable
**Fixed in v1.2.1:** Location fields now properly unescape ICS formatting characters (\\n, \\,) so addresses display correctly and link to Google Maps.

### Script Deletes All Events When Source is Down
**Critical Fix in v1.3.1:** Added error handling to prevent data loss when BenchApp servers are unavailable. The script now fails safely rather than deleting events when it cannot fetch data.

**Symptoms:** Script removes all hockey events after a 504 or other HTTP error
**Solution:** Updated error handling prevents sync when source data is unavailable

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

### Ideas for Enhancement
- Slack/Discord notifications for schedule changes
- Integration with other sports apps
- Custom event formatting options

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## ⭐ Support

If this saved you time, please star the repository! 

Found a bug? [Open an issue](../../issues)

---

**Made with ❤️ by a hockey parent tired of copying calendar events manually**

## 🙏 Credits

Created by [shahamish](https://github.com/shahamish) with assistance from Claude AI.
