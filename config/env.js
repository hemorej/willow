// Central place that reads the environment. Requiring this module has side
// effects: it logs a warning for each missing/invalid setting and derives a
// few flags (STATIC_DIR, PUSH_ENABLED). Missing secrets fall back to safe
// dev defaults (an ephemeral SESSION_SECRET, push disabled) rather than throwing.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getLogger } = require('../lib/logger');

const logger = getLogger('config');

const PORT = process.env.PORT || 3000;

// Serve the built, content-hashed assets from dist/ when present (production),
// otherwise the raw sources in public/ (local dev with no build step).
const DIST_DIR = path.join(__dirname, '..', 'dist');
const STATIC_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : path.join(__dirname, '..', 'public');

// A generated secret works but invalidates every existing session on restart.
if (!process.env.SESSION_SECRET) {
  logger.warn('config.session_secret_missing');
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || '';
const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

// Reminder fires once daily at this server-local time (24h "HH:MM").
// Set the standard TZ env var if the server isn't already in your timezone.
const REMINDER_TIME = process.env.REMINDER_TIME || '20:00';
const REMINDER_MATCH = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(REMINDER_TIME);
if (!REMINDER_MATCH) logger.warn('config.reminder_time_invalid', { reminderTime: REMINDER_TIME });

module.exports = {
  PORT,
  STATIC_DIR,
  SESSION_SECRET,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  PUSH_ENABLED,
  REMINDER_TIME,
  REMINDER_MATCH
};
