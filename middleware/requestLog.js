const crypto = require('crypto');
const { getLogger } = require('../lib/logger');

const logger = getLogger('http');

/**
 * Assign every request a `req.id` (UUID, threaded into downstream logs), and
 * for `/api/*` requests emit one `http.request` summary line on response
 * `finish` — level by status class (2xx/3xx info, 4xx warn, 5xx error).
 * Static asset requests are tagged with an id but not logged.
 */
function requestLog(req, res, next) {
  req.id = crypto.randomUUID();
  if (!req.path.startsWith('/api/')) return next();

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const attrs = { requestId: req.id, method: req.method, path: req.path, status: res.statusCode, durationMs };
    if (res.statusCode >= 500) {
      logger.error('http.request', attrs);
    } else if (res.statusCode >= 400) {
      logger.warn('http.request', attrs);
    } else {
      logger.info('http.request', attrs);
    }
  });

  next();
}

module.exports = { requestLog };
