const authService = require('../services/authService');
const { ensureCsrfToken } = require('../middleware/csrf');

async function login(req, res) {
  const { username, password, next: nextPath } = req.body;
  if (!username || !password) return res.redirect('/login?error=1');
  try {
    const userId = await authService.verifyCredentials(username, password);
    if (!userId) return res.redirect('/login?error=1');
    req.session.userId = userId;
    ensureCsrfToken(req); // pre-generate token so it's ready for post-login XHR
    // (?!\/) negative lookahead blocks protocol-relative URLs like //evil.com
    const safe = /^\/(?!\/)[a-zA-Z0-9_\-./?=&]*$/.test(nextPath) ? nextPath : '/';
    res.redirect(safe);
  } catch (err) {
    console.error(err);
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
