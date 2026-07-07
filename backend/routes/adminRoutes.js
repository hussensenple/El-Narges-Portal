const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest'); 

// 🚀 استيراد الكنترولر العبقري اللي تعبنا فيه وبيعمل كل حاجة صح
const { approveRequest } = require('../controllers/bookingController');

// 1. جلب الطلبات المعلقة للوحة الأدمن
router.get('/pending', async (req, res) => {
  try {
    const requests = await BookingRequest.find({ status: 'Pending' }).populate('userId', 'name phone');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

// 2. 🚀 توجيه زرار الموافقة للكنترولر الصح (اللي بيحدث MongoDB و AGOL ويرقي العميل)
router.post('/approve/:requestId', async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const approvedRequest = await BookingRequest.findById(requestId);
    
    if (approvedRequest) {
      // 💡 الميزة اللي كانت في كودك القديم: رفض باقي الطلبات لنفس الوحدة عشان متتباعش لمرتين
      await BookingRequest.updateMany(
        { unitId: approvedRequest.unitId, _id: { $ne: requestId } },
        { status: 'Rejected' }
      );
    }
    
    // تمرير الطلب للكنترولر الأساسي عشان يكمل باقي الشغل النظيف
    next();
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث الطلبات الأخرى" });
  }
}, approveRequest);


// 3. مسح الطلب المرفوض
router.delete('/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRequest = await BookingRequest.findByIdAndDelete(id);
    if (!deletedRequest) {
      return res.status(404).json({ message: "الطلب غير موجود أصلاً" });
    }
    res.status(200).json({ message: "تم مسح الطلب بنجاح" });
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء محاولة المسح" });
  }
});

module.exports = router;