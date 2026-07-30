const express = require('express');
const pushController = require('../controllers/pushController');
const { validateCsrf } = require('../middleware/csrf');

const router = express.Router();

router.get('/api/push/public-key', pushController.publicKey);
router.post('/api/push/subscribe', validateCsrf, pushController.subscribe);
router.post('/api/push/unsubscribe', validateCsrf, pushController.unsubscribe);

// Dev/staging only: not reachable at all in production, regardless of session/CSRF.
if (process.env.NODE_ENV !== 'production') {
  router.post('/api/push/test', validateCsrf, pushController.sendTest);
}

module.exports = router;
