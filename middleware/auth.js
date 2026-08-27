const PUBLIC_PATHS = new Set(['/login', '/login.html', '/style.css', '/theme.js', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/manifest.json', '/robots.txt']);

// style.css and theme.js are content-hashed by scripts/build.js (e.g. style.UCCY7WQF.css) in dist/,
// so the login page (rendered before authentication) needs them allowed under their hashed names too.
const PUBLIC_HASHED_ASSET = /^\/(style|theme)(\.[A-Z0-9]{8})?\.(css|js)$/;

/**
 * Global gate (mounted after the session middleware): lets through the login
 * page and its public assets, the login/logout API, and any request with an
 * authenticated session. Everything else gets a `/login` redirect (page
 * requests) or a 401 JSON body (`/api/*` requests).
 */
function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path) || PUBLIC_HASHED_ASSET.test(req.path) || req.path.startsWith('/fonts/')) return next();
  if (req.path === '/api/login' || req.path === '/api/logout') return next();
  if (req.session.userId) return next();
  if (!req.path.startsWith('/api/')) {
    return res.redirect(`/login?next=${encodeURIComponent(req.path)}`);
  }
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAuth, PUBLIC_PATHS };
