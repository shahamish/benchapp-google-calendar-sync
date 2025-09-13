/**
 * Hockey Calendar Sync Script
 * Automatically syncs events from BenchApp calendar to Google Calendar
 * 
 * Setup Instructions:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create a new project and paste this code
 * 3. Update the configuration variables below
 * 4. Save and run setupSync() once to initialize
 * 5. Set up time-based triggers for automatic syncing
 */

// ============ CONFIGURATION - UPDATE THESE VALUES ============
const CONFIG = {
  // Your family calendar ID (found in Google Calendar settings)
  FAMILY_CALENDAR_ID: 'your-family-calendar@gmail.com', // Replace with your family calendar ID
  
  // BenchApp calendar URL (from BenchApp export/subscribe feature)
  HOCKEY_CALENDAR_URL: 'https://ics.benchapp.com/your-encoded-url', // Replace with actual BenchApp URL
  
  // Prefix for hockey events (helps identify them later)
  EVENT_PREFIX: '[Hockey] ',
  
  // Days to look ahead/behind for events
  DAYS_LOOKBACK: 7,
  DAYS_LOOKAHEAD: 90
};

// ============ MAIN SYNC FUNCTION ============
/**
 * Main synchronization function - call this to sync calendars
 */
function syncHockeyCalendar() {
  try {
    console.log('Starting hockey calendar sync...');
    
    // Get the family calendar
    const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
    if (!familyCalendar) {
      throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
    }
    
    // Fetch hockey calendar data
    const hockeyEvents = fetchHockeyEvents();
    console.log(`Found ${hockeyEvents.length} hockey events`);
    
    // Get existing hockey events from family calendar
    const existingEvents = getExistingHockeyEvents(familyCalendar);
    console.log(`Found ${existingEvents.length} existing hockey events in family calendar`);
    
    // Process events
    const results = processEvents(familyCalendar, hockeyEvents, existingEvents);
    
    console.log('Sync completed:');
    console.log(`- Added: ${results.added}`);
    console.log(`- Updated: ${results.updated}`);
    console.log(`- Removed: ${results.removed}`);
    
    // Store last sync time
    PropertiesService.getScriptProperties().setProperty('lastSyncTime', new Date().toISOString());
    
  } catch (error) {
    console.error('Sync failed:', error);
    // Optionally send email notification
    // MailApp.sendEmail('your-email@gmail.com', 'Hockey Calendar Sync Failed', error.toString());
  }
}

// ============ SETUP FUNCTIONS ============
/**
 * One-time setup function - run this first
 */
function setupSync() {
  console.log('Setting up hockey calendar sync...');
  
  // Verify calendar access
  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  if (!familyCalendar) {
    throw new Error('Cannot access family calendar. Please check the calendar ID and permissions.');
  }
  
  // Test hockey calendar URL
  try {
    UrlFetchApp.fetch(CONFIG.HOCKEY_CALENDAR_URL);
    console.log('Hockey calendar URL is accessible');
  } catch (error) {
    throw new Error('Cannot access hockey calendar URL: ' + error.toString());
  }
  
  // Run initial sync
  syncHockeyCalendar();
  
  console.log('Setup completed successfully!');
}

/**
 * Sets up automatic triggers
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncHockeyCalendar') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger - runs every 6 hours
  ScriptApp.newTrigger('syncHockeyCalendar')
    .timeBased()
    .everyHours(6)
    .create();
  
  console.log('Automatic sync trigger created (runs every 6 hours)');
}

// Add more functions here as needed...
// (This is a condensed version - full script available in repository)
