const Complaint = require('../models/Complaint');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// ⚙️ إعدادات الإيميل (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

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

    // 📧 تجهيز محتوى الإيميل بناءً على قرار الأدمن
    let emailSubject = 'تحديث بخصوص شكوتك - منصة النرجس';
    let emailMessage = '';

    if (status === 'Maintenance') {
        emailSubject = '🚧 الشكوى قيد الصيانة - منصة النرجس';
        emailMessage = 'نود إعلامك بأنه تم مراجعة شكوتك وتحويلها لقسم الصيانة، وجاري العمل على حل المشكلة في أسرع وقت.';
    } else if (status === 'Dismissed') {
        emailSubject = '❌ تم رفض الشكوى - منصة النرجس';
        emailMessage = 'نود إعلامك بأنه تم مراجعة شكوتك وإغلاقها، إما لعدم استيفاء الشروط أو لأن المشكلة تقع خارج نطاق الإدارة.';
    } else {
        emailSubject = '✅ تم حل شكوتك - منصة النرجس';
        emailMessage = 'نود إعلامك بأنه تم بنجاح حل الشكوى المقدمة من طرفكم.';
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: complaint.ownerId.email,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; text-align: right; direction: rtl;">
          <h3>أهلاً بك أستاذ ${complaint.ownerId.name}،</h3>
          <p>${emailMessage}</p>
          <p style="color: #555;"><strong>تفاصيل الشكوى المُقدمة:</strong> ${complaint.description || complaint.title}</p>
          <p>شكراً لثقتكم بنا، ونتمنى لكم يوماً سعيداً!</p>
          <hr>
          <p style="color: gray; font-size: 12px;">إدارة منصة النرجس العقارية</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Email Sending Error:", error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

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