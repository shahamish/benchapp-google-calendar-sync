// Sample configuration - copy and update with your details
const CONFIG = {
  // Find this in Google Calendar Settings > Your Calendar > Calendar ID
  FAMILY_CALENDAR_ID: 'your-family-calendar@group.calendar.google.com',

  // ============ Hockey Settings ============
  // One entry per BenchApp team. Get each URL from BenchApp > Team Calendar > Export/Subscribe.
  //   name:           label used in logs
  //   calendarUrl:    BenchApp ICS URL for that team
  //   eventPrefix:    prefix for that team's events in Google Calendar (must be unique per team)
  //   legacyPrefixes: (optional) older prefixes this team's events were created with.
  //                   Existing events matching one of these are retitled in place
  //                   instead of being duplicated when you rename a prefix.
  HOCKEY_TEAMS: [
    {
      name: 'Bodhi',
      calendarUrl: 'https://ics.benchapp.com/your-first-encoded-url',
      eventPrefix: '[Hockey - Bodhi] ',
      legacyPrefixes: ['[Hockey] ']
    },
    {
      name: 'Milo',
      calendarUrl: 'https://ics.benchapp.com/your-second-encoded-url',
      eventPrefix: '[Hockey - Milo] '
    }
  ],

  // Single-team configs from before HOCKEY_TEAMS existed still work:
  // HOCKEY_CALENDAR_URL: 'https://ics.benchapp.com/your-encoded-url',
  // EVENT_PREFIX: '[Hockey] ',

  // Date range settings (usually don't need to change)
  DAYS_LOOKBACK: 7,
  DAYS_LOOKAHEAD: 90,

  // ============ F1 Settings ============
  // ICS feed URL for F1 races + sprints (from f1calendar.com)
  // Visit https://f1calendar.com and select "Race" and "Sprint" sessions to generate your URL
  F1_CALENDAR_URL: 'https://f1calendar.com/download/f1-calendar_race_sprint.ics',

  // Prefix for F1 events in your calendar
  F1_EVENT_PREFIX: '[F1] ',

  // ============ Baseball Settings ============
  // ICS feed URL for baseball league (from Team Manager)
  // Note: webcal:// URLs are automatically converted to https:// for fetching
  BASEBALL_CALENDAR_URL: 'webcal://api.team-manager.gc.com/ics-calendar-documents/user/YOUR-USER-ID.ics?teamId=YOUR-TEAM-ID&token=YOUR-TOKEN',

  // Prefix for baseball events in your calendar
  BASEBALL_EVENT_PREFIX: '[Baseball] '
};

// Example BenchApp URLs (yours will be different):
// https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTE0NzY4NjMsInRlYW1JZCI6WzEyODY5ODBdfQ==
// https://ics.benchapp.com/eyJwbGF5ZXJJZCI6OTg3NjU0MzIsInRlYW1JZCI6WzU0MzIxMDBdfQ==
