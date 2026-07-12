const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  submitComplaint,
  getAllComplaints,
  resolveComplaint
} = require('../controllers/complaintController');

// 1. تقديم شكوى (بيحتاج إن اليوزر يكون مسجل دخول)
router.post('/submit', auth, submitComplaint);

// 2. جلب جميع الشكاوى (للأدمن)
router.get('/all', getAllComplaints);

// 3. حل الشكوى (للأدمن)
router.put('/resolve/:complaintId', resolveComplaint);

module.exports = router;