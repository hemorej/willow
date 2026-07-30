const crypto = require('crypto');

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

// lgtm[js/missing-token-validation] -- CSRF is handled by validateCsrf on all mutation routes; sameSite:strict provides browser-level protection
function validateCsrf(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { ensureCsrfToken, validateCsrf };
