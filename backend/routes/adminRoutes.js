const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest'); 

// 🚀 استيراد الكنترولر العبقري اللي تعبنا فيه وبيعمل كل حاجة صح
const { approveRequest, adminRejectRequest } = require('../controllers/bookingController');
const { getDashboardStats } = require('../controllers/adminController');

// 0. Dashboard Stats
router.get('/dashboard-stats', getDashboardStats);

// 1. جلب الطلبات المعلقة للوحة الأدمن
router.get('/pending', async (req, res) => {
  try {
    const requests = await BookingRequest.find({ status: 'Reserved' }).populate('userId', 'name phone');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

// 1b. Rejection Analysis — all rejected/declined requests sorted newest first
router.get('/rejection-analysis', async (req, res) => {
  try {
    const rejections = await BookingRequest.find({
      status: { $in: ['Rejected', 'Declined'] }
    })
      .populate('userId', 'name email')
      .sort({ updatedAt: -1 });
    res.json(rejections);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rejection data' });
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


// 3. مسح الطلب المرفوض (او رفضه من الادمن)
router.post('/reject/:requestId', adminRejectRequest);

// 4. مسح نهائي (لو لسه محتاجينها)
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

// 5. Update Property Price
const { updateArcGISPrice } = require('../services/arcgisService');

router.post('/update-price', async (req, res) => {
  try {
    const { arcgisObjectId, newPrice, sourceLayer } = req.body;
    
    if (!arcgisObjectId || newPrice === undefined || !sourceLayer) {
      return res.status(400).json({ message: "بيانات غير مكتملة" });
    }

    const success = await updateArcGISPrice(arcgisObjectId, newPrice, sourceLayer);

    if (success) {
      res.status(200).json({ message: "تم تحديث السعر بنجاح" });
    } else {
      res.status(500).json({ message: "فشل في تحديث السعر على الخريطة" });
    }
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء تحديث السعر" });
  }
});

module.exports = router;