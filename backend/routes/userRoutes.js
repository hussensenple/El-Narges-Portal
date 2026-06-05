const express = require('express');
const router = express.Router();
const { addUser } = require('../controllers/userController');

router.post('/', addUser); // لإنشاء عميل جديد

module.exports = router;