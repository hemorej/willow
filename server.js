require('dotenv').config({ quiet: true });

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const RateLimit = require('express-rate-limit');
const webpush = require('web-push');
const pool = require('./db');
const { initDb } = require('./migrate');
const journalCrypto = require('./lib/journal-crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Trust the nginx reverse proxy so rate limiting uses the real client IP.
app.set('trust proxy', 1);

const globalLimiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function validateCsrf(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

const CBT_SAFE_FILENAME = /^thought-record-[0-9A-Za-z\-]+\.json$/;
const BDI_SAFE_ID = /^bdi2-[0-9A-Za-z\-]+$/;

function cbtSummarize(record) {
  const candidates = [record.situation, record.automaticThought, record.adaptiveResponse];
  const first = candidates.find((v) => v && String(v).trim());
  const text = first ? String(first).trim() : '(no description)';
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > 140 ? oneLine.slice(0, 137) + '…' : oneLine;
}

const DIST_DIR = path.join(__dirname, 'dist');
const STATIC_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : path.join(__dirname, 'public');

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET not set — sessions will not survive restarts');
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// ---------------------------------------------------------------------------
// Web Push (daily reminder)
// ---------------------------------------------------------------------------

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || '';
const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('VAPID keys not set — push reminders are disabled');
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

// Reminder fires once daily at this server-local time (24h "HH:MM").
// Set the standard TZ env var if the server isn't already in your timezone.
const REMINDER_TIME = process.env.REMINDER_TIME || '20:00';
const REMINDER_MATCH = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(REMINDER_TIME);
if (!REMINDER_MATCH) console.warn(`REMINDER_TIME "${REMINDER_TIME}" is invalid — expected "HH:MM"`);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));

// lgtm[js/missing-token-validation] -- CSRF is handled by validateCsrf on all mutation routes; sameSite:strict provides browser-level protection
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // primary CSRF defense: blocks cookie on cross-site requests
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

const PUBLIC_PATHS = new Set(['/login', '/login.html', '/style.css', '/theme.js', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/manifest.json', '/robots.txt']);

function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path) || req.path.startsWith('/fonts/')) return next();
  if (req.path === '/api/login' || req.path === '/api/logout') return next();
  if (req.session.userId) return next();
  if (!req.path.startsWith('/api/')) {
    return res.redirect(`/login?next=${encodeURIComponent(req.path)}`);
  }
  res.status(401).json({ error: 'Unauthorized' });
}

app.use(globalLimiter);
app.use(requireAuth);
app.use(express.static(STATIC_DIR, { maxAge: '1d' }));
app.get('/login', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'login.html')));

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password, next: nextPath } = req.body;
  if (!username || !password) return res.redirect('/login?error=1');
  try {
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM users WHERE username = $1',
      [String(username).trim()]
    );
    if (!rows.length) return res.redirect('/login?error=1');
    const ok = await bcrypt.compare(String(password), rows[0].password_hash);
    if (!ok) return res.redirect('/login?error=1');
    req.session.userId = rows[0].id;
    ensureCsrfToken(req); // pre-generate token so it's ready for post-login XHR
    // (?!\/) negative lookahead blocks protocol-relative URLs like //evil.com
    const safe = /^\/(?!\/)[a-zA-Z0-9_\-./?=&]*$/.test(nextPath) ? nextPath : '/';
    res.redirect(safe);
  } catch (err) {
    console.error(err);
    res.redirect('/login?error=1');
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

// ---------------------------------------------------------------------------
// BDI-II routes
// ---------------------------------------------------------------------------

app.post('/api/results', validateCsrf, async (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.answers)) {
    return res.status(400).json({ error: 'answers array is required' });
  }

  const now = new Date();
  const iso = now.toISOString();
  const id = `bdi2-${iso.replace(/[:.]/g, '-')}`;
  const totalScore = body.answers.reduce((sum, a) => sum + (Number(a && a.score) || 0), 0);

  const record = {
    id,
    takenAt: iso,
    totalScore,
    severity: body.severity || null,
    answers: body.answers,
    note: body.note || null,
    meta: { questionCount: body.answers.length, skippedQuestion9: true, maxPossibleScore: 60 }
  };

  try {
    await pool.query(
      'INSERT INTO bdi_results (id, taken_at, total_score, severity, note, data) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, iso, totalScore, body.severity || null, body.note || null, record]
    );
    res.json({ ok: true, id, totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

app.get('/api/results', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, taken_at, total_score, severity, note FROM bdi_results ORDER BY taken_at DESC'
    );
    const results = rows.map((r) => ({
      id: r.id,
      takenAt: r.taken_at,
      totalScore: r.total_score,
      severity: r.severity,
      note: r.note
    }));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read results' });
  }
});

app.get('/api/results/:id', async (req, res) => {
  const { id } = req.params;
  if (!BDI_SAFE_ID.test(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const { rows } = await pool.query('SELECT data FROM bdi_results WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0].data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read result' });
  }
});

// ---------------------------------------------------------------------------
// CBT routes
// ---------------------------------------------------------------------------

app.post('/api/cbt/submit', validateCsrf, async (req, res) => {
  const body = req.body || {};
  const now = new Date();
  const filename = `thought-record-${now.toISOString().replace(/[:.]/g, '-')}.json`;
  const record = { savedAt: now.toISOString(), ...body };

  try {
    await pool.query(
      'INSERT INTO cbt_entries (filename, saved_at, data) VALUES ($1, $2, $3)',
      [filename, record.savedAt, record]
    );
    res.json({ ok: true, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to save record' });
  }
});

app.get('/api/cbt/entries', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT filename, saved_at, data FROM cbt_entries ORDER BY saved_at DESC'
    );
    const entries = rows.map((r) => ({
      filename: r.filename,
      savedAt: r.saved_at,
      datetime: r.data.datetime || null,
      summary: cbtSummarize(r.data),
      emotion: r.data.emotion || null,
      emotionIntensity: typeof r.data.emotionIntensity === 'number' ? r.data.emotionIntensity : null
    }));
    res.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
});

app.get('/api/cbt/entries/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!CBT_SAFE_FILENAME.test(filename)) {
    return res.status(400).json({ ok: false, error: 'Invalid filename' });
  }
  try {
    const { rows } = await pool.query('SELECT data FROM cbt_entries WHERE filename = $1', [filename]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, filename, record: rows[0].data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entry' });
  }
});

// ---------------------------------------------------------------------------
// Journal routes
// ---------------------------------------------------------------------------

const JOURNAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Kept in sync with public/gratitude.js — used to validate that a saved
// gratitude tag actually corresponds to one of the rotating prompts.
const GRATITUDE_TAGS = new Set([
  'Something I savoured',
  "Something I'm proud of",
  "Something I'm looking forward to",
  'Something that made me smile',
  'What made today good',
  'A kindness I received',
  "Someone I'm thankful for",
  'A small comfort',
  'Something that went well',
  'Something that felt like a gift',
  "Something I'm glad to have",
  'Beauty I noticed'
]);

app.post('/api/journal/entries', validateCsrf, async (req, res) => {
  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const mood = Number.isInteger(body.mood) && body.mood >= 0 && body.mood <= 4 ? body.mood : null;
  const date = typeof body.date === 'string' && JOURNAL_DATE.test(body.date) ? body.date : null;
  const gratitude = body.gratitude === true;
  const gratitudeTag = gratitude && typeof body.gratitudeTag === 'string' && GRATITUDE_TAGS.has(body.gratitudeTag)
    ? body.gratitudeTag
    : null;
  const followupId = Number.isInteger(body.followupId) ? body.followupId : null;
  const followupAnswer = typeof body.followupAnswer === 'string' && body.followupAnswer.trim()
    ? body.followupAnswer.trim()
    : null;

  if (!date) return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required' });
  if (!text && mood === null) return res.status(400).json({ error: 'Write something or pick a mood' });

  const order = Date.now();
  const id = `journal-${order}-${crypto.randomBytes(4).toString('hex')}`;
  const record = { id, date, order, text: text || null, mood, gratitude, gratitudeTag };

  try {
    await pool.query(
      'INSERT INTO journal_entries (id, entry_date, entry_order, mood, body, gratitude, gratitude_tag, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, date, order, mood, journalCrypto.encryptText(text || null), gratitude, gratitudeTag, journalCrypto.encryptJSON(record)]
    );

    if (followupId !== null) {
      await pool.query(
        'UPDATE journal_followups SET entry_id = $1, answer = $2 WHERE id = $3 AND entry_id IS NULL',
        [id, journalCrypto.encryptText(followupAnswer), followupId]
      );
    }

    res.json({ ok: true, entry: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

// ---------------------------------------------------------------------------
// Reflective followup prompts (self-compassion / ACT values)
// ---------------------------------------------------------------------------
//
// Shown occasionally on non-gratitude entries: never more than once a day,
// and forced on if a week has passed without one, otherwise a ~25% chance
// each time the compose view is saved. journal_followups logs every time
// the prompt is shown (regardless of whether it's answered) so eligibility
// can be computed from the last shown_date.

const FOLLOWUP_MIN_GAP_DAYS = 7;
const FOLLOWUP_CHANCE = 0.25;

const FOLLOWUP_QUESTIONS = {
  self_compassion: [
    'How can you show yourself kindness in this moment?',
    'What would you say to a friend who felt this way?',
    'What do you need to hear right now?',
    "Where can you offer yourself a little softness today?",
    "What's one way you could be gentler with yourself?",
    "What's something you're being hard on yourself about that you could set down?"
  ],
  act_values: [
    'What matters most to you in this moment?',
    'What small step today moved you toward the person you want to be?',
    'Which of your values felt most alive today?',
    'What would acting on your values look like right now, even if it feels uncomfortable?',
    'What can you make room for today, even alongside difficult feelings?',
    "What's something you did today that felt aligned with who you want to be?"
  ]
};

const FOLLOWUP_THEMES = Object.keys(FOLLOWUP_QUESTIONS);

app.post('/api/journal/followup-check', validateCsrf, async (req, res) => {
  const date = typeof req.body?.date === 'string' && JOURNAL_DATE.test(req.body.date) ? req.body.date : null;
  if (!date) return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required' });

  try {
    const { rows } = await pool.query(
      'SELECT shown_date::text AS shown_date FROM journal_followups ORDER BY shown_date DESC LIMIT 1'
    );
    const lastShown = rows[0]?.shown_date || null;

    if (lastShown === date) {
      return res.json({ show: false });
    }

    const daysSince = lastShown
      ? Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lastShown}T00:00:00Z`)) / 86400000)
      : Infinity;

    const show = daysSince >= FOLLOWUP_MIN_GAP_DAYS || Math.random() < FOLLOWUP_CHANCE;
    if (!show) return res.json({ show: false });

    const theme = FOLLOWUP_THEMES[Math.floor(Math.random() * FOLLOWUP_THEMES.length)];
    const questions = FOLLOWUP_QUESTIONS[theme];
    const question = questions[Math.floor(Math.random() * questions.length)];

    const { rows: inserted } = await pool.query(
      'INSERT INTO journal_followups (shown_date, theme, question) VALUES ($1, $2, $3) RETURNING id',
      [date, theme, question]
    );

    res.json({ show: true, id: inserted[0].id, theme, question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check followup eligibility' });
  }
});

app.get('/api/journal/entries', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, entry_date, entry_order, mood, body, gratitude, gratitude_tag FROM journal_entries ORDER BY entry_date DESC, entry_order DESC'
    );
    const entries = rows.map((r) => ({
      id: r.id,
      date: r.entry_date.toISOString().slice(0, 10),
      order: Number(r.entry_order),
      text: journalCrypto.decryptText(r.body),
      mood: r.mood,
      gratitude: r.gratitude,
      gratitudeTag: r.gratitude_tag
    }));
    res.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read entries' });
  }
});

app.patch('/api/journal/entries/:id', validateCsrf, async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Text cannot be empty' });

  try {
    const { rows } = await pool.query('SELECT data FROM journal_entries WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' });

    const data = { ...journalCrypto.decryptJSON(rows[0].data), text };
    await pool.query(
      'UPDATE journal_entries SET body = $1, data = $2 WHERE id = $3',
      [journalCrypto.encryptText(text), journalCrypto.encryptJSON(data), id]
    );
    res.json({ ok: true, text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// ---------------------------------------------------------------------------
// Push routes (daily reminder)
// ---------------------------------------------------------------------------

app.get('/api/push/public-key', (_req, res) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push is not configured' });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', validateCsrf, async (req, res) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push is not configured' });
  const sub = req.body || {};
  if (!isSafeSubscription(sub)) return res.status(400).json({ error: 'Invalid subscription' });

  try {
    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

app.post('/api/push/unsubscribe', validateCsrf, async (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ error: 'endpoint is required' });
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Sends today's reminder immediately, bypassing the schedule — a way to test
// end-to-end delivery without waiting for REMINDER_TIME. Dev/staging only:
// not reachable at all in production, regardless of session/CSRF.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/push/test', validateCsrf, async (_req, res) => {
    if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push is not configured' });
    try {
      await sendDailyReminders();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });
}

// ---------------------------------------------------------------------------
// Daily reminder scheduler
// ---------------------------------------------------------------------------

// Reused from GRATITUDE_PROMPTS in public/gratitude.js (prompt text only) so
// the daily nudge reads like the rest of the app instead of generic copy.
// Kept in sync with public/gratitude.js, same as GRATITUDE_TAGS above.
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

async function sendDailyReminders() {
  const { rows } = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions');
  const body = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
  const payload = JSON.stringify({ title: 'willow', body });

  for (const row of rows) {
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      const result = await webpush.sendNotification(subscription, payload);
      console.log(`Push sent to subscription ${row.id}: ${result.statusCode} ${JSON.stringify(row.endpoint)}`);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or was revoked on the client — stop targeting it.
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
      } else {
        console.error('Push send failed:', err.statusCode || err.message);
      }
    }
  }
}

function msUntilNext(hour, minute) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

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
        console.error('Daily reminder run failed:', err);
      }
      scheduleNext();
    }, msUntilNext(hour, minute));
  }

  scheduleNext();
  console.log(`Daily push reminder scheduled for ${REMINDER_TIME} (server local time)`);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  await initDb();
  scheduleDailyReminder();
  app.listen(PORT, () => {
    console.log(`willow app running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
