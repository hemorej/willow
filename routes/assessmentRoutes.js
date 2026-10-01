const express = require('express');
const assessmentController = require('../controllers/assessmentController');
const { validateCsrf } = require('../middleware/csrf');

const router = express.Router();

router.post('/api/results', validateCsrf, assessmentController.submitResult);
router.get('/api/results', assessmentController.listResults);
router.get('/api/results/:id', assessmentController.getResult);

module.exports = router;
