const express = require('express');
const router = express.Router();
const { askAI, askEngineerAI } = require('../controllers/aiController');

router.post('/ask', askAI);
router.post('/engineer-ask', askEngineerAI);

module.exports = router;