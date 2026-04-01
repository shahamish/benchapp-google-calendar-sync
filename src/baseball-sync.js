/**
 * Baseball Calendar Sync Script
 * Syncs baseball league events from Team Manager ICS feed to Google Calendar
 * Data source: Team Manager webcal ICS feed
 */

// Configuration is imported from config.js file (config.gs in Google Apps Script)
// Required config keys: FAMILY_CALENDAR_ID, BASEBALL_CALENDAR_URL, BASEBALL_EVENT_PREFIX

// ============ STABLE UID GENERATION ============

function createBaseballStableUID(event) {
  const title = (event.title || '').trim();
  const startTime = event.startTime ? event.startTime.getTime().toString() : '';
  const location = (event.location || '').trim();

  const stableString = `baseball|${title}|${startTime}|${location}`;

  let hash = 0;
  for (let i = 0; i < stableString.length; i++) {
    const char = stableString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `baseball-stable-${Math.abs(hash)}`;
}

// ============ MAIN SYNC FUNCTION ============

function syncBaseballCalendar() {
  try {
    console.log(`=== Baseball Calendar Sync Started at ${new Date().toISOString()} ===`);

    const calendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
    if (!calendar) {
      throw new Error('Family calendar not found. Check your FAMILY_CALENDAR_ID.');
    }

    const baseballEvents = fetchBaseballEvents();
    if (baseballEvents === null) {
      console.error('Cannot fetch baseball calendar data - aborting sync');
      throw new Error('Baseball calendar fetch failed - sync aborted');
    }

    console.log(`Fetched ${baseballEvents.length} events from baseball calendar`);

    // Sync window: 7 days back through 90 days ahead
    const now = new Date();
    const windowStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const windowEnd = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));

    const filteredEvents = baseballEvents.filter(event =>
      event.startTime >= windowStart && event.startTime <= windowEnd
    );
    console.log(`${filteredEvents.length} events within sync window`);

    const existingEvents = getExistingBaseballEvents(calendar);
    console.log(`Found ${existingEvents.length} existing baseball events in calendar`);

    const results = processBaseballEvents(calendar, filteredEvents, existingEvents);

    console.log(`=== Baseball Sync Complete: ${results.added} added, ${results.updated} updated, ${results.removed} removed, ${results.unchanged} unchanged ===`);

    PropertiesService.getScriptProperties().setProperty('lastBaseballSyncTime', new Date().toISOString());

    return results;

  } catch (error) {
    console.error('Baseball sync failed:', error);
    throw error;
  }
}

// ============ FETCH & PARSE ============

function fetchBaseballEvents() {
  try {
    // Convert webcal:// to https:// for fetching
    const url = CONFIG.BASEBALL_CALENDAR_URL.replace(/^webcal:\/\//, 'https://');
    const response = UrlFetchApp.fetch(url);

    if (response.getResponseCode() !== 200) {
      console.error(`Baseball calendar returned error code: ${response.getResponseCode()}`);
      return null;
    }

    const icsData = response.getContentText();

    if (!icsData || !icsData.includes('BEGIN:VCALENDAR')) {
      console.error('Invalid ICS data received from baseball calendar');
      return null;
    }

    return parseBaseballICSData(icsData);

  } catch (error) {
    console.error('Failed to fetch baseball calendar:', error);
    return null;
  }
}

function parseBaseballICSData(icsData) {
  const events = [];
  const eventBlocks = icsData.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const eventBlock = eventBlocks[i].split('END:VEVENT')[0];
    const event = parseBaseballEventBlock(eventBlock);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Parses an individual VEVENT block from ICS data.
 * Handles multi-line folded fields (lines starting with a space are continuations).
 */
function parseBaseballEventBlock(eventBlock) {
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
      event.title = trimmed.substring(8).trim();
    } else if (trimmed.startsWith('DTSTART')) {
      event.startTime = parseBaseballICSDateTime(trimmed);
    } else if (trimmed.startsWith('DTEND')) {
      event.endTime = parseBaseballICSDateTime(trimmed);
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
    event.uid = createBaseballStableUID(event);
    return event;
  }

  return null;
}

/**
 * Parses ICS datetime, handling both UTC (Z suffix) and local times.
 */
function parseBaseballICSDateTime(line) {
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

// ============ CALENDAR MANAGEMENT ============

function getExistingBaseballEvents(calendar) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const endDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));

  const events = calendar.getEvents(startDate, endDate);
  return events.filter(event =>
    event.getTitle().startsWith(CONFIG.BASEBALL_EVENT_PREFIX) &&
    event.getDescription() &&
    event.getDescription().includes('Baseball-UID:')
  );
}

function processBaseballEvents(calendar, baseballEvents, existingEvents) {
  const results = { added: 0, updated: 0, removed: 0, unchanged: 0 };

  const baseballEventMap = new Map();
  baseballEvents.forEach(event => baseballEventMap.set(event.uid, event));

  const existingEventMap = new Map();
  existingEvents.forEach(event => {
    const uid = extractBaseballUID(event.getDescription());
    if (uid) {
      existingEventMap.set(uid, event);
    }
  });

  // Add or update events
  baseballEvents.forEach(baseballEvent => {
    const existingEvent = existingEventMap.get(baseballEvent.uid);

    if (existingEvent) {
      if (baseballNeedsUpdate(existingEvent, baseballEvent)) {
        updateBaseballEvent(existingEvent, baseballEvent);
        results.updated++;
        Utilities.sleep(300);
      } else {
        results.unchanged++;
      }
    } else {
      createBaseballEvent(calendar, baseballEvent);
      results.added++;
      Utilities.sleep(300);
    }
  });

  // Remove events no longer in the feed
  existingEvents.forEach(existingEvent => {
    const uid = extractBaseballUID(existingEvent.getDescription());
    if (uid && !baseballEventMap.has(uid)) {
      console.log(`Removing: "${existingEvent.getTitle()}" (UID: ${uid})`);
      existingEvent.deleteEvent();
      results.removed++;
      Utilities.sleep(300);
    }
  });

  return results;
}

function createBaseballEvent(calendar, baseballEvent) {
  const title = CONFIG.BASEBALL_EVENT_PREFIX + baseballEvent.title;
  const endTime = baseballEvent.endTime || new Date(baseballEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  const description = (baseballEvent.description ? baseballEvent.description + '\n\n' : '') +
    `Baseball-UID: ${baseballEvent.uid}`;

  calendar.createEvent(title, baseballEvent.startTime, endTime, {
    description: description,
    location: baseballEvent.location || ''
  });

  console.log(`Created: "${title}" on ${baseballEvent.startTime.toDateString()}`);
}

function updateBaseballEvent(existingEvent, baseballEvent) {
  const title = CONFIG.BASEBALL_EVENT_PREFIX + baseballEvent.title;
  const endTime = baseballEvent.endTime || new Date(baseballEvent.startTime.getTime() + 2 * 60 * 60 * 1000);
  const description = (baseballEvent.description ? baseballEvent.description + '\n\n' : '') +
    `Baseball-UID: ${baseballEvent.uid}`;

  existingEvent.setTitle(title);
  existingEvent.setTime(baseballEvent.startTime, endTime);
  existingEvent.setDescription(description);
  existingEvent.setLocation(baseballEvent.location || '');

  console.log(`Updated: "${title}"`);
}

function baseballNeedsUpdate(existingEvent, baseballEvent) {
  const expectedTitle = CONFIG.BASEBALL_EVENT_PREFIX + baseballEvent.title;
  const expectedEndTime = baseballEvent.endTime || new Date(baseballEvent.startTime.getTime() + 2 * 60 * 60 * 1000);

  if (existingEvent.getTitle() !== expectedTitle) return true;

  const startDiff = Math.abs(existingEvent.getStartTime().getTime() - baseballEvent.startTime.getTime());
  if (startDiff > 300000) return true;

  const endDiff = Math.abs(existingEvent.getEndTime().getTime() - expectedEndTime.getTime());
  if (endDiff > 300000) return true;

  const existingLocation = (existingEvent.getLocation() || '').toLowerCase().trim();
  const newLocation = (baseballEvent.location || '').toLowerCase().trim();
  if (existingLocation !== newLocation) return true;

  return false;
}

function extractBaseballUID(description) {
  if (!description) return null;
  const match = description.match(/Baseball-UID:\s*([^\n\r\s]+)/);
  return match ? match[1].trim() : null;
}

// ============ SETUP FUNCTIONS ============

function setupBaseballSync() {
  console.log('Setting up baseball calendar sync...');

  const calendar = CalendarApp.getCalendarById(CONFIG.FAMILY_CALENDAR_ID);
  if (!calendar) {
    throw new Error('Cannot access family calendar. Check the calendar ID and permissions.');
  }

  try {
    const url = CONFIG.BASEBALL_CALENDAR_URL.replace(/^webcal:\/\//, 'https://');
    UrlFetchApp.fetch(url);
    console.log('Baseball calendar URL is accessible');
  } catch (error) {
    throw new Error('Cannot access baseball calendar URL: ' + error.toString());
  }

  syncBaseballCalendar();

  console.log('Baseball setup complete! Run setupBaseballTriggers() to enable automatic syncing.');
}

function setupBaseballTriggers() {
  console.log('Setting up baseball sync triggers...');

  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncBaseballCalendar') {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
    }
  });
  if (deleted > 0) console.log(`Deleted ${deleted} existing baseball trigger(s)`);

  const newTrigger = ScriptApp.newTrigger('syncBaseballCalendar')
    .timeBased()
    .everyHours(6)
    .create();

  console.log(`Created baseball sync trigger (runs every 6 hours): ${newTrigger.getUniqueId()}`);
}

function getBaseballSyncStatus() {
  const lastSync = PropertiesService.getScriptProperties().getProperty('lastBaseballSyncTime');
  console.log('Last baseball sync:', lastSync ? new Date(lastSync) : 'Never');

  const triggers = ScriptApp.getProjectTriggers();
  const baseballTriggers = triggers.filter(t => t.getHandlerFunction() === 'syncBaseballCalendar');
  console.log('Active baseball triggers:', baseballTriggers.length);

  return { lastSync: lastSync, triggersActive: baseballTriggers.length > 0 };
}
