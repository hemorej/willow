// Double-submit-style CSRF: a per-session random token the SPA fetches once
// (GET /api/csrf-token) and echoes back in the `x-csrf-token` header on every
// mutating request. sameSite:strict on the session cookie is the primary
// defense; this is defense in depth.

const crypto = require('crypto');

/**
 * Return this session's CSRF token, generating one on first use.
 * @param {import('express').Request} req
 * @returns {string}
 */
function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Route middleware for mutating endpoints: 403 unless the `x-csrf-token`
 * header exactly matches this session's token.
 */
// lgtm[js/missing-token-validation] -- CSRF is handled by validateCsrf on all mutation routes; sameSite:strict provides browser-level protection
function validateCsrf(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { ensureCsrfToken, validateCsrf };
