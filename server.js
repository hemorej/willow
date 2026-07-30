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
const { requestLog } = require('./middleware/requestLog');
const routes = require('./routes');
const { scheduleDailyReminder } = require('./services/pushService');
const { getLogger } = require('./lib/logger');

const logger = getLogger('server');
const app = express();

app.disable('x-powered-by');

// Trust the nginx reverse proxy so rate limiting uses the real client IP.
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(requestLog);

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
    logger.info('server.start', { port: PORT });
  });
}

start().catch((err) => {
  logger.error('server.start_failed', { err: err.message });
  process.exit(1);
});
