const express = require('express');
const router = express.Router();
const { askAI, askEngineerAI, askAdminAI, generateChatTitle } = require('../controllers/aiController');

router.post('/ask', askAI);
router.post('/engineer-ask', askEngineerAI);
router.post('/admin-ask', askAdminAI);
router.post('/generate-title', generateChatTitle);

module.exports = router;