const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  submitComplaint,
  getAllComplaints,
  resolveComplaint,
  getMyComplaints
} = require('../controllers/complaintController');

// 1. تقديم شكوى (بيحتاج إن اليوزر يكون مسجل دخول)
router.post('/submit', auth, submitComplaint);

// 2. جلب جميع الشكاوى (للأدمن)
router.get('/all', getAllComplaints);

// 3. جلب الشكاوى الخاصة بالمالك (للمالك)
router.get('/my', auth, getMyComplaints);

// 4. حل الشكوى (للأدمن)
router.put('/resolve/:complaintId', resolveComplaint);

module.exports = router;