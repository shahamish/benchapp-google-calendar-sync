# Troubleshooting Guide

## Common Issues

### Events Being Recreated Every Sync
**Fixed in v1.2:** Stable UID generation and improved description handling.

### Location Addresses Not Clickable  
**Fixed in v1.2.1:** Proper unescaping of ICS formatting characters.

### All Events Deleted After Server Error
**Fixed in v1.3.1:** Added comprehensive error handling for server timeouts.

## Error Messages

### "Request failed... returned code 504"
**Cause:** BenchApp's servers are temporarily unavailable
**Solution:** Script now safely aborts sync. Events will remain unchanged until BenchApp is available again.

### "CONFIG is not defined"
**Cause:** Configuration file not properly loaded
**Solution:** Ensure you have both `Code.gs` and `config.gs` files in Google Apps Script

### "Family calendar not found"
**Cause:** Incorrect calendar ID or permissions
**Solution:** Verify calendar ID and ensure the calendar is shared with your Google account

## Testing Functions
```javascript
// Test configuration loading
function testConfig() {
  console.log('CONFIG test:', CONFIG.FAMILY_CALENDAR_ID ? 'Loaded' : 'Missing');
}

// Test BenchApp connectivity
function testBenchAppConnection() {
  try {
    const response = UrlFetchApp.fetch(CONFIG.HOCKEY_CALENDAR_URL);
    console.log('BenchApp status:', response.getResponseCode());
  } catch (error) {
    console.log('BenchApp error:', error.toString());
  }
}

// Check trigger status
function checkTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  console.log('Active triggers:', triggers.length);
}

Recovery Procedures
Recovering Deleted Events

Check Google Calendar's trash/deleted items
Look for backup calendar exports
Re-run sync when BenchApp is available again

Resetting Triggers
If triggers stop working:

Run setupTriggers() to recreate them
Check the Triggers page in Apps Script for proper configuration
Verify execution history for error patterns
