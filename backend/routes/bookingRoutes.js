const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest');
const auth = require('../middleware/authMiddleware'); // استدعاء حارس البوابة

// راوت تقديم الطلب (محمي بالتوكن) //
router.post('/request', auth, async (req, res) => {
  try {
    const { unitId } = req.body;
    const userId = req.user.id; // بنجيب الـ ID من التوكن مش من الفورم لضمان الأمان

    const newRequest = new BookingRequest({
      userId,
      unitId,
      status: 'Pending'
    });

    await newRequest.save();

    // 📢 السطرين الجداد بتوع الـ WebSockets
    // بنسحب الـ io اللي حفظناه في ملف السيرفر الأساسي
    const io = req.app.get('socketio'); 
    if (io) {
        // بنذيع في المايك إن في طلب حجز جديد اتعمل
        io.emit('newBookingRequest'); 
    }

    res.status(201).json({ msg: "تم إرسال طلب الحجز بنجاح!" });

  } catch (error) {
    // 🚀 مسك إيرور التكرار (Duplicate Key Error code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ error: "عذراً، لقد قمت بتقديم طلب لهذه الوحدة مسبقاً، وهو قيد المراجعة." });
    }
    res.status(500).json({ error: "حدث خطأ أثناء إرسال الطلب" });
  }
});

module.exports = router;