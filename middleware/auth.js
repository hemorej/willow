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

module.exports = { requireAuth, PUBLIC_PATHS };
