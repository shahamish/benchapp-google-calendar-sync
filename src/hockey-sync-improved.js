/**
 * Hockey Calendar Sync Script - STABLE UID FIX
 * Fixes the duplicate event issue by using stable UIDs based on event properties
 */


// ============ STABLE UID GENERATION ============

/**
 * Create a stable UID based on event content instead of BenchApp's changing UIDs
 */
function createStableUID(event) {
  // Use event properties that don't change: title, start time, location
  const title = (event.title || '').trim();
  const startTime = event.startTime ? event.startTime.getTime().toString() : '';
  const location = (event.location || '').trim();
  
  // Create a consistent string to hash
  const stableString = `${title}|${startTime}|${location}`;
  
  // Simple hash function (you could use crypto libraries for better hashing)
  let hash = 0;
  for (let i = 0; i < stableString.length; i++) {
    const char = stableString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to positive number and add prefix
  const positiveHash = Math.abs(hash);
  return `benchapp-stable-${positiveHash}`;
}

/**
 * IMPROVED: Parse event block with stable UID generation
 */
function parseEventBlock(eventBlock) {
  const lines = eventBlock.split('\n').map(line => line.trim()).filter(line => line);
  const event = {};
  
  for (const line of lines) {
    if (line.startsWith('UID:')) {
      // Store the original BenchApp UID for reference, but don't use it for matching
      event.originalUID = line.substring(4).trim();
    } else if (line.startsWith('SUMMARY:')) {
      event.title = line.substring(8).trim();
    } else if (line.startsWith('DTSTART')) {
      event.startTime = parseICSDateTime(line);
    } else if (line.startsWith('DTEND')) {
      event.endTime = parseICSDateTime(line);
    } else if (line.startsWith('LOCATION:')) {
      event.location = line.substring(9).trim();
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = line.substring(12).trim();
    }
  }
  
  // Only process events with required fields
  if (event.title && event.startTime) {
    // Generate stable UID based on event content
    event.uid = createStableUID(event);
    return event;
  }
  
  return null;
}

/**
 * IMPROVED: Extract UID with backward compatibility
 */
function extractUIDFromDescription(description) {
  if (!description) return null;
  
  // Look for our stable UID marker (new format)
  let match = description.match(/Hockey-UID:\s*([^\n\r\s]+)/);
  if (match) {
    return match[1].trim();
  }
  
  // For backward compatibility with old random UIDs
  match = description.match(/Hockey-UID:\s*([^\n\r]+)/);
  if (match) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * MAIN SYNC FUNCTION with stable UID logic
 */
function syncHockeyCalendar() {
  try {
    console.log(`=== Hockey Calendar Sync Started at ${new Date().toISOString()} ===`);
    
    const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
    if (!familyCalendar) {
      throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
    }
    
    // Fetch hockey events
    const hockeyEvents = fetchHockeyEvents();
    console.log(`✓ Fetched ${hockeyEvents.length} events from BenchApp`);
    
    // Show sample UIDs for verification
    if (hockeyEvents.length > 0) {
      console.log(`Sample stable UIDs generated:`);
      hockeyEvents.slice(0, 3).forEach((event, index) => {
        console.log(`  ${index + 1}. "${event.title}" → ${event.uid}`);
      });
    }
    
    // Get existing events
    const existingEvents = getExistingHockeyEvents(familyCalendar);
    console.log(`✓ Found ${existingEvents.length} existing hockey events in family calendar`);
    
    // Process events with stable UID matching
    const results = processEventsWithStableUIDs(familyCalendar, hockeyEvents, existingEvents);
    
    console.log(`=== Sync Results ===`);
    console.log(`Added: ${results.added} events`);
    console.log(`Updated: ${results.updated} events`);
    console.log(`Removed: ${results.removed} events`);
    console.log(`Unchanged: ${results.unchanged} events`);
    console.log(`Migrated: ${results.migrated} events (old UID format → stable UID)`);
    
    // Only log if there were actual changes
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

/**
 * Process events with stable UID matching and migration support
 */
function processEventsWithStableUIDs(familyCalendar, hockeyEvents, existingEvents) {
  const results = { added: 0, updated: 0, removed: 0, unchanged: 0, migrated: 0 };
  
  // Create lookup maps
  const hockeyEventMap = new Map();
  hockeyEvents.forEach(event => hockeyEventMap.set(event.uid, event));
  
  console.log(`Processing ${hockeyEventMap.size} BenchApp events with stable UIDs`);
  
  // Create map of existing events by UID
  const existingEventMap = new Map();
  const existingByContent = new Map(); // For migration from old UIDs
  
  existingEvents.forEach(event => {
    const storedUID = extractUIDFromDescription(event.getDescription());
    if (storedUID) {
      existingEventMap.set(storedUID, event);
    }
    
    // Also create content-based lookup for migration
    const contentKey = `${event.getTitle().replace(CONFIG.EVENT_PREFIX, '')}|${event.getStartTime().getTime()}|${event.getLocation() || ''}`;
    existingByContent.set(contentKey, event);
  });
  
  console.log(`Found ${existingEventMap.size} events with stored UIDs`);
  
  // Process hockey events (add, update, or migrate)
  hockeyEvents.forEach(hockeyEvent => {
    let existingEvent = existingEventMap.get(hockeyEvent.uid);
    let isMigration = false;
    
    // If no match by UID, try to find by content (for migration)
    if (!existingEvent) {
      const contentKey = `${hockeyEvent.title}|${hockeyEvent.startTime.getTime()}|${hockeyEvent.location || ''}`;
      existingEvent = existingByContent.get(contentKey);
      if (existingEvent) {
        isMigration = true;
        console.log(`Migrating event "${hockeyEvent.title}" to stable UID: ${hockeyEvent.uid}`);
      }
    }
    
    if (existingEvent) {
      // Event exists - check if update needed (or migration)
      if (isMigration || needsUpdate(existingEvent, hockeyEvent)) {
        updateEvent(existingEvent, hockeyEvent);
        if (isMigration) {
          results.migrated++;
        } else {
          results.updated++;
        }
      } else {
        results.unchanged++;
      }
    } else {
      // New event - create it
      createEvent(familyCalendar, hockeyEvent);
      results.added++;
    }
  });
  
  // Remove events that no longer exist in BenchApp
  // Only remove events that we can't match by either UID or content
  existingEvents.forEach(existingEvent => {
    const storedUID = extractUIDFromDescription(existingEvent.getDescription());
    const contentKey = `${existingEvent.getTitle().replace(CONFIG.EVENT_PREFIX, '')}|${existingEvent.getStartTime().getTime()}|${existingEvent.getLocation() || ''}`;
    
    const existsByUID = storedUID && hockeyEventMap.has(storedUID);
    const existsByContent = Array.from(hockeyEventMap.values()).some(hockeyEvent => {
      const hockeyContentKey = `${hockeyEvent.title}|${hockeyEvent.startTime.getTime()}|${hockeyEvent.location || ''}`;
      return hockeyContentKey === contentKey;
    });
    
    if (!existsByUID && !existsByContent) {
      console.log(`Removing: "${existingEvent.getTitle()}" (no longer in BenchApp)`);
      existingEvent.deleteEvent();
      results.removed++;
    }
  });
  
  return results;
}

/**
 * Check if event needs updating (same as before)
 */
function needsUpdate(existingEvent, hockeyEvent) {
  const expectedTitle = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const expectedEndTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  
  const titleChanged = existingEvent.getTitle() !== expectedTitle;
  
  // Allow for small time differences (less than 1 minute)
  const startTimeDiff = Math.abs(existingEvent.getStartTime().getTime() - hockeyEvent.startTime.getTime());
  const endTimeDiff = Math.abs(existingEvent.getEndTime().getTime() - expectedEndTime.getTime());
  const startChanged = startTimeDiff > 60000;
  const endChanged = endTimeDiff > 60000;
  
  const locationChanged = (existingEvent.getLocation() || '').trim() !== (hockeyEvent.location || '').trim();
  
  // Check if description content changed (excluding our UID marker)
  const existingDesc = existingEvent.getDescription() || '';
  const existingContentDesc = existingDesc.replace(/\n\nHockey-UID:.*$/, '').trim();
  const newContentDesc = (hockeyEvent.description || '').trim();
  const descriptionChanged = existingContentDesc !== newContentDesc;
  
  return titleChanged || startChanged || endChanged || locationChanged || descriptionChanged;
}

/**
 * Create event with stable UID
 */
function createEvent(calendar, hockeyEvent) {
  const title = CONFIG.EVENT_PREFIX + hockeyEvent.title;
  const endTime = hockeyEvent.endTime || new Date(hockeyEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  
  // Store stable UID in description
  const description = (hockeyEvent.description || '').trim() + 
    (hockeyEvent.description ? '\n\n' : '') + 
    `Hockey-UID: ${hockeyEvent.uid}`;
  
  const event = calendar.createEvent(
    title,
    hockeyEvent.startTime,
    endTime,
    {
      description: description,
      location: hockeyEvent.location || ''
    }
  );
  
  console.log(`Created: "${title}" with stable UID: ${hockeyEvent.uid}`);
}

/**
 * Update event with stable UID
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
  
  console.log(`Updated: "${newTitle}" with stable UID: ${hockeyEvent.uid}`);
}

/**
 * Test the stable UID generation
 */
function testStableUIDGeneration() {
  console.log('=== TESTING STABLE UID GENERATION ===');
  
  // Fetch events multiple times and compare UIDs
  const events1 = fetchHockeyEvents();
  const events2 = fetchHockeyEvents();
  
  console.log(`First fetch: ${events1.length} events`);
  console.log(`Second fetch: ${events2.length} events`);
  
  if (events1.length !== events2.length) {
    console.log('❌ Event count differs between fetches!');
    return;
  }
  
  let consistentUIDs = 0;
  let sampleUIDs = [];
  
  for (let i = 0; i < Math.min(events1.length, events2.length); i++) {
    const event1 = events1[i];
    const event2 = events2[i];
    
    if (event1.uid === event2.uid && event1.title === event2.title) {
      consistentUIDs++;
      if (sampleUIDs.length < 5) {
        sampleUIDs.push(`"${event1.title}" → ${event1.uid}`);
      }
    } else {
      console.log(`Inconsistency in event ${i}:`);
      console.log(`  First:  UID="${event1.uid}" Title="${event1.title}"`);
      console.log(`  Second: UID="${event2.uid}" Title="${event2.title}"`);
    }
  }
  
  console.log(`✓ ${consistentUIDs}/${events1.length} events have consistent stable UIDs`);
  console.log('Sample stable UIDs:');
  sampleUIDs.forEach(uid => console.log(`  ${uid}`));
  
  if (consistentUIDs === events1.length) {
    console.log('✅ Stable UID generation is working perfectly!');
  } else {
    console.log('❌ Stable UID generation has issues');
  }
}

// ============ INCLUDE ALL OTHER FUNCTIONS ============
// Copy all other functions from your original script:
// - fetchHockeyEvents()
// - parseICSData() 
// - parseICSDateTime()
// - getExistingHockeyEvents()
// - setupSync()
// - setupTriggers()
// etc.