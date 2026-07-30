const pushService = require('../services/pushService');
const { getLogger } = require('../lib/logger');

const logger = getLogger('push');

function publicKey(_req, res) {
  if (!pushService.PUSH_ENABLED) return res.status(503).json({ error: 'Push is not configured' });
  res.json({ publicKey: pushService.VAPID_PUBLIC_KEY });
}

async function subscribe(req, res) {
  if (!pushService.PUSH_ENABLED) return res.status(503).json({ error: 'Push is not configured' });
  const sub = req.body || {};
  if (!pushService.isSafeSubscription(sub)) return res.status(400).json({ error: 'Invalid subscription' });

  try {
    await pushService.subscribe(sub);
    logger.info('push.subscribed', { requestId: req.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error('push.subscribe_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to save subscription' });
  }
}

async function unsubscribe(req, res) {
  const endpoint = req.body && req.body.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ error: 'endpoint is required' });
  try {
    await pushService.unsubscribe(endpoint);
    logger.info('push.unsubscribed', { requestId: req.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error('push.unsubscribe_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
}

// Sends today's reminder immediately, bypassing the schedule — a way to test
// end-to-end delivery without waiting for REMINDER_TIME. Dev/staging only:
// not reachable at all in production, regardless of session/CSRF (see routes/pushRoutes.js).
async function sendTest(req, res) {
  if (!pushService.PUSH_ENABLED) return res.status(503).json({ error: 'Push is not configured' });
  try {
    await pushService.sendDailyReminders();
    res.json({ ok: true });
  } catch (err) {
    logger.error('push.test_send_failed', { requestId: req.id, err: err.message });
    res.status(500).json({ error: 'Failed to send test notification' });
  }
}

module.exports = { publicKey, subscribe, unsubscribe, sendTest };
