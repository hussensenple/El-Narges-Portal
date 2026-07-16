const express = require('express');
const auth = require('../middleware/authMiddleware');
const router = express.Router();
const { addUser, getMyUnits, getBrokerUnits, updateProfile, changePassword } = require('../controllers/userController');

router.get('/my-units', auth, getMyUnits);
router.get('/broker-units', auth, getBrokerUnits);
router.put('/profile', auth, updateProfile);
router.put('/change-password', auth, changePassword);

module.exports = router;