const RateLimit = require('express-rate-limit');

// Per-IP limiters (the app trusts one proxy hop — see `trust proxy` in server.js).

/** Broad limiter applied to every request: 300 / 15 min. */
const globalLimiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Tight limiter for POST /api/login only: 10 attempts / 15 min. */
const loginLimiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

module.exports = { globalLimiter, loginLimiter };
