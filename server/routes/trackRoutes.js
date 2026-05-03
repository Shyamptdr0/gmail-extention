const express = require('express');
const router = express.Router();
const { trackPixel, getStatus, registerEmail, getAllTracks } = require('../controllers/trackController');

router.get('/t/:id', trackPixel);
router.get('/status/:id', getStatus);
router.get('/all-tracks', getAllTracks); // New Debug Route
router.post('/register', registerEmail);

module.exports = router;
