const express = require('express');
const cbtController = require('../controllers/cbtController');
const { validateCsrf } = require('../middleware/csrf');

const router = express.Router();

router.post('/api/cbt/submit', validateCsrf, cbtController.submit);
router.get('/api/cbt/entries', cbtController.listEntries);
router.get('/api/cbt/entries/:filename', cbtController.getEntry);

module.exports = router;
