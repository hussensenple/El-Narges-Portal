const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { askAI, askEngineerAI, askAdminAI, generateChatTitle, getUserChats, createUserChat, updateUserChat, deleteUserChat } = require('../controllers/aiController');

router.post('/ask', askAI);
router.post('/engineer-ask', askEngineerAI);
router.post('/admin-ask', askAdminAI);
router.post('/generate-title', generateChatTitle);

// User Chat History Routes
router.get('/chats', auth, getUserChats);
router.post('/chats', auth, createUserChat);
router.put('/chats/:id', auth, updateUserChat);
router.delete('/chats/:id', auth, deleteUserChat);

module.exports = router;