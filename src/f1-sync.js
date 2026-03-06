/**
 * F1 Race Calendar Sync Script
 * Syncs Formula 1 race and sprint events to Google Calendar
 * Data source: f1calendar.com ICS feed (races + sprints only)
 */

// Configuration is imported from config.js file (config.gs in Google Apps Script)
// Required config keys: FAMILY_CALENDAR_ID, F1_CALENDAR_URL, F1_EVENT_PREFIX

// ============ STABLE UID GENERATION ============

function createF1StableUID(event) {
  const title = (event.title || '').trim();
  const startTime = event.startTime ? event.startTime.getTime().toString() : '';

  const stableString = `f1|${title}|${startTime}`;

  let hash = 0;
  for (let i = 0; i < stableString.length; i++) {
    const char = stableString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `f1-stable-${Math.abs(hash)}`;
}

// ============ MAIN SYNC FUNCTION ============

function syncF1Calendar() {
  try {
    console.log(`=== F1 Calendar Sync Started at ${new Date().toISOString()} ===`);

    const calendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
    if (!calendar) {
      throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
    }

    const f1Events = fetchF1Events();
    if (f1Events === null) {
      console.error('Cannot fetch F1 calendar data - aborting sync');
      throw new Error('F1 calendar fetch failed - sync aborted');
    }

    console.log(`Fetched ${f1Events.length} race/sprint events from F1 calendar`);

    // Sync window: entire season (past 30 days through 365 days ahead)
    const now = new Date();
    const windowStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const windowEnd = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));

    const filteredEvents = f1Events.filter(event =>
      event.startTime >= windowStart && event.startTime <= windowEnd
    );
    console.log(`${filteredEvents.length} events within sync window`);

    const existingEvents = getExistingF1Events(calendar);
    console.log(`Found ${existingEvents.length} existing F1 events in calendar`);

    const results = processF1Events(calendar, filteredEvents, existingEvents);

    console.log(`=== F1 Sync Complete: ${results.added} added, ${results.updated} updated, ${results.removed} removed, ${results.unchanged} unchanged ===`);

    PropertiesService.getScriptProperties().setProperty('lastF1SyncTime', new Date().toISOString());

    return results;

  } catch (error) {
    console.error('F1 sync failed:', error);
    throw error;
  }
}

// ============ FETCH & PARSE ============

function fetchF1Events() {
  try {
    const response = UrlFetchApp.fetch(CONFIG.F1_CALENDAR_URL);

    if (response.getResponseCode() !== 200) {
      console.error(`F1 calendar returned error code: ${response.getResponseCode()}`);
      return null;
    }

    const icsData = response.getContentText();

    if (!icsData || !icsData.includes('BEGIN:VCALENDAR')) {
      console.error('Invalid ICS data received from F1 calendar');
      return null;
    }

    return parseF1ICSData(icsData);

  } catch (error) {
    console.error('Failed to fetch F1 calendar:', error);
    return null;
  }
}

function parseF1ICSData(icsData) {
  const events = [];
  const eventBlocks = icsData.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const eventBlock = eventBlocks[i].split('END:VEVENT')[0];
    const event = parseF1EventBlock(eventBlock);
    if (event && isRaceOrSprint(event)) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Parses an individual VEVENT block from ICS data.
 * Handles multi-line folded fields (lines starting with a space are continuations).
 */
function parseF1EventBlock(eventBlock) {
  const rawLines = eventBlock.split('\n');

  // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuations)
  const lines = [];
  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.match(/^[ \t]/) && lines.length > 0) {
      lines[lines.length - 1] += line.substring(1);
    } else {
      lines.push(line);
    }
  }

  const event = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('SUMMARY:')) {
      let title = trimmed.substring(8).trim();
      // Strip leading "F1: " from feed titles to avoid redundancy with [F1] prefix
      if (title.startsWith('F1: ')) {
        title = title.substring(4);
      }
      event.title = title;
    } else if (trimmed.startsWith('DTSTART')) {
      event.startTime = parseF1ICSDateTime(trimmed);
    } else if (trimmed.startsWith('DTEND')) {
      event.endTime = parseF1ICSDateTime(trimmed);
    } else if (trimmed.startsWith('LOCATION:')) {
      event.location = trimmed.substring(9).trim()
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\\\/g, '\\')
        .replace(/\\;/g, ';')
        .trim();
    } else if (trimmed.startsWith('DESCRIPTION:')) {
      event.description = trimmed.substring(12).trim()
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\\\/g, '\\')
        .replace(/\\;/g, ';')
        .trim();
    }
  }

  if (event.title && event.startTime) {
    event.uid = createF1StableUID(event);
    return event;
  }

  return null;
}

/**
 * Parses ICS datetime, handling both UTC (Z suffix) and local times.
 * F1 ICS feeds typically use UTC times.
 */
function parseF1ICSDateTime(line) {
  const dateMatch = line.match(/(\d{8}T\d{6})(Z?)/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const isUTC = dateMatch[2] === 'Z';

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15));

    if (isUTC) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }
  return null;
}

/**
 * Filters to only race and sprint events.
 * Excludes practice sessions, qualifying, and other non-race events.
 */
function isRaceOrSprint(event) {
  const title = (event.title || '').toLowerCase();

  // Exclude practice and qualifying sessions
  if (title.includes('practice') || title.includes('fp1') || title.includes('fp2') || title.includes('fp3')) {
    return false;
  }
  if (title.includes('qualifying') || title.includes('quali')) {
    return false;
  }

  // Include races and sprints
  if (title.includes('race') || title.includes('grand prix') || title.includes('sprint')) {
    return true;
  }

  // If it got past the ICS feed filter but doesn't match known patterns, include it
  // (the ICS feed is already filtered to races+sprints)
  return true;
}

// ============ CALENDAR MANAGEMENT ============

function getExistingF1Events(calendar) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const endDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));

  const events = calendar.getEvents(startDate, endDate);
  return events.filter(event =>
    event.getTitle().startsWith(CONFIG.F1_EVENT_PREFIX) &&
    event.getDescription() &&
    event.getDescription().includes('F1-UID:')
  );
}

function processF1Events(calendar, f1Events, existingEvents) {
  const results = { added: 0, updated: 0, removed: 0, unchanged: 0 };

  const f1EventMap = new Map();
  f1Events.forEach(event => f1EventMap.set(event.uid, event));

  const existingEventMap = new Map();
  existingEvents.forEach(event => {
    const uid = extractF1UID(event.getDescription());
    if (uid) {
      existingEventMap.set(uid, event);
    }
  });

  // Add or update events
  f1Events.forEach(f1Event => {
    const existingEvent = existingEventMap.get(f1Event.uid);

    if (existingEvent) {
      if (f1NeedsUpdate(existingEvent, f1Event)) {
        updateF1Event(existingEvent, f1Event);
        results.updated++;
        Utilities.sleep(300);
      } else {
        results.unchanged++;
      }
    } else {
      createF1Event(calendar, f1Event);
      results.added++;
      Utilities.sleep(300);
    }
  });

  // Remove events no longer in the feed
  existingEvents.forEach(existingEvent => {
    const uid = extractF1UID(existingEvent.getDescription());
    if (uid && !f1EventMap.has(uid)) {
      console.log(`Removing: "${existingEvent.getTitle()}" (UID: ${uid})`);
      existingEvent.deleteEvent();
      results.removed++;
      Utilities.sleep(300);
    }
  });

  return results;
}

function createF1Event(calendar, f1Event) {
  const title = CONFIG.F1_EVENT_PREFIX + f1Event.title;
  const endTime = f1Event.endTime || new Date(f1Event.startTime.getTime() + 2 * 60 * 60 * 1000);
  const description = (f1Event.description ? f1Event.description + '\n\n' : '') +
    `F1-UID: ${f1Event.uid}`;

  calendar.createEvent(title, f1Event.startTime, endTime, {
    description: description,
    location: f1Event.location || ''
  });

  console.log(`Created: "${title}" on ${f1Event.startTime.toDateString()}`);
}

function updateF1Event(existingEvent, f1Event) {
  const title = CONFIG.F1_EVENT_PREFIX + f1Event.title;
  const endTime = f1Event.endTime || new Date(f1Event.startTime.getTime() + 2 * 60 * 60 * 1000);
  const description = (f1Event.description ? f1Event.description + '\n\n' : '') +
    `F1-UID: ${f1Event.uid}`;

  existingEvent.setTitle(title);
  existingEvent.setTime(f1Event.startTime, endTime);
  existingEvent.setDescription(description);
  existingEvent.setLocation(f1Event.location || '');

  console.log(`Updated: "${title}"`);
}

function f1NeedsUpdate(existingEvent, f1Event) {
  const expectedTitle = CONFIG.F1_EVENT_PREFIX + f1Event.title;
  const expectedEndTime = f1Event.endTime || new Date(f1Event.startTime.getTime() + 2 * 60 * 60 * 1000);

  if (existingEvent.getTitle() !== expectedTitle) return true;

  const startDiff = Math.abs(existingEvent.getStartTime().getTime() - f1Event.startTime.getTime());
  if (startDiff > 300000) return true;

  const endDiff = Math.abs(existingEvent.getEndTime().getTime() - expectedEndTime.getTime());
  if (endDiff > 300000) return true;

  const existingLocation = (existingEvent.getLocation() || '').toLowerCase().trim();
  const newLocation = (f1Event.location || '').toLowerCase().trim();
  if (existingLocation !== newLocation) return true;

  return false;
}

function extractF1UID(description) {
  if (!description) return null;
  const match = description.match(/F1-UID:\s*([^\n\r\s]+)/);
  return match ? match[1].trim() : null;
}

// ============ SETUP FUNCTIONS ============

function setupF1Sync() {
  console.log('Setting up F1 calendar sync...');

  const calendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  if (!calendar) {
    throw new Error('Cannot access family calendar. Check the calendar ID and permissions.');
  }

  try {
    UrlFetchApp.fetch(CONFIG.F1_CALENDAR_URL);
    console.log('F1 calendar URL is accessible');
  } catch (error) {
    throw new Error('Cannot access F1 calendar URL: ' + error.toString());
  }

  syncF1Calendar();

  console.log('F1 setup complete! Run setupF1Triggers() to enable automatic syncing.');
}

function setupF1Triggers() {
  console.log('Setting up F1 sync triggers...');

  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncF1Calendar') {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
    }
  });
  if (deleted > 0) console.log(`Deleted ${deleted} existing F1 trigger(s)`);

  const newTrigger = ScriptApp.newTrigger('syncF1Calendar')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  console.log(`Created daily F1 sync trigger (runs at ~6 AM): ${newTrigger.getUniqueId()}`);
}

function getF1SyncStatus() {
  const lastSync = PropertiesService.getScriptProperties().getProperty('lastF1SyncTime');
  console.log('Last F1 sync:', lastSync ? new Date(lastSync) : 'Never');

  const triggers = ScriptApp.getProjectTriggers();
  const f1Triggers = triggers.filter(t => t.getHandlerFunction() === 'syncF1Calendar');
  console.log('Active F1 triggers:', f1Triggers.length);

  return { lastSync: lastSync, triggersActive: f1Triggers.length > 0 };
}
