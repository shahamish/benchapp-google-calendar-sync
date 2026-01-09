/**
 * Hockey Calendar Sync Script - COMPLETE FIXED VERSION
 * Automatically syncs events from BenchApp calendar to Google Calendar
 * FIXES: Duplicate event creation issue with stable UIDs
 */

// ============ CONFIGURATION - UPDATE THESE VALUES ============
/**
 * Hockey Calendar Sync Script - CLEAN VERSION
 * Configuration is loaded from config.js
 */

// Configuration is imported from config.js file (config.gs in Google Apps Script)


// ============ STABLE UID GENERATION ============
/**
 * Create a stable UID based on event content instead of BenchApp's changing UIDs
 */
function createStableUID(event) {
  const title = (event.title || '').trim();
  const startTime = event.startTime ? event.startTime.getTime().toString() : '';
  const location = (event.location || '').trim();
  
  const stableString = `${title}|${startTime}|${location}`;
  
  let hash = 0;
  for (let i = 0; i < stableString.length; i++) {
    const char = stableString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const positiveHash = Math.abs(hash);
  return `benchapp-stable-${positiveHash}`;
}

// ============ MAIN SYNC FUNCTION ============
/**
 * Main synchronization function
 */
function syncHockeyCalendar() {
  try {
    console.log(`=== Hockey Calendar Sync Started at ${new Date().toISOString()} ===`);
    
    const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
    if (!familyCalendar) {
      throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
    }
    
    const hockeyEvents = fetchHockeyEvents();
    
    // CRITICAL: Don't proceed if fetch failed
    if (hockeyEvents === null) {
      console.error('❌ Cannot fetch BenchApp data - aborting sync to prevent data loss');
      throw new Error('BenchApp fetch failed - sync aborted for safety');
    }
    
    console.log(`✓ Fetched ${hockeyEvents.length} hockey events from BenchApp`);

    // Additional safety check
    if (hockeyEvents.length === 0) {
      console.warn('⚠️ Zero events fetched - this is unusual. Checking if this is expected...');
      // You might want to add additional logic here to confirm this is intentional
    }

    // CRITICAL FIX: Filter events to only those within our sync window
    // This prevents duplicates for past events outside the lookback window
    const now = new Date();
    const windowStart = new Date(now.getTime() - (CONFIG.DAYS_LOOKBACK * 24 * 60 * 60 * 1000));
    const windowEnd = new Date(now.getTime() + (CONFIG.DAYS_LOOKAHEAD * 24 * 60 * 60 * 1000));

    const filteredHockeyEvents = hockeyEvents.filter(event =>
      event.startTime >= windowStart && event.startTime <= windowEnd
    );

    const filteredOut = hockeyEvents.length - filteredHockeyEvents.length;
    if (filteredOut > 0) {
      console.log(`✓ Filtered out ${filteredOut} events outside sync window (${CONFIG.DAYS_LOOKBACK} days back, ${CONFIG.DAYS_LOOKAHEAD} days ahead)`);
    }

    // Rest of your sync logic...
    const existingEvents = getExistingHockeyEvents(familyCalendar);
    console.log(`✓ Found ${existingEvents.length} existing hockey events in family calendar`);
    
    const results = processEvents(familyCalendar, filteredHockeyEvents, existingEvents);
    
    // ... rest unchanged
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

// ============ FETCH HOCKEY EVENTS ============
/**
 * Fetches and parses events from the hockey calendar URL
 */
function fetchHockeyEvents() {
  try {
    const response = UrlFetchApp.fetch(CONFIG.HOCKEY_CALENDAR_URL);
    
    // Check if we got a valid response
    if (response.getResponseCode() !== 200) {
      console.error(`BenchApp returned error code: ${response.getResponseCode()}`);
      console.error('Response:', response.getContentText());
      throw new Error(`BenchApp server error: ${response.getResponseCode()}`);
    }
    
    const icsData = response.getContentText();
    
    // Check if we got actual ICS data
    if (!icsData || !icsData.includes('BEGIN:VCALENDAR')) {
      console.error('Invalid ICS data received from BenchApp');
      throw new Error('Invalid calendar data from BenchApp');
    }
    
    const events = parseICSData(icsData);
    
    // Sanity check - if we normally have events but get 0, something's wrong
    if (events.length === 0) {
      console.warn('⚠️ WARNING: Fetched 0 events from BenchApp - this might indicate a server issue');
      console.warn('Previous syncs typically found events. Proceeding cautiously...');
    }
    
    return events;
    
  } catch (error) {
    console.error('Failed to fetch hockey calendar:', error);
    
    // CRITICAL: Return null to indicate failure, not empty array
    return null;
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
 * Parses individual event block from ICS data with stable UID generation
 */
function parseEventBlock(eventBlock) {
  const lines = eventBlock.split('\n').map(line => line.trim()).filter(line => line);
  const event = {};
  
  for (const line of lines) {
    if (line.startsWith('UID:')) {
      event.originalUID = line.substring(4).trim();
    } else if (line.startsWith('SUMMARY:')) {
      event.title = line.substring(8).trim();
    } else if (line.startsWith('DTSTART')) {
      event.startTime = parseICSDateTime(line);
    } else if (line.startsWith('DTEND')) {
      event.endTime = parseICSDateTime(line);
    } else if (line.startsWith('LOCATION:')) {
      // FIXED: Clean up escaped characters in location
      const rawLocation = line.substring(9).trim();
      event.location = cleanLocationString(rawLocation);
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = line.substring(12).trim();
    }
  }
  
  if (event.title && event.startTime) {
    event.uid = createStableUID(event);
    return event;
  }
  
  return null;
}

/**
 * Clean up location string by unescaping ICS escaped characters
 */
function cleanLocationString(location) {
  if (!location) return '';
  
  return location
    .replace(/\\n/g, '\n')        // Convert \n to actual line breaks
    .replace(/\\,/g, ',')         // Convert \, to regular commas  
    .replace(/\\\\/g, '\\')       // Convert \\ to single backslash
    .replace(/\\;/g, ';')         // Convert \; to regular semicolons
    .trim();
}

/**
 * Parses ICS datetime format to JavaScript Date
 */
function parseICSDateTime(line) {
  const dateMatch = line.match(/(\d{8}T\d{6})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
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
    event.getDescription() && 
    event.getDescription().includes('Hockey-UID:')
  );
}

/**
 * Process events - simplified version without complex batching
 */
function processEvents(familyCalendar, hockeyEvents, existingEvents) {
  const results = { added: 0, updated: 0, removed: 0, unchanged: 0 };
  
  // Create lookup maps
  const hockeyEventMap = new Map();
  hockeyEvents.forEach(event => hockeyEventMap.set(event.uid, event));
  
  const existingEventMap = new Map();
  existingEvents.forEach(event => {
    const uid = extractUIDFromDescription(event.getDescription());
    if (uid) {
      existingEventMap.set(uid, event);
    }
  });
  
  console.log(`Matching ${hockeyEventMap.size} BenchApp events against ${existingEventMap.size} existing events`);
  
  // Process hockey events (add or update)
  hockeyEvents.forEach(hockeyEvent => {
    const existingEvent = existingEventMap.get(hockeyEvent.uid);
    
    if (existingEvent) {
      if (needsUpdate(existingEvent, hockeyEvent)) {
        updateEvent(existingEvent, hockeyEvent);
        results.updated++;
        Utilities.sleep(300); // Rate limiting
      } else {
        results.unchanged++;
      }
    } else {
      createEvent(familyCalendar, hockeyEvent);
      results.added++;
      Utilities.sleep(300); // Rate limiting
    }
  });
  
  // Remove events that no longer exist in BenchApp
  existingEvents.forEach(existingEvent => {
    const uid = extractUIDFromDescription(existingEvent.getDescription());
    if (uid && !hockeyEventMap.has(uid)) {
      console.log(`Removing: "${existingEvent.getTitle()}" (UID: ${uid})`);
      existingEvent.deleteEvent();
      results.removed++;
      Utilities.sleep(300); // Rate limiting
    }
  });
  
  return results;
}

/**
 * Creates a new event in the family calendar
 */
function createEvent(calendar, hockeyEvent) {
  const title = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const endTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  const description = (hockeyEvent.description || '').trim() + 
    (hockeyEvent.description ? '\n\n' : '') + 
    `Hockey-UID: ${hockeyEvent.uid}`;
  
  calendar.createEvent(
    title,
    hockeyEvent.startTime,
    endTime,
    {
      description: description,
      location: hockeyEvent.location || ''
    }
  );
  
  console.log(`Created: "${title}" with UID: ${hockeyEvent.uid}`);
}

/**
 * Updates an existing event
 */
function updateEvent(existingEvent, hockeyEvent) {
  const newTitle = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const newEndTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  const newDescription = (hockeyEvent.description || '').trim() + 
    (hockeyEvent.description ? '\n\n' : '') + 
    `Hockey-UID: ${hockeyEvent.uid}`;
  
  existingEvent.setTitle(newTitle);
  existingEvent.setTime(hockeyEvent.startTime, newEndTime);
  existingEvent.setDescription(newDescription);
  existingEvent.setLocation(hockeyEvent.location || '');
  
  console.log(`Updated: "${newTitle}"`);
}

/**
 * Checks if an event needs updating - with detailed logging
 */
function needsUpdate(existingEvent, hockeyEvent) {
  const expectedTitle = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const expectedEndTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  
  const titleChanged = existingEvent.getTitle() !== expectedTitle;
  
  const startTimeDiff = Math.abs(existingEvent.getStartTime().getTime() - hockeyEvent.startTime.getTime());
  const endTimeDiff = Math.abs(existingEvent.getEndTime().getTime() - expectedEndTime.getTime());
  const startChanged = startTimeDiff > 300000; // 5 minutes tolerance
  const endChanged = endTimeDiff > 300000;
  
  const existingLocation = (existingEvent.getLocation() || '').toLowerCase().trim();
  const newLocation = (hockeyEvent.location || '').toLowerCase().trim();
  const locationChanged = existingLocation !== newLocation;
  
  // Handle both description formats properly
  const existingDesc = existingEvent.getDescription() || '';
  const existingContentDesc = existingDesc
    .replace(/\n\nHockey-UID:.*$/, '')
    .replace(/^Hockey-UID:.*$/, '')
    .trim();
  const newContentDesc = (hockeyEvent.description || '').trim();
  const descriptionChanged = existingContentDesc !== newContentDesc;
  
  return titleChanged || startChanged || endChanged || locationChanged || descriptionChanged;
}

/**
 * Extracts UID from event description
 */
function extractUIDFromDescription(description) {
  if (!description) return null;
  
  const match = description.match(/Hockey-UID:\s*([^\n\r\s]+)/);
  return match ? match[1].trim() : null;
}

// ============ SETUP FUNCTIONS ============
/**
 * One-time setup function - run this first
 */
function setupSync() {
  console.log('Setting up hockey calendar sync...');
  
  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  if (!familyCalendar) {
    throw new Error('Cannot access family calendar. Please check the calendar ID and permissions.');
  }
  
  try {
    UrlFetchApp.fetch(CONFIG.HOCKEY_CALENDAR_URL);
    console.log('Hockey calendar URL is accessible');
  } catch (error) {
    throw new Error('Cannot access hockey calendar URL: ' + error.toString());
  }
  
  syncHockeyCalendar();
  
  console.log('Setup completed successfully!');
  console.log('Next steps: Run setupTriggers() to enable automatic syncing');
}

/**
 * Sets up automatic triggers
 */
function setupTriggers() {
  console.log('Setting up triggers...');
  
  // Delete ALL existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncHockeyCalendar') {
      console.log(`Deleting existing trigger: ${trigger.getUniqueId()}`);
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  console.log(`Deleted ${deletedCount} existing triggers`);
  
  // Create new trigger
  try {
    const newTrigger = ScriptApp.newTrigger('syncHockeyCalendar')
      .timeBased()
      .everyHours(6)
      .create();
    
    console.log(`✓ Created new trigger: ${newTrigger.getUniqueId()}`);
    console.log('✓ Trigger will run every 6 hours');
    
  } catch (error) {
    console.error('Failed to create trigger:', error);
    return;
  }
  
  // Verify creation
  const allTriggers = ScriptApp.getProjectTriggers();
  const syncTriggers = allTriggers.filter(t => t.getHandlerFunction() === 'syncHockeyCalendar');
  console.log(`\nVerification: ${syncTriggers.length} sync trigger(s) now active`);
  
  console.log('\nTo verify trigger details:');
  console.log('Go to Apps Script Editor → Triggers (left sidebar)');
}

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

// ============ ESSENTIAL DEBUG FUNCTIONS ============
/**
 * Quick status check
 */
function quickStatusCheck() {
  const benchAppCount = fetchHockeyEvents().length;
  const calendarCount = getExistingHockeyEvents(CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID)).length;
  
  console.log(`BenchApp events: ${benchAppCount}`);
  console.log(`Family calendar hockey events: ${calendarCount}`);
  console.log(`Match: ${benchAppCount === calendarCount ? '✅ YES' : '❌ NO'}`);
  
  return { benchApp: benchAppCount, calendar: calendarCount };
}

/**
 * Debug what's causing unnecessary updates
 */
function debugUpdateDetection() {
  console.log('=== DEBUG UPDATE DETECTION ===');
  
  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  const hockeyEvents = fetchHockeyEvents().slice(0, 3); // Just check first 3
  const existingEvents = getExistingHockeyEvents(familyCalendar);
  
  // Create lookup map
  const existingEventMap = new Map();
  existingEvents.forEach(event => {
    const uid = extractUIDFromDescription(event.getDescription());
    if (uid) {
      existingEventMap.set(uid, event);
    }
  });
  
  hockeyEvents.forEach((hockeyEvent, index) => {
    const existingEvent = existingEventMap.get(hockeyEvent.uid);
    
    if (existingEvent) {
      console.log(`\n--- Event ${index + 1}: "${hockeyEvent.title}" ---`);
      console.log(`UID: ${hockeyEvent.uid}`);
      
      const expectedTitle = CONFIG.EVENT_PREFIX + hockeyEvent.title;
      const expectedEndTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
      
      console.log(`Title: "${existingEvent.getTitle()}" vs "${expectedTitle}" - ${existingEvent.getTitle() === expectedTitle ? '✅' : '❌'}`);
      
      const startDiff = Math.abs(existingEvent.getStartTime().getTime() - hockeyEvent.startTime.getTime());
      console.log(`Start time diff: ${startDiff}ms - ${startDiff <= 300000 ? '✅' : '❌'}`);
      
      const endDiff = Math.abs(existingEvent.getEndTime().getTime() - expectedEndTime.getTime());
      console.log(`End time diff: ${endDiff}ms - ${endDiff <= 300000 ? '✅' : '❌'}`);
      
      const locationMatch = (existingEvent.getLocation() || '').toLowerCase().trim() === (hockeyEvent.location || '').toLowerCase().trim();
      console.log(`Location: "${existingEvent.getLocation() || ''}" vs "${hockeyEvent.location || ''}" - ${locationMatch ? '✅' : '❌'}`);
      
      const needsUpdateResult = needsUpdate(existingEvent, hockeyEvent);
      console.log(`Overall result: ${needsUpdateResult ? '❌ UPDATE NEEDED' : '✅ NO UPDATE NEEDED'}`);
    }
  });
}

function debugTriggers() {
  console.log('=== TRIGGER DEBUG ===');
  
  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Total triggers found: ${triggers.length}`);
  
  triggers.forEach((trigger, index) => {
    console.log(`\nTrigger ${index + 1}:`);
    console.log(`  Function: ${trigger.getHandlerFunction()}`);
    console.log(`  Type: ${trigger.getEventType()}`);
    console.log(`  UID: ${trigger.getUniqueId()}`);
    
    // Note: Google Apps Script doesn't provide a direct way to get the interval
    // You'll need to check the Triggers page in the Apps Script editor for details
  });
  
  const lastSync = PropertiesService.getScriptProperties().getProperty('lastSyncTime');
  console.log(`\nLast recorded sync: ${lastSync ? new Date(lastSync) : 'Never'}`);
  
  console.log('\nNext steps:');
  console.log('1. Check Apps Script Editor → Triggers page for frequency details');
  console.log('2. Check Apps Script Editor → Executions for trigger history');
}

function testConfig() {
  console.log('Testing configuration access...');
  console.log('FAMILY_CALENDAR_ID:', CONFIG.FAMILY_CALENDAR_ID);
  console.log('HOCKEY_CALENDAR_URL:', CONFIG.HOCKEY_CALENDAR_URL);
  console.log('EVENT_PREFIX:', CONFIG.EVENT_PREFIX);
}

// ============ DUPLICATE CLEANUP FUNCTIONS ============
/**
 * IMPORTANT: Before running cleanup on large numbers of events:
 *
 * 1. Disable calendar notifications temporarily:
 *    - Go to Google Calendar → Settings (gear icon)
 *    - Click on your calendar under "Settings for my calendars"
 *    - Scroll to "Event notifications" and "All-day event notifications"
 *    - Remove or disable notifications temporarily
 *    - Re-enable after cleanup is complete
 *
 * 2. Test on a small date range first using reviewDuplicatesInRange() / cleanupDuplicatesInRange()
 *
 * Note: CalendarApp.deleteEvent() does NOT send cancellation emails to attendees,
 * but your own calendar notification settings may still trigger alerts.
 */

/**
 * Creates a signature for grouping duplicate events
 * Events are considered duplicates if they have the same title and start time
 */
function createEventSignature(event) {
  const title = event.getTitle();
  const startTime = event.getStartTime().getTime();
  return `${title}|${startTime}`;
}

/**
 * Gets all hockey events within a date range for cleanup purposes
 */
function getHockeyEventsInRange(calendar, startDate, endDate) {
  const events = calendar.getEvents(startDate, endDate);
  return events.filter(event =>
    event.getTitle().startsWith(CONFIG.EVENT_PREFIX)
  );
}

/**
 * TEST FUNCTION: Review duplicates for the last N days only
 * Use this to test on a small subset before running full cleanup
 * @param {number} daysBack - Number of days to look back (default: 7)
 */
function reviewDuplicatesRecent(daysBack = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  return reviewDuplicatesInRange(startDate, endDate);
}

/**
 * TEST FUNCTION: Cleanup duplicates for the last N days only
 * Use this to test cleanup on a small subset first
 * @param {number} daysBack - Number of days to look back (default: 7)
 */
function cleanupDuplicatesRecent(daysBack = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  return cleanupDuplicatesInRange(startDate, endDate);
}

/**
 * Reviews duplicate events in a specific date range - DRY RUN
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 */
function reviewDuplicatesInRange(startDate, endDate) {
  console.log('=== DUPLICATE EVENT REVIEW (DRY RUN) ===');
  console.log('This will NOT delete anything - just report what would be cleaned up.\n');

  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  if (!familyCalendar) {
    throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
  }

  console.log(`Searching for hockey events from ${startDate.toDateString()} to ${endDate.toDateString()}...`);

  const allEvents = getHockeyEventsInRange(familyCalendar, startDate, endDate);
  console.log(`Found ${allEvents.length} total hockey events in range.\n`);

  // Group events by signature (title + start time)
  const eventGroups = new Map();

  allEvents.forEach(event => {
    const signature = createEventSignature(event);
    if (!eventGroups.has(signature)) {
      eventGroups.set(signature, []);
    }
    eventGroups.get(signature).push(event);
  });

  // Find groups with duplicates
  let totalDuplicates = 0;
  let affectedEventTypes = 0;
  const duplicateDetails = [];

  eventGroups.forEach((events, signature) => {
    if (events.length > 1) {
      affectedEventTypes++;
      const duplicateCount = events.length - 1; // Keep one, delete the rest
      totalDuplicates += duplicateCount;

      const sampleEvent = events[0];
      duplicateDetails.push({
        title: sampleEvent.getTitle(),
        date: sampleEvent.getStartTime().toDateString(),
        copies: events.length,
        toDelete: duplicateCount
      });
    }
  });

  // Report results
  console.log('=== SUMMARY ===');
  console.log(`Date range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
  console.log(`Unique event types with duplicates: ${affectedEventTypes}`);
  console.log(`Total duplicate events to delete: ${totalDuplicates}`);
  console.log(`Events that will be kept: ${allEvents.length - totalDuplicates}\n`);

  if (duplicateDetails.length > 0) {
    console.log('=== DUPLICATE DETAILS ===');
    duplicateDetails.forEach(detail => {
      console.log(`"${detail.title}" on ${detail.date}: ${detail.copies} copies (will delete ${detail.toDelete})`);
    });
  } else {
    console.log('No duplicates found!');
  }

  return {
    totalEvents: allEvents.length,
    uniqueEventTypes: eventGroups.size,
    duplicateEventTypes: affectedEventTypes,
    totalDuplicatesToDelete: totalDuplicates,
    details: duplicateDetails
  };
}

/**
 * Cleans up duplicate events in a specific date range - DESTRUCTIVE OPERATION
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @param {number} maxDeletes - Maximum deletions per run to avoid timeout (default: 300)
 */
function cleanupDuplicatesInRange(startDate, endDate, maxDeletes = 300) {
  console.log('=== DUPLICATE EVENT CLEANUP ===');
  console.log('WARNING: This will DELETE duplicate events!\n');
  console.log(`Batch limit: ${maxDeletes} deletions per run (to avoid 6-minute timeout)\n`);

  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  if (!familyCalendar) {
    throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
  }

  console.log(`Searching for hockey events from ${startDate.toDateString()} to ${endDate.toDateString()}...`);

  const allEvents = getHockeyEventsInRange(familyCalendar, startDate, endDate);
  console.log(`Found ${allEvents.length} total hockey events in range.\n`);

  // Group events by signature (title + start time)
  const eventGroups = new Map();

  allEvents.forEach(event => {
    const signature = createEventSignature(event);
    if (!eventGroups.has(signature)) {
      eventGroups.set(signature, []);
    }
    eventGroups.get(signature).push(event);
  });

  // Count total duplicates first
  let totalDuplicates = 0;
  eventGroups.forEach((events) => {
    if (events.length > 1) {
      totalDuplicates += events.length - 1;
    }
  });
  console.log(`Total duplicates to delete: ${totalDuplicates}`);
  console.log(`Will delete up to ${maxDeletes} this run.\n`);

  // Delete duplicates, keeping the first one
  let deletedCount = 0;
  let errorCount = 0;
  let skippedDueToLimit = 0;
  let processedGroups = 0;

  eventGroups.forEach((events, signature) => {
    if (events.length > 1) {
      const eventsToDelete = events.slice(1);
      processedGroups++;

      eventsToDelete.forEach(event => {
        // Check if we've hit the batch limit
        if (deletedCount >= maxDeletes) {
          skippedDueToLimit++;
          return;
        }

        try {
          event.deleteEvent();
          deletedCount++;

          // Progress logging every 50 deletions
          if (deletedCount % 50 === 0) {
            console.log(`Progress: ${deletedCount} deleted...`);
          }

          Utilities.sleep(300); // Rate limiting to match rest of script
        } catch (error) {
          console.error(`Failed to delete event: ${error}`);
          errorCount++;
        }
      });

      // Log each event type being processed (but not every duplicate)
      if (deletedCount < maxDeletes) {
        console.log(`Cleaned "${events[0].getTitle()}" on ${events[0].getStartTime().toDateString()}: deleted ${eventsToDelete.length} duplicates`);
      }
    }
  });

  const remainingDuplicates = totalDuplicates - deletedCount;

  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Successfully deleted: ${deletedCount} duplicate events`);
  if (errorCount > 0) {
    console.log(`Failed to delete: ${errorCount} events`);
  }
  if (remainingDuplicates > 0) {
    console.log(`\n⚠️ REMAINING DUPLICATES: ${remainingDuplicates}`);
    console.log('Run this function again to continue cleanup.');
  } else {
    console.log('\n✓ All duplicates cleaned up!');
  }

  return {
    deleted: deletedCount,
    errors: errorCount,
    remainingDuplicates: remainingDuplicates,
    needsAnotherRun: remainingDuplicates > 0
  };
}

/**
 * Reviews duplicate events without deleting - DRY RUN
 * Searches from August 1, 2025 to present and reports duplicates
 */
function reviewDuplicateEvents() {
  const startDate = new Date(2025, 7, 1); // August 1, 2025 (month is 0-indexed)
  const endDate = new Date();
  return reviewDuplicatesInRange(startDate, endDate);
}

/**
 * Cleans up duplicate events - DESTRUCTIVE OPERATION
 * Keeps one copy of each event and deletes the rest
 * Run reviewDuplicateEvents() first to see what will be deleted
 */
function cleanupDuplicateEvents() {
  const startDate = new Date(2025, 7, 1); // August 1, 2025
  const endDate = new Date();
  return cleanupDuplicatesInRange(startDate, endDate);
}

// ============ CONVENIENCE WRAPPERS FOR APPS SCRIPT UI ============
// Use these when running from the Apps Script editor (can't pass parameters via UI)

/** Review duplicates from last 3 days - for quick testing */
function reviewDuplicates_Last3Days() {
  return reviewDuplicatesRecent(3);
}

/** Review duplicates from last 7 days */
function reviewDuplicates_Last7Days() {
  return reviewDuplicatesRecent(7);
}

/** Review duplicates from last 14 days */
function reviewDuplicates_Last14Days() {
  return reviewDuplicatesRecent(14);
}

/** Review duplicates from last 30 days */
function reviewDuplicates_Last30Days() {
  return reviewDuplicatesRecent(30);
}

/** Cleanup duplicates from last 3 days - for testing cleanup */
function cleanupDuplicates_Last3Days() {
  return cleanupDuplicatesRecent(3);
}

/** Cleanup duplicates from last 7 days */
function cleanupDuplicates_Last7Days() {
  return cleanupDuplicatesRecent(7);
}

/** Cleanup duplicates from last 14 days */
function cleanupDuplicates_Last14Days() {
  return cleanupDuplicatesRecent(14);
}

/** Cleanup duplicates from last 30 days */
function cleanupDuplicates_Last30Days() {
  return cleanupDuplicatesRecent(30);
}