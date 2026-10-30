/**
 * Configuration loader.
 *
 * The real settings (calendar ID, BenchApp/F1/baseball URLs, prefixes) live in
 * this Apps Script project's Script Properties under the key CONFIG_JSON, not
 * in this file. That way the file is safe to commit, and `clasp push --force`
 * from any machine can never wipe the live configuration.
 *
 * To view or change the settings:
 *   Apps Script editor > Project Settings (gear icon) > Script Properties > CONFIG_JSON
 * Run showConfig() to print the current settings in a readable form.
 * The shape of the JSON matches examples/sample-config.js.
 */
const CONFIG = (function loadConfig() {
  const raw = PropertiesService.getScriptProperties().getProperty('CONFIG_JSON');
  if (!raw) {
    throw new Error('Script Property CONFIG_JSON is not set. Add it under Project Settings > Script Properties (see README "Configuration").');
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Script Property CONFIG_JSON is not valid JSON: ' + error.message);
  }
})();

/**
 * Prints the current configuration from Script Properties.
 */
function showConfig() {
  console.log(JSON.stringify(CONFIG, null, 2));
}
