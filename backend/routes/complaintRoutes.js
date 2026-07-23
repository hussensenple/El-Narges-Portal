const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  submitComplaint,
  getAllComplaints,
  resolveComplaint,
  getMyComplaints,
  getEngineerComplaints,
  updateComplaintPriority,
  updateComplaintStatus,
  addComplaintMessage,
  assignComplaint
} = require('../controllers/complaintController');

// 1. تقديم شكوى (بيحتاج إن اليوزر يكون مسجل دخول)
router.post('/submit', auth, submitComplaint);

// 2. جلب جميع الشكاوى (للأدمن)
router.get('/all', getAllComplaints);

// 3. جلب الشكاوى الخاصة بالمالك (للمالك)
router.get('/my', auth, getMyComplaints);

// 4. حل الشكوى (للأدمن القديم - يمكن دمجه أو تركه)
router.put('/resolve/:complaintId', resolveComplaint);

// 5. جلب الشكاوى الخاصة بالمهندس
router.get('/engineer', auth, getEngineerComplaints);

// 6. تحديث الأولوية (Admin Only)
router.put('/:complaintId/priority', updateComplaintPriority);

// 7. تحديث الحالة واسم المشكلة (Technician & Admin)
router.put('/:complaintId/status-name', updateComplaintStatus);

// 8. إضافة رسالة للمحادثة الخاصة بالشكوى
router.post('/:complaintId/messages', auth, addComplaintMessage);

// 9. Assign specialization and technician
router.put('/:id/assign', auth, assignComplaint);

module.exports = router;