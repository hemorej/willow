const authService = require('../services/authService');
const { ensureCsrfToken } = require('../middleware/csrf');
const { getLogger } = require('../lib/logger');

const logger = getLogger('auth');

async function login(req, res) {
  const { username, password, next: nextPath } = req.body;
  if (!username || !password) return res.redirect('/login?error=1');
  try {
    const userId = await authService.verifyCredentials(username, password);
    if (!userId) {
      logger.warn('auth.login_failed', { requestId: req.id, username });
      return res.redirect('/login?error=1');
    }
    req.session.userId = userId;
    ensureCsrfToken(req); // pre-generate token so it's ready for post-login XHR
    logger.info('auth.login_succeeded', { requestId: req.id, userId });
    // (?!\/) negative lookahead blocks protocol-relative URLs like //evil.com
    const safe = /^\/(?!\/)[a-zA-Z0-9_\-./?=&]*$/.test(nextPath) ? nextPath : '/';
    res.redirect(safe);
  } catch (err) {
    logger.error('auth.login_error', { requestId: req.id, err: err.message });
    res.redirect('/login?error=1');
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

function csrfToken(req, res) {
  res.json({ csrfToken: ensureCsrfToken(req) });
}

module.exports = { login, logout, csrfToken };
