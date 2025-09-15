# 🏒 BenchApp to Google Calendar Sync

Automatically synchronize your BenchApp hockey schedule with Google Calendar using Google Apps Script. Perfect for busy hockey families who want all events in one place!

## ✨ Features

- **🔄 Automatic Syncing**: Runs every 6 hours to keep calendars in sync
- **📅 Full CRUD Support**: Adds new events, updates changes, removes canceled games
- **🚫 No Duplicates**: Smart tracking prevents duplicate events
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

3. **Configure & Run**
   ```javascript
   const CONFIG = {
     FAMILY_CALENDAR_ID: 'your-calendar@gmail.com',
     HOCKEY_CALENDAR_URL: 'https://ics.benchapp.com/your-url',
     EVENT_PREFIX: '[Hockey] ',
     // ... other settings
   };
   ```

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
| New game added | ➕ Event created with `[Hockey]` prefix |
| Time changed | 📝 Existing event updated |
| Game canceled | 🗑️ Event removed from calendar |
| Location updated | 📍 Location synced automatically |

## ⚙️ Configuration Options

```javascript
const CONFIG = {
  FAMILY_CALENDAR_ID: '',    // Target Google Calendar
  HOCKEY_CALENDAR_URL: '',   // BenchApp ICS URL
  EVENT_PREFIX: '[Hockey] ', // Prefix for hockey events
  DAYS_LOOKBACK: 7,         // How far back to sync
  DAYS_LOOKAHEAD: 90,       // How far forward to sync
};
```

## 🐛 Troubleshooting

### Events Being Updated Every Sync
**Fixed in v1.2:** Improved description handling to prevent false positive updates due to UID-only descriptions.

### Rate Limiting Issues  
The script includes 300ms delays between calendar operations to prevent Google's rate limits.

### Location Addresses Not Clickable
**Fixed in v1.2.1:** Location fields now properly unescape ICS formatting characters (\\n, \\,) so addresses display correctly and link to Google Maps.

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

### Ideas for Enhancement
- Support for multiple teams/calendars
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
