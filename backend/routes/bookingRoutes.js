const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest');
const User = require('../models/User'); // 👈 استيراد موديل المستخدم
const auth = require('../middleware/authMiddleware');

router.post('/request', auth, async (req, res) => {
  try {
    const { unitId, sourceLayer, buildingFK } = req.body;
    const userId = req.user.id; 

    // 🚀 سحب بيانات المستخدم بالكامل من قاعدة البيانات مباشرة
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }

    const newRequest = new BookingRequest({
      userId,
      unitId,
      sourceLayer, 
      buildingFK,
      customerName: user.name,     // 👈 أخذ الاسم من الداتا بيز
      customerPhone: user.phone,   // 👈 أخذ الهاتف من الداتا بيز
      customerGmail: user.email,   // 👈 أخذ الإيميل من الداتا بيز
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

module.exports = router;