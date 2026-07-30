const { Logger } = require('tslog');

const root = new Logger({
  name: 'willow',
  type: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  minLevel: levelToMinLevel(process.env.LOG_LEVEL || 'info')
});

function levelToMinLevel(level) {
  const levels = { silly: 0, trace: 1, debug: 2, info: 3, warn: 4, error: 5, fatal: 6 };
  return levels[level] ?? levels.info;
}

function getLogger(domain) {
  return root.getSubLogger({ name: domain });
}

module.exports = { getLogger };
