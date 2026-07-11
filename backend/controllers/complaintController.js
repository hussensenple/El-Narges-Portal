const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { sendComplaintEmail } = require('../utils/emailService');

// 1. تقديم شكوى جديدة (خاص بالـ Owner)
const submitComplaint = async (req, res) => {
  try {
    const { arcgisId, title, type, description, coordinates } = req.body;
    const ownerId = req.user.id; 

    // التأكد إن المستخدم فعلاً مالك (Owner)
    const user = await User.findById(ownerId);
    if (user.role !== 'owner') {
      return res.status(403).json({ msg: 'عفواً، يحق للملاك فقط تقديم شكاوى على وحداتهم.' });
    }

    const newComplaint = new Complaint({
      ownerId,
      arcgisId,
      title,
      type,
      description,
      coordinates
    });

    await newComplaint.save();
    
    // إرسال الإشعار اللحظي للأدمن
    req.app.get('io').emit('newComplaint');
    
    res.status(201).json({ msg: 'تم إرسال شكوتك بنجاح، سيتم مراجعتها في أقرب وقت.' });
  } catch (error) {
    console.error("Complaint Submission Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الشكوى' });
  }
};

// 2. عرض جميع الشكاوى (خاص بالـ Admin)
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });
      
    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الشكاوى' });
  }
};

// 3. تحديث حالة الشكوى وإرسال إيميل ديناميكي للمالك (خاص بالـ Admin)
const resolveComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body; // 🚀 التريكة هنا: استقبال الحالة من الفرونت إند

    const complaint = await Complaint.findById(complaintId).populate('ownerId', 'name email');
    if (!complaint) {
      return res.status(404).json({ msg: 'الشكوى غير موجودة' });
    }

    // 🚀 تحديث حالة الشكوى بالحالة اللي جاية من زرار الأدمن (Maintenance أو Dismissed)
    complaint.status = status || 'Resolved';
    await complaint.save();

    // 📧 إرسال إيميل بالقرار للمالك
    await sendComplaintEmail(complaint.ownerId.email, complaint.ownerId.name, complaint.title, status);

    res.status(200).json({ msg: 'تم تحديث حالة الشكوى وإرسال بريد إلكتروني للمالك بنجاح.' });
  } catch (error) {
    console.error("Resolve Complaint Error:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الشكوى' });
  }
};

module.exports = {
  submitComplaint,
  getAllComplaints,
  resolveComplaint
};