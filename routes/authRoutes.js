const express = require('express');
const authController = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/api/login', loginLimiter, authController.login);
router.get('/api/logout', authController.logout);
router.get('/api/csrf-token', authController.csrfToken);

module.exports = router;
