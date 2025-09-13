# Detailed Setup Guide

## Step 1: Find Your BenchApp Calendar URL

### Method 1: Mobile App
1. Open BenchApp on your phone
2. Go to your team's calendar
3. Tap the share or export icon
4. Look for "Subscribe to Calendar" or "Export Calendar"
5. Copy the URL (starts with `https://ics.benchapp.com/`)

### Method 2: Web Browser
1. Go to BenchApp website and log in
2. Navigate to your team calendar
3. Look for calendar export/subscribe options
4. Copy the ICS URL

## Step 2: Find Your Google Calendar ID

1. Open Google Calendar in web browser
2. Go to Settings (gear icon) → Settings
3. Select your family calendar from the left sidebar
4. Scroll down to "Calendar ID"
5. Copy the entire calendar ID (usually ends with @group.calendar.google.com)

## Step 3: Set Up Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Delete the default code
4. Copy and paste the code from `src/hockey-sync.js`
5. Update the CONFIG section with your calendar details
6. Save the project (Ctrl+S)

## Step 4: Test and Deploy

1. Run `setupSync()` function first
2. Check the execution log for errors
3. Verify events appear in your Google Calendar
4. Run `setupTriggers()` to enable automatic syncing

## Troubleshooting

### "Calendar not found" error
- Double-check your calendar ID
- Make sure the calendar is shared with your Google account

### "Cannot access hockey calendar URL" error
- Verify the BenchApp URL is correct
- Check if you're logged into BenchApp
- Try accessing the URL directly in a browser

### No events syncing
- Check if there are upcoming events in BenchApp
- Verify the date range settings (DAYS_LOOKBACK/DAYS_LOOKAHEAD)
- Look at the execution logs for detailed error messages
