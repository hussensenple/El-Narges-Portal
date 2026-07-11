const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest');
const User = require('../models/User'); // 👈 استيراد موديل المستخدم
const auth = require('../middleware/authMiddleware');

// 🚀 استيراد دالة الموافقة من الكنترولر اللي لسه معدلينه
const { approveRequest, brokerReviewRequest } = require('../controllers/bookingController');
const Unit = require('../models/Unit'); 

// ==========================================
// 1. مسار تقديم طلب حجز جديد (من العميل)
// ==========================================
router.post('/request', auth, async (req, res) => {
  try {
    const { unitId, objectId, sourceLayer, buildingFK } = req.body;
    const userId = req.user.id; 

    // 🚀 الفحص الجديد: نمنع الـ Crash لو الفرونت إند نسي يبعت الـ ID
    if (!unitId || unitId === 'undefined') {
      return res.status(400).json({ error: "عذراً، حدث خطأ في قراءة معرف الوحدة من الخريطة، يرجى المحاولة مرة أخرى." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }

    const newRequest = new BookingRequest({
      userId,
      unitId,
      objectId,
      sourceLayer, 
      buildingFK,
      customerName: user.name,     
      customerPhone: user.phone,   
      customerGmail: user.email,   
      status: 'Pending'
    });

    await newRequest.save();

    const io = req.app.get('socketio'); 
    if (io) {
        io.emit('newBookingRequest'); 
    }

    res.status(201).json({ msg: "تم إرسال طلب الحجز بنجاح!" });

  } catch (error) {
    console.error("🚨 Booking Crash Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "عذراً، لقد قمت بتقديم طلب لهذه الوحدة مسبقاً، وهو قيد المراجعة." });
    }
    res.status(500).json({ error: "حدث خطأ أثناء إرسال الطلب" });
  }
});

// ==========================================
// 2. مسار الموافقة على الطلب (لـ Admin)
// ==========================================
// استخدمنا PUT لأننا بنحدث حالة الطلب
router.put('/approve/:requestId', auth, approveRequest);

// ==========================================
// 3. Broker Routes
// ==========================================
router.get('/all-broker-pending', async (req, res) => {
  try {
    const brokers = await User.find({ role: 'broker' }).select('name email phone');
    const response = [];

    for (const broker of brokers) {
      const brokerUnits = await Unit.find({ brokerId: broker._id });
      const unitIds = brokerUnits.map(u => u.arcgisId);
      
      const requests = await BookingRequest.find({ unitId: { $in: unitIds }, status: 'Pending' }).populate('userId', 'name phone');
      
      response.push({
        broker: broker,
        requests: requests
      });
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching all broker requests' });
  }
});

router.get('/broker-pending', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (user.role !== 'broker') return res.status(403).json({ error: 'Access denied' });
    
    // Find units assigned to this broker
    const brokerUnits = await Unit.find({ brokerId: userId });
    const unitIds = brokerUnits.map(u => u.arcgisId);

    // Find pending requests for these units
    const requests = await BookingRequest.find({ unitId: { $in: unitIds }, status: 'Pending' }).populate('userId', 'name phone');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching broker requests' });
  }
});

router.post('/broker-review/:requestId', auth, brokerReviewRequest);

module.exports = router;