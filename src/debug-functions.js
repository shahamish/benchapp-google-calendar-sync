// ============ DEBUG FUNCTIONS ============
/**
 * Debug function to analyze what's happening with UIDs
 */
function debugSyncIssue() {
  console.log('=== DEBUGGING SYNC ISSUE ===');
  
  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  
  // Get hockey events from BenchApp
  console.log('\n--- BENCHAPP EVENTS ---');
  const hockeyEvents = fetchHockeyEvents();
  console.log(`Found ${hockeyEvents.length} hockey events`);
  
  hockeyEvents.slice(0, 3).forEach((event, index) => {
    console.log(`${index + 1}. UID: "${event.uid}"`);
    console.log(`   Title: "${event.title}"`);
    console.log(`   Start: ${event.startTime}`);
    console.log(`   Generated from: ${event.originalUID || 'N/A'}`);
  });
  
  // Get existing events from family calendar
  console.log('\n--- EXISTING FAMILY CALENDAR EVENTS ---');
  const existingEvents = getExistingHockeyEvents(familyCalendar);
  console.log(`Found ${existingEvents.length} existing hockey events`);
  
  existingEvents.slice(0, 3).forEach((event, index) => {
    const extractedUID = extractUIDFromDescription(event.getDescription());
    console.log(`${index + 1}. Extracted UID: "${extractedUID}"`);
    console.log(`   Title: "${event.getTitle()}"`);
    console.log(`   Start: ${event.getStartTime()}`);
    console.log(`   Full Description: "${event.getDescription().substring(0, 100)}..."`);
  });
  
  // Check for matches
  console.log('\n--- MATCHING ANALYSIS ---');
  const hockeyEventMap = new Map();
  hockeyEvents.forEach(event => hockeyEventMap.set(event.uid, event));
  
  const existingEventMap = new Map();
  existingEvents.forEach(event => {
    const uid = extractUIDFromDescription(event.getDescription());
    if (uid) {
      existingEventMap.set(uid, event);
    }
  });
  
  console.log(`Hockey events UIDs: [${Array.from(hockeyEventMap.keys()).slice(0, 3).join(', ')}...]`);
  console.log(`Existing events UIDs: [${Array.from(existingEventMap.keys()).slice(0, 3).join(', ')}...]`);
  
  let matches = 0;
  hockeyEventMap.forEach((hockeyEvent, uid) => {
    if (existingEventMap.has(uid)) {
      matches++;
    }
  });
  
  console.log(`Matching UIDs found: ${matches} out of ${hockeyEvents.length}`);
  
  if (matches === 0) {
    console.log('❌ NO MATCHES FOUND - This explains why events are being recreated!');
    console.log('Issue is likely in UID generation or extraction');
  } else if (matches < hockeyEvents.length) {
    console.log('⚠️ PARTIAL MATCHES - Some events not matching properly');
  } else {
    console.log('✅ All events matching - Issue might be in update detection');
  }
}


// ============ UTILITY FUNCTIONS ============

/**
 * Clean up duplicate events (run once to fix current state)
 */
function cleanupDuplicateEvents() {
  console.log('=== CLEANING UP DUPLICATE EVENTS ===');
  
  const familyCalendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  const existingEvents = getExistingHockeyEvents(familyCalendar);
  
  console.log(`Found ${existingEvents.length} hockey events to analyze`);
  
  // Group events by title and start time
  const eventGroups = new Map();
  
  existingEvents.forEach(event => {
    const key = `${event.getTitle()}|${event.getStartTime().getTime()}`;
    if (!eventGroups.has(key)) {
      eventGroups.set(key, []);
    }
    eventGroups.get(key).push(event);
  });
  
  let duplicatesRemoved = 0;
  
  eventGroups.forEach((events, key) => {
    if (events.length > 1) {
      console.log(`Found ${events.length} duplicates of: ${events[0].getTitle()}`);
      
      // Keep the first event, remove the rest
      for (let i = 1; i < events.length; i++) {
        console.log(`  Removing duplicate: ${events[i].getTitle()}`);
        events[i].deleteEvent();
        duplicatesRemoved++;
      }
    }
  });
  
  console.log(`✓ Removed ${duplicatesRemoved} duplicate events`);
}

// ============ ADD ALL OTHER EXISTING FUNCTIONS HERE ============
// (fetchHockeyEvents, parseICSData, getExistingHockeyEvents, etc.)
// These functions remain the same as in the original script

/**
 * Quick test to verify UID consistency
 */
function testUIDConsistency() {
  console.log('=== TESTING UID CONSISTENCY ===');
  
  // Fetch events twice and compare UIDs
  const events1 = fetchHockeyEvents();
  const events2 = fetchHockeyEvents();
  
  console.log(`First fetch: ${events1.length} events`);
  console.log(`Second fetch: ${events2.length} events`);
  
  if (events1.length !== events2.length) {
    console.log('❌ Event count differs between fetches!');
    return;
  }
  
  let consistentUIDs = 0;
  for (let i = 0; i < events1.length; i++) {
    if (events1[i].uid === events2[i].uid && 
        events1[i].title === events2[i].title) {
      consistentUIDs++;
    } else {
      console.log(`Inconsistency in event ${i}:`);
      console.log(`  First:  UID="${events1[i].uid}" Title="${events1[i].title}"`);
      console.log(`  Second: UID="${events2[i].uid}" Title="${events2[i].title}"`);
    }
  }
  
  console.log(`✓ ${consistentUIDs}/${events1.length} events have consistent UIDs`);
  
  if (consistentUIDs === events1.length) {
    console.log('✅ UID generation is consistent');
  } else {
    console.log('❌ UID generation is inconsistent - this is the problem!');
  }
}
