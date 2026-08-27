// App logging via tslog: pretty in dev, one-line JSON in production. Level is
// set once from LOG_LEVEL (default `info`). Separate from nginx access logs.

const { Logger } = require('tslog');

const root = new Logger({
  name: 'willow',
  type: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  minLevel: levelToMinLevel(process.env.LOG_LEVEL || 'info')
});

/** Map a level name to tslog's numeric `minLevel` (unknown names → info). */
function levelToMinLevel(level) {
  const levels = { silly: 0, trace: 1, debug: 2, info: 3, warn: 4, error: 5, fatal: 6 };
  return levels[level] ?? levels.info;
}

/**
 * Get a named sub-logger. Convention: `getLogger('<domain>')` per module, and
 * `<domain>.<action>` event-name strings with flat primitive attribute objects.
 * @param {string} domain
 */
function getLogger(domain) {
  return root.getSubLogger({ name: domain });
}

module.exports = { getLogger };
