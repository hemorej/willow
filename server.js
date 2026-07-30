require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const pool = require('./db');
const { initDb } = require('./migrate');
const { PORT, STATIC_DIR, SESSION_SECRET } = require('./config/env');
const { globalLimiter } = require('./middleware/rateLimit');
const { requireAuth } = require('./middleware/auth');
const routes = require('./routes');
const { scheduleDailyReminder } = require('./services/pushService');

const app = express();

app.disable('x-powered-by');

// Trust the nginx reverse proxy so rate limiting uses the real client IP.
app.set('trust proxy', 1);

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

app.use(globalLimiter);
app.use(requireAuth);
app.use(express.static(STATIC_DIR, { maxAge: '1d' }));
app.get('/login', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'login.html')));

app.use(routes);

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
