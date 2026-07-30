const express = require('express');

const router = express.Router();

router.use(require('./authRoutes'));
router.use(require('./bdiRoutes'));
router.use(require('./cbtRoutes'));
router.use(require('./journalRoutes'));
router.use(require('./pushRoutes'));

module.exports = router;
