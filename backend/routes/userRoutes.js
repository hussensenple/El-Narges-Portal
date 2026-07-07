const express = require('express');
const auth = require('../middleware/authMiddleware');const router = express.Router();
const { addUser, getMyUnits } = require('../controllers/userController');

router.get('/my-units', auth, getMyUnits); // 👈 الراوت الجديد

module.exports = router;