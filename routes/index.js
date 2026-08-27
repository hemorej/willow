// Aggregates every feature router. Mounted once in server.js after the auth
// gate, so individual route files only add per-route middleware (CSRF, the
// login rate limiter) on top of "session required".

const express = require('express');

const router = express.Router();

router.use(require('./authRoutes'));
router.use(require('./bdiRoutes'));
router.use(require('./cbtRoutes'));
router.use(require('./journalRoutes'));
router.use(require('./pushRoutes'));

module.exports = router;
