require('dotenv').config({ quiet: true });

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const RateLimit = require('express-rate-limit');
const pool = require('./db');
const { initDb } = require('./migrate');

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
  const id = req.params.id.replace(/[^a-zA-Z0-9_\-]/g, '');
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

  if (!date) return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required' });
  if (!text && mood === null) return res.status(400).json({ error: 'Write something or pick a mood' });

  const order = Date.now();
  const id = `journal-${order}-${crypto.randomBytes(4).toString('hex')}`;
  const record = { id, date, order, text: text || null, mood, gratitude, gratitudeTag };

  try {
    await pool.query(
      'INSERT INTO journal_entries (id, entry_date, entry_order, mood, body, gratitude, gratitude_tag, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, date, order, mood, text || null, gratitude, gratitudeTag, record]
    );
    res.json({ ok: true, entry: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save entry' });
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
      text: r.body,
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

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`willow app running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
