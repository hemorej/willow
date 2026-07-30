const express = require('express');
const bdiController = require('../controllers/bdiController');
const { validateCsrf } = require('../middleware/csrf');

const router = express.Router();

router.post('/api/results', validateCsrf, bdiController.submitResult);
router.get('/api/results', bdiController.listResults);
router.get('/api/results/:id', bdiController.getResult);

module.exports = router;
