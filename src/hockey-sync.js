/**
 * Hockey Calendar Sync Script
 * Automatically syncs events from a hockey league calendar URL to your family calendar
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
  
  // Get your BenchApp URL from: BenchApp → Team Calendar → Export/Subscribe
  // URL format: https://ics.benchapp.com/[encoded-player-and-team-data]
  HOCKEY_CALENDAR_URL: 'https://ics.benchapp.com/your-encoded-url-here', // Replace with actual URL
  
  // Prefix for hockey events (helps identify them later)
  EVENT_PREFIX: '[Hockey] ',
  
  // Days to look ahead for events (prevents syncing very old events)
  DAYS_LOOKBACK: 7,
  DAYS_LOOKAHEAD: 180
};

// ============ TEST App URL ============
function testBenchAppURL() {
  try {
    const response = UrlFetchApp.fetch('https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTE0NzY4NjMsInRlYW1JZCI6WzEyODY5ODBdfQ');
    const icsData = response.getContentText();
    console.log('First 500 characters of ICS data:');
    console.log(icsData.substring(0, 500));
    console.log('✓ BenchApp URL is working!');
  } catch (error) {
    console.error('❌ Error fetching from BenchApp:', error);
  }
}


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

// ============ FETCH HOCKEY EVENTS ============
/**
 * Fetches and parses events from the hockey calendar URL
 */
function fetchHockeyEvents() {
  try {
    const response = UrlFetchApp.fetch(CONFIG.HOCKEY_CALENDAR_URL);
    const icsData = response.getContentText();
    return parseICSData(icsData);
  } catch (error) {
    console.error('Failed to fetch hockey calendar:', error);
    return [];
  }
}

/**
 * Basic ICS parser - extracts events from ICS format
 */
function parseICSData(icsData) {
  const events = [];
  const eventBlocks = icsData.split('BEGIN:VEVENT');
  
  for (let i = 1; i < eventBlocks.length; i++) {
    const eventBlock = eventBlocks[i].split('END:VEVENT')[0];
    const event = parseEventBlock(eventBlock);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Parses individual event block from ICS data
 */
function parseEventBlock(eventBlock) {
  const lines = eventBlock.split('\n').map(line => line.trim()).filter(line => line);
  const event = {};
  
  for (const line of lines) {
    if (line.startsWith('UID:')) {
      event.uid = line.substring(4);
    } else if (line.startsWith('SUMMARY:')) {
      event.title = line.substring(8);
    } else if (line.startsWith('DTSTART')) {
      event.startTime = parseICSDateTime(line);
    } else if (line.startsWith('DTEND')) {
      event.endTime = parseICSDateTime(line);
    } else if (line.startsWith('LOCATION:')) {
      event.location = line.substring(9);
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = line.substring(12);
    }
  }
  
  // Only return events with required fields
  if (event.uid && event.title && event.startTime) {
    return event;
  }
  return null;
}

/**
 * Parses ICS datetime format to JavaScript Date
 */
function parseICSDateTime(line) {
  const dateMatch = line.match(/(\d{8}T\d{6})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15));
    
    return new Date(year, month, day, hour, minute, second);
  }
  return null;
}

// ============ CALENDAR MANAGEMENT ============
/**
 * Gets existing hockey events from the family calendar
 */
function getExistingHockeyEvents(calendar) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (CONFIG.DAYS_LOOKBACK * 24 * 60 * 60 * 1000));
  const endDate = new Date(now.getTime() + (CONFIG.DAYS_LOOKAHEAD * 24 * 60 * 60 * 1000));
  
  const events = calendar.getEvents(startDate, endDate);
  return events.filter(event => 
    event.getTitle().startsWith(CONFIG.EVENT_PREFIX) &&
    event.getDescription().includes('Hockey-UID:')
  );
}

/**
 * Processes events - adds new, updates existing, removes deleted
 */
function processEvents(familyCalendar, hockeyEvents, existingEvents) {
  const results = { added: 0, updated: 0, removed: 0 };
  
  // Create maps for easier comparison
  const hockeyEventMap = new Map();
  hockeyEvents.forEach(event => hockeyEventMap.set(event.uid, event));
  
  const existingEventMap = new Map();
  existingEvents.forEach(event => {
    const uid = extractUIDFromDescription(event.getDescription());
    if (uid) {
      existingEventMap.set(uid, event);
    }
  });
  
  // Add or update hockey events
  hockeyEvents.forEach(hockeyEvent => {
    const existingEvent = existingEventMap.get(hockeyEvent.uid);
    
    if (existingEvent) {
      // Update if changed
      if (needsUpdate(existingEvent, hockeyEvent)) {
        updateEvent(existingEvent, hockeyEvent);
        results.updated++;
      }
    } else {
      // Add new event
      createEvent(familyCalendar, hockeyEvent);
      results.added++;
    }
  });
  
  // Remove events that no longer exist in hockey calendar
  existingEvents.forEach(existingEvent => {
    const uid = extractUIDFromDescription(existingEvent.getDescription());
    if (uid && !hockeyEventMap.has(uid)) {
      existingEvent.deleteEvent();
      results.removed++;
    }
  });
  
  return results;
}

/**
 * Creates a new event in the family calendar
 */
function createEvent(calendar, hockeyEvent) {
  const title = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const description = (hockeyEvent.description || '') + `\n\nHockey-UID:${hockeyEvent.uid}`;
  
  const event = calendar.createEvent(
    title,
    hockeyEvent.startTime,
    hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000), // Default 2 hours
    {
      description: description,
      location: hockeyEvent.location || ''
    }
  );
  
  console.log(`Created event: ${title}`);
}

/**
 * Updates an existing event
 */
function updateEvent(existingEvent, hockeyEvent) {
  const newTitle = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const newDescription = (hockeyEvent.description || '') + `\n\nHockey-UID:${hockeyEvent.uid}`;
  
  existingEvent.setTitle(newTitle);
  existingEvent.setTime(
    hockeyEvent.startTime,
    hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000)
  );
  existingEvent.setDescription(newDescription);
  existingEvent.setLocation(hockeyEvent.location || '');
  
  console.log(`Updated event: ${newTitle}`);
}

/**
 * Checks if an event needs updating
 */
function needsUpdate(existingEvent, hockeyEvent) {
  const expectedTitle = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const expectedEndTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  
  return (
    existingEvent.getTitle() !== expectedTitle ||
    existingEvent.getStartTime().getTime() !== hockeyEvent.startTime.getTime() ||
    existingEvent.getEndTime().getTime() !== expectedEndTime.getTime() ||
    (existingEvent.getLocation() || '') !== (hockeyEvent.location || '')
  );
}

/**
 * Extracts UID from event description
 */
function extractUIDFromDescription(description) {
  const match = description.match(/Hockey-UID:([^\n\r]+)/);
  return match ? match[1].trim() : null;
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
  console.log('Next steps:');
  console.log('1. Set up time-based triggers using setupTriggers()');
  console.log('2. Or manually run syncHockeyCalendar() as needed');
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
    .everyHours(3)
    .create();
  
  console.log('Automatic sync trigger created (runs every 6 hours)');
}

/**
 * Manual trigger for testing
 */
function testSync() {
  console.log('Running test sync...');
  syncHockeyCalendar();
}

// ============ UTILITY FUNCTIONS ============
/**
 * Gets sync status and last run time
 */
function getSyncStatus() {
  const lastSync = PropertiesService.getScriptProperties().getProperty('lastSyncTime');
  console.log('Last sync:', lastSync ? new Date(lastSync) : 'Never');
  
  const triggers = ScriptApp.getProjectTriggers();
  const syncTriggers = triggers.filter(t => t.getHandlerFunction() === 'syncHockeyCalendar');
  console.log('Active triggers:', syncTriggers.length);
  
  return {
    lastSync: lastSync,
    triggersActive: syncTriggers.length > 0
  };
}
