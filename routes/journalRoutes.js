const express = require('express');
const journalController = require('../controllers/journalController');
const { validateCsrf } = require('../middleware/csrf');

const router = express.Router();

router.post('/api/journal/entries', validateCsrf, journalController.createEntry);
router.post('/api/journal/followup-check', validateCsrf, journalController.followupCheck);
router.get('/api/journal/entries', journalController.listEntries);
router.patch('/api/journal/entries/:id', validateCsrf, journalController.updateEntry);

module.exports = router;
