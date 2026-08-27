// Web Push (VAPID) subscriptions and the once-a-day reminder that fans out to
// every stored subscription. Inert unless all three VAPID_* env vars are set
// (PUSH_ENABLED); callers still guard on PUSH_ENABLED before hitting these.

const webpush = require('web-push');
const pool = require('../db');
const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  PUSH_ENABLED,
  REMINDER_TIME,
  REMINDER_MATCH
} = require('../config/env');
const { getLogger } = require('../lib/logger');

const logger = getLogger('push');

if (PUSH_ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  logger.warn('push.disabled', { reason: 'vapid_keys_missing' });
}

// Push subscription endpoints are URLs the server will POST to unattended,
// once a day, forever. Restrict them to the known browser push vendors so a
// hijacked/malformed subscription can't be used to make the server send
// arbitrary outbound requests (SSRF).
const ALLOWED_PUSH_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,          // Chrome, Edge, Android
  /(^|\.)updates\.push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)push\.apple\.com$/               // Safari / iOS
];

/**
 * Validate a PushSubscription from the client before storing it: HTTPS endpoint
 * on a known browser-vendor host (SSRF guard, see ALLOWED_PUSH_HOSTS) and
 * base64url keys within sane length bounds.
 *
 * @param {any} sub
 * @returns {boolean}
 */
function isSafeSubscription(sub) {
  if (!sub || typeof sub.endpoint !== 'string') return false;
  let url;
  try {
    url = new URL(sub.endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (!ALLOWED_PUSH_HOSTS.some((re) => re.test(url.hostname))) return false;
  const keys = sub.keys || {};
  const B64URL = /^[A-Za-z0-9_-]+$/;
  if (typeof keys.p256dh !== 'string' || keys.p256dh.length > 200 || !B64URL.test(keys.p256dh)) return false;
  if (typeof keys.auth !== 'string' || keys.auth.length > 100 || !B64URL.test(keys.auth)) return false;
  return true;
}

/**
 * Upsert a (pre-validated) subscription, keyed by its endpoint URL.
 * @param {{endpoint: string, keys: {p256dh: string, auth: string}}} sub
 */
async function subscribe(sub) {
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
}

/**
 * Remove a subscription by endpoint (no-op if it isn't stored).
 * @param {string} endpoint
 */
async function unsubscribe(endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

// Reused from GRATITUDE_PROMPTS in public/gratitude.js (prompt text only) so
// the daily nudge reads like the rest of the app instead of generic copy.
// Kept in sync with public/gratitude.js, same as GRATITUDE_TAGS in journalService.
const REMINDER_MESSAGES = [
  'What did you savour today?',
  'What made you proud today?',
  'What are you looking forward to?',
  'What made you smile today?',
  'What made today a good day?',
  "What's something kind someone did for you today?",
  'Who are you thankful for today?',
  'What small comfort did you enjoy?',
  'What went better than expected?',
  'What in your day felt like a gift?',
  'What are you glad you have right now?',
  'What beauty did you notice today?'
];

/**
 * Send one randomly-chosen reminder message to every stored subscription.
 * Subscriptions the push service reports as gone (404/410) are deleted;
 * other failures are logged and skipped. Never throws.
 */
async function sendDailyReminders() {
  const { rows } = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions');
  const body = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
  const payload = JSON.stringify({ title: 'willow', body });

  for (const row of rows) {
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      const result = await webpush.sendNotification(subscription, payload);
      logger.info('push.sent', { subscriptionId: row.id, statusCode: result.statusCode });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or was revoked on the client — stop targeting it.
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
        logger.info('push.subscription_removed', { subscriptionId: row.id, reason: 'stale' });
      } else {
        logger.error('push.send_failed', { subscriptionId: row.id, statusCode: err.statusCode, err: err.message });
      }
    }
  }
}

/**
 * Milliseconds from now until the next server-local occurrence of hour:minute
 * (today if still ahead, otherwise tomorrow).
 * @param {number} hour @param {number} minute @returns {number}
 */
function msUntilNext(hour, minute) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Start the self-rescheduling daily-reminder timer (called once at boot).
 * No-op when push is disabled or REMINDER_TIME is malformed.
 */
function scheduleDailyReminder() {
  if (!PUSH_ENABLED || !REMINDER_MATCH) return;
  const hour = Number(REMINDER_MATCH[1]);
  const minute = Number(REMINDER_MATCH[2]);

  function scheduleNext() {
    // Recomputed on every firing (rather than a fixed 24h interval) so the
    // schedule self-corrects across DST changes and any clock drift.
    setTimeout(async () => {
      try {
        await sendDailyReminders();
      } catch (err) {
        logger.error('push.reminder_run_failed', { err: err.message });
      }
      scheduleNext();
    }, msUntilNext(hour, minute));
  }

  scheduleNext();
  logger.info('push.reminder_scheduled', { reminderTime: REMINDER_TIME });
}

module.exports = {
  PUSH_ENABLED,
  VAPID_PUBLIC_KEY,
  isSafeSubscription,
  subscribe,
  unsubscribe,
  sendDailyReminders,
  scheduleDailyReminder
};
