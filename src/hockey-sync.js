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
/**
 * Hockey Calendar Sync Script - CLEAN VERSION
 * Configuration is loaded from config.js
 */

// Configuration is imported from config.js file


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
    console.log(`✓ Fetched ${hockeyEvents.length} hockey events from BenchApp`);
    
    const existingEvents = getExistingHockeyEvents(familyCalendar);
    console.log(`✓ Found ${existingEvents.length} existing hockey events in family calendar`);
    
    const results = processEvents(familyCalendar, hockeyEvents, existingEvents);
    
    console.log(`=== Sync Results ===`);
    console.log(`Added: ${results.added} events`);
    console.log(`Updated: ${results.updated} events`);
    console.log(`Removed: ${results.removed} events`);
    console.log(`Unchanged: ${results.unchanged} events`);
    
    if (results.added > 0 || results.updated > 0 || results.removed > 0) {
      console.log(`⚠️ Changes detected - family will receive notifications`);
    } else {
      console.log(`✓ No changes needed - no notifications sent`);
    }
    
    PropertiesService.getScriptProperties().setProperty('lastSyncTime', new Date().toISOString());
    return results;
    
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