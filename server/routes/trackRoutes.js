const express = require('express');
const router = express.Router();
const { trackPixel, getStatus, registerEmail } = require('../controllers/trackController');

router.get('/t/:id', trackPixel);
router.get('/status/:id', getStatus);
router.post('/register', registerEmail);

module.exports = router;
